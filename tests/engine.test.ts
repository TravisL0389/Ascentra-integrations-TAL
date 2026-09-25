import { describe, it, expect, vi } from 'vitest';
import { computeFrontier, resolveOutboundEdges, type ResolvedEdge } from '../supabase/functions/_shared/graph.ts';
import { runAtom, buildScope } from '../supabase/functions/_shared/atoms/registry.ts';
import { DEFAULT_HELPERS } from '../supabase/functions/_shared/expression.ts';
import type { WorkflowGraph, WorkflowNode } from '../supabase/functions/_shared/types.ts';

// Mini "worker" mirroring tal-worker without a database: purely exercises the
// planner + atoms + branch routing + skip closure+SSRF, so `npm test` proves the
// same flow the worker executes server-side.
interface SimOptions {
  fetchImpl?: typeof fetch;
  resolveDns?: (host: string) => Promise<string[]> | string[];
}

async function simulate(graph: WorkflowGraph, trigger: Record<string, unknown>, opts: SimOptions) {
  const runRecord: Record<string, { output?: any; status: string; routes?: string[]; branch?: string | null }> = {};
  let progress: ResolvedEdge[] = [];
  let queue = computeFrontier(graph, []).ready;
  let steps = 0;

  const runNode = async (node: WorkflowNode) => {
    const inputs: Record<string, { output?: unknown; branch?: string | null }> = {};
    for (const r of progress.filter((p) => p.to === node.id && !p.closed)) {
      if (inputs[r.from] === undefined && runRecord[r.from]?.output !== undefined) {
        inputs[r.from] = { output: runRecord[r.from].output, branch: runRecord[r.from].branch ?? null };
      }
    }
    const scope = buildScope({
      nodeId: node.id,
      inputs,
      trigger,
      variables: { region: 'us' },
      execution: { id: 'x' },
    });
    const result = await runAtom({
      node,
      graph,
      scope,
      variables: { region: 'us' },
      trigger,
      helpers: DEFAULT_HELPERS,
      now: () => '2026-08-29T00:00:00Z',
      fetchImpl: opts.fetchImpl,
      resolveDns: opts.resolveDns,
    });
    return result;
  };

  while (queue.length > 0 && steps < 50) {
    const id = queue.shift() as string;
    if (runRecord[id]) continue;
    const node = graph.nodes.find((n) => n.id === id)!;
    const result = await runNode(node);
    runRecord[id] = { output: result.output, status: result.status, routes: result.routes, branch: result.routes?.[0] ?? null };

    if (result.status === 'succeeded') {
      progress = resolveOutboundEdges(progress, id, graph, result.routes ?? ['true']);
    } else {
      progress = resolveOutboundEdges(progress, id, graph, [], { closeAll: true });
    }
    const frontier = computeFrontier(graph, progress);
    const newReady = frontier.ready.filter((nid) => !runRecord[nid] && !queue.includes(nid));
    queue.push(...newReady);
    steps += 1;
  }
  return { runRecord, progress };
}

const THIRD_PARTY_OK = '{"ok":true,"received":7}';

describe('engine end-to-end (manual -> transform -> branch -> http)', () => {
  it('runs the happy path with branch=true hitting the public API', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'manual', type: 'manual', column_index: 0 },
        { id: 'transform', type: 'logic', title: 'Transform', column_index: 1,
          config: { kind: 'transform', mapping: { email: '{{ trigger.body.email }}', uppercaseName: '{{ uppercase(trigger.body.name) }}' } } },
        { id: 'branch', type: 'logic', title: 'Branch', column_index: 2,
          config: { kind: 'branch', groups: [{ groupOperator: 'and', conditions: [{ path: 'trigger.body.amount', operator: 'greater_than', value: 100 }] }] } },
        { id: 'http', type: 'integration', title: 'HTTP', column_index: 3,
          config: { kind: 'http', url: 'http://example.com/api/items/{{ trigger.body.id }}', method: 'POST', body: { email: '{{ previous.output.email }}' } } },
      ],
      edges: [
        { from: 'manual', to: 'transform' },
        { from: 'transform', to: 'branch' },
        { from: 'branch', to: 'http', label: 'true' },
      ],
    };
    const fetchImpl = vi.fn(async () => new Response(THIRD_PARTY_OK, { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;

    const { runRecord } = await simulate(
      graph,
      { body: { id: 7, email: 'a@b.com', name: 'tal', amount: 300 } },
      { fetchImpl, resolveDns: async () => ['93.184.216.34'] },
    );

    expect(runRecord['manual'].status).toBe('succeeded');
    expect(runRecord['transform'].output).toEqual({ email: 'a@b.com', uppercaseName: 'TAL' });
    expect(runRecord['branch'].branch).toBe('true');
    expect(runRecord['http'].status).toBe('succeeded');
    expect(runRecord['http'].output?.body).toEqual({ ok: true, received: 7 });

    const callUrl = (fetchImpl as any).mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/items/7');
    const callBody = JSON.parse((fetchImpl as any).mock.calls[0][1].body as string);
    expect(callBody.email).toBe('a@b.com');
  });

  it('routes branch=false and skips the HTTP node', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'manual', type: 'manual' },
        { id: 'branch', type: 'logic', config: { kind: 'branch', groups: [{ groupOperator: 'and', conditions: [{ path: 'trigger.body.amount', operator: 'greater_than', value: 100 }] }] } },
        { id: 'http', type: 'integration', config: { kind: 'http', url: 'http://example.com/x' } },
      ],
      edges: [
        { from: 'manual', to: 'branch' },
        { from: 'branch', to: 'http', label: 'true' },
      ],
    };
    const { runRecord, progress } = await simulate(graph, { body: { amount: 5 } }, {});
    expect(runRecord['branch'].branch).toBe('false');
    expect(runRecord['http']).toBeUndefined();
    expect(progress.some((p) => p.from === 'branch' && p.to === 'http' && p.closed)).toBe(true);
  });

  it('fails loudly when the integration is not enabled', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'manual', type: 'manual' },
        { id: 'stripe-sync', type: 'integration' },
      ],
      edges: [{ from: 'manual', to: 'stripe-sync' }],
    };
    const { runRecord } = await simulate(graph, {}, {});
    expect(runRecord['stripe-sync'].status).toBe('failed');
    expect(runRecord['stripe-sync'].output).toBeNull();
  });
});