import { describe, it, expect } from 'vitest';
import { branchAtom, transformAtom, delayAtom, manualAtom } from '../supabase/functions/_shared/atoms/core.ts';
import { makeAtom, approvalAtom } from '../supabase/functions/_shared/atoms/approval.ts';
import { runAtom, atomFor, resolveKind, buildScope } from '../supabase/functions/_shared/atoms/registry.ts';
import { DEFAULT_HELPERS } from '../supabase/functions/_shared/expression.ts';
import { TALError } from '../supabase/functions/_shared/errors.ts';
import type { AtomContext, WorkflowNode } from '../supabase/functions/_shared/types.ts';

function ctx(node: WorkflowNode, scope: Record<string, unknown> = {}, extra: Partial<AtomContext> = {}): AtomContext {
  return {
    node,
    graph: { nodes: [node], edges: [] },
    scope,
    variables: {},
    trigger: null,
    helpers: DEFAULT_HELPERS,
    now: () => '2026-08-29T00:00:00Z',
    ...extra,
  };
}

describe('core atoms', () => {
  it('manual returns the trigger payload', async () => {
    const r = await runAtom(ctx({ id: 'm', type: 'manual' }, {}, { trigger: { body: { x: 1 } } }));
    expect(r.output).toEqual({ body: { x: 1 } });
    expect(r.routes).toEqual(['true']);
  });

  it('transform maps fields via expressions', async () => {
    const node: WorkflowNode = {
      id: 't',
      type: 'logic',
      config: { kind: 'transform', mapping: { email: '{{ trigger.body.email }}', upper: '{{ uppercase(trigger.body.name) }}' } },
    };
    const scope = { trigger: { body: { email: 'a@b.com', name: 'tal' } } };
    const result = await runAtom(ctx(node, scope));
    expect(result.output).toEqual({ email: 'a@b.com', upper: 'TAL' });
    expect(result.status).toBe('succeeded');
  });

  it('branch routes true when a group matches', async () => {
    const node: WorkflowNode = {
      id: 'br',
      type: 'logic',
      config: {
        kind: 'branch',
        groups: [{ groupOperator: 'and', conditions: [{ path: 'trigger.body.amount', operator: 'greater_than', value: 100 }] }],
      },
    };
    expect((await runAtom(ctx(node, { trigger: { body: { amount: 200 } } }))).routes).toEqual(['true']);
    expect((await runAtom(ctx(node, { trigger: { body: { amount: 50 } } }))).routes).toEqual(['false']);
  });

  it('branch errors without conditions', async () => {
    const node: WorkflowNode = { id: 'br', type: 'logic', config: { kind: 'branch' } };
    const result = await runAtom(ctx(node, {}));
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('invalid_config');
  });

  it('delay computes a future timestamp and marks waiting', async () => {
    const node: WorkflowNode = { id: 'd', type: 'logic', config: { kind: 'delay', seconds: 10 } };
    const result = await runAtom(ctx(node, {}));
    expect(result.status).toBe('waiting');
    expect(result.delayMs).toBe(10000);
    expect((result.output as any)?.delayMs).toBe(10000);
  });
});

describe('registry kind resolution (legacy builder ids)', () => {
  it('maps logic nodes by id prefix', () => {
    expect(resolveKind({ id: 'branch-0-0-ab', type: 'logic' })).toBe('branch');
    expect(resolveKind({ id: 'approval-1-2-xy', type: 'logic' })).toBe('approval');
    expect(resolveKind({ id: 'delay-9-9-zz', type: 'logic' })).toBe('delay');
    expect(resolveKind({ id: 'transform-3-1-qq', type: 'logic' })).toBe('transform');
  });

  it('maps integration nodes by id prefix', () => {
    expect(resolveKind({ id: 'http-0-0-a', type: 'integration' })).toBe('http');
    expect(resolveKind({ id: 'make-1-1-b', type: 'integration' })).toBe('make');
    expect(resolveKind({ id: 'hubspot-4-3-c', type: 'integration' })).toBe('hubspot');
  });

  it('unknown integrations dispatch to not_enabled atom', async () => {
    const node: WorkflowNode = { id: 'stripe-0-0', type: 'integration' };
    expect(atomFor(node).type).toBe('not_enabled');
    const result = await runAtom(ctx(node, {}));
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('integration_not_enabled');
  });
});

describe('make + approval atoms', () => {
  it('make fails clearly when the webhook URL is empty', async () => {
    const node: WorkflowNode = { id: 'make-0-0', type: 'integration', makeConfig: { webhookUrl: '' } };
    const result = await runAtom(ctx(node, {}));
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('integration_not_enabled');
  });

  it('make falls back to config.url for native-editor nodes', async () => {
    const node: WorkflowNode = {
      id: 'make-0-0',
      type: 'integration',
      config: { kind: 'make', url: 'https://hook.make.com/abc' },
      makeConfig: {},
    };
    const seen: { url: string }[] = [];
    const ctxOverride = ctx(
      node,
      {},
      {
        fetchImpl: (async (input: any) => {
          seen.push({ url: String(input.url ?? input) });
          return new Response('ok', { status: 200 });
        }) as never,
        resolveDns: (async () => []) as never,
      },
    );
    const result = await runAtom({ ...ctxOverride, node });
    expect(result.status).toBe('succeeded');
    expect(seen.length).toBe(1);
    expect(seen[0].url).toBe('https://hook.make.com/abc');
  });

  it('approval requests a decision without executing downstream', async () => {
    const node: WorkflowNode = { id: 'approval-0-0', type: 'logic', config: { kind: 'approval', title: 'Ship it?', message: 'Confirm before sending' } };
    const result = await runAtom(ctx(node, {}));
    expect(result.status).toBe('waiting');
    expect(result.approval?.title).toBe('Ship it?');
  });

  it('buildScope exposes previous/nodes/variables/trigger', () => {
    const scope = buildScope({
      nodeId: 'b',
      inputs: { a: { output: { id: 5 }, branch: 'true' } },
      trigger: { body: { x: 1 } },
      variables: { region: 'us' },
      execution: { id: 'ex' },
    });
    expect(scope.previous?.output).toEqual({ id: 5 });
    expect(scope.nodes?.a?.output).toEqual({ id: 5 });
    expect(scope.variables?.region).toBe('us');
    expect((scope.trigger as any)?.body?.x).toBe(1);
  });
});

describe('transform config via runAtom type-module', () => {
  it('is exported and importable', () => {
    expect(transformAtom.type).toBe('transform');
    expect(delayAtom.type).toBe('delay');
    expect(manualAtom.type).toBe('manual');
    expect(approvalAtom.type).toBe('approval');
    expect(makeAtom.type).toBe('make');
  });
});