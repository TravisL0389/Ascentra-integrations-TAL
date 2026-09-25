import { describe, it, expect, vi } from 'vitest';
import { httpAtom } from '../supabase/functions/_shared/atoms/http.ts';
import { DEFAULT_HELPERS } from '../supabase/functions/_shared/expression.ts';
import type { AtomContext, WorkflowNode } from '../supabase/functions/_shared/types.ts';

function makeFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  return vi.fn(async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    }),
  );
}

function httpCtx(node: WorkflowNode, fetchImpl: typeof fetch, resolveDns = async (h: string) => ['93.184.216.34'], credential?: Record<string, unknown>) {
  return {
    node,
    graph: { nodes: [node], edges: [] },
    scope: { trigger: { body: { id: 7 } } },
    variables: {},
    trigger: { body: { id: 7 } },
    helpers: DEFAULT_HELPERS,
    now: () => '2026-08-29T00:00:00Z',
    fetchImpl,
    resolveDns,
    credential,
  };
}

describe('http atom', () => {
  it('calls a public endpoint and returns JSON plus status', async () => {
    const node: WorkflowNode = {
      id: 'http-0-0',
      type: 'integration',
      config: { kind: 'http', url: 'http://example.com/items/{{ trigger.body.id }}', method: 'GET' },
    };
    const fetchImpl = makeFetch(200, { ok: true }) as typeof fetch;
    const result = await httpAtom.run(httpCtx(node, fetchImpl));
    expect(result.status).toBe('succeeded');
    expect((result.output as any)?.body).toEqual({ ok: true });
    expect(result.http?.status).toBe(200);
    const called: string = (fetchImpl as any).mock.calls[0][0] as string;
    expect(called).toContain('/items/7');
  });

  it('throws retryable on 5xx', async () => {
    const node: WorkflowNode = {
      id: 'http-0-0',
      type: 'integration',
      config: { kind: 'http', url: 'https://example.com/x', method: 'GET' },
    };
    await expect(httpAtom.run(httpCtx(node, makeFetch(500, 'boom') as typeof fetch))).rejects.toMatchObject({
      code: 'http_error',
      retryable: true,
    });
  });

  it('throws non-retryable on 4xx', async () => {
    const node: WorkflowNode = {
      id: 'http-0-0',
      type: 'integration',
      config: { kind: 'http', url: 'https://example.com/x', method: 'POST', body: { a: 1 } },
    };
    await expect(httpAtom.run(httpCtx(node, makeFetch(404, 'nope') as typeof fetch))).rejects.toMatchObject({
      retryable: false,
    });
  });

  it('blocks SSRF target hostnames', async () => {
    const node: WorkflowNode = {
      id: 'http-0-0',
      type: 'integration',
      config: { kind: 'http', url: 'http://metadata/x', method: 'GET' },
    };
    await expect(httpAtom.run(httpCtx(node, makeFetch(200, '{}') as typeof fetch, async () => ['10.0.0.5']))).rejects.toMatchObject({
      code: 'ssrf_blocked',
    });
  });

  it('merges query params from config.query into the URL', async () => {
    const node: WorkflowNode = {
      id: 'http-0-0',
      type: 'integration',
      config: { kind: 'http', url: 'https://example.com/api', method: 'GET', query: { page: 2, q: 'tal' } },
    };
    const fetchImpl = makeFetch(200, { ok: true }) as typeof fetch;
    const result = await httpAtom.run(httpCtx(node, fetchImpl));
    expect(result.status).toBe('succeeded');
    const called: string = (fetchImpl as any).mock.calls[0][0] as string;
    expect(called).toContain('page=2');
    expect(called).toContain('q=tal');
  });

  it('rejects invalid JSON query params', async () => {
    const node: WorkflowNode = {
      id: 'http-0-0',
      type: 'integration',
      config: { kind: 'http', url: 'https://example.com/api', method: 'GET', query: 'not-json' },
    };
    await expect(httpAtom.run(httpCtx(node, makeFetch(200, '{}') as typeof fetch))).rejects.toMatchObject({
      code: 'invalid_config',
    });
  });

  it('injects a resolved credential server-side without overwriting explicit auth', async () => {
    const node: WorkflowNode = {
      id: 'http-0-0',
      type: 'integration',
      config: { kind: 'http', url: 'https://example.com/api', method: 'GET' },
    };
    const fetchImpl = makeFetch(200, { ok: true }) as typeof fetch;
    await httpAtom.run(httpCtx(node, fetchImpl, async () => ['93.184.216.34'], { apiKey: 'server-only-secret' }));
    const init = (fetchImpl as any).mock.calls[0][1];
    expect(init.headers.authorization).toBe('Bearer server-only-secret');
  });
});
