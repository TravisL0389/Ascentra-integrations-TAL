import { describe, it, expect } from 'vitest';
import { buildProviderRequest, PROVIDERS } from '../supabase/functions/_shared/providers.ts';
import { runAtom } from '../supabase/functions/_shared/atoms/registry.ts';
import type { AtomContext, WorkflowNode } from '../supabase/functions/_shared/types.ts';

function makeNode(overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return { id: 'provider-1', type: 'provider', config: {}, ...overrides };
}

const baseCtx = (node: WorkflowNode): AtomContext => ({
  node,
  graph: { nodes: [node], edges: [] },
  scope: {},
  variables: {},
  trigger: {},
  helpers: {},
  now: () => '2026-01-01T00:00:00.000Z',
  connection: null,
  credential: null,
  fetchImpl: fetch,
});

describe('provider registry', () => {
  it('exposes the executable provider set', () => {
    expect(PROVIDERS.stripe.auth).toBe('bearer');
    expect(PROVIDERS.notion.auth).toBe('bearer');
    expect(PROVIDERS.openai.auth).toBe('api-key');
    expect(PROVIDERS.slack.baseUrl).toContain('slack.com');
  });

  it('rejects unknown providers with integration_not_enabled', () => {
    const req = buildProviderRequest({
      nodeConfig: { provider: 'hubspot' },
      connection: {},
      credential: {},
    });
    expect(req.kind).toBe('error');
    if (req.kind === 'error') expect(req.error.code).toBe('integration_not_enabled');
  });

  it('builds a bearer-authed request from an apiKey credential', () => {
    const req = buildProviderRequest({
      nodeConfig: { provider: 'stripe', method: 'GET', path: '/v1/customers', query: { limit: '10' } },
      connection: { id: 'c1', provider: 'stripe' },
      credential: { apiKey: 'sk_test_123' },
    });
    if (req.kind !== 'http') throw new Error('expected http');
    expect(req.url).toContain('https://api.stripe.com/v1/customers');
    expect(req.url).toContain('limit=10');
    expect(req.headers.authorization).toBe('Bearer sk_test_123');
  });

  it('injects provider-specific headers', () => {
    const req = buildProviderRequest({
      nodeConfig: { provider: 'notion', path: '/v1/pages' },
      connection: {},
      credential: { token: 'secret' },
    });
    if (req.kind !== 'http') throw new Error('expected http');
    expect(req.headers['notion-version']).toBe('2022-06-28');
    expect(req.headers.authorization).toBe('Bearer secret');
  });

  it('uses the generic provider with an explicit base URL', () => {
    const req = buildProviderRequest({
      nodeConfig: { provider: 'generic', baseUrl: 'https://api.example.com', path: '/ping' },
      connection: {},
      credential: { token: 't' },
    });
    expect(req.kind).toBe('http');
    if (req.kind === 'http') expect(req.url).toBe('https://api.example.com/ping');
  });

  it('errors when no https base URL can be formed', () => {
    const req = buildProviderRequest({
      nodeConfig: { provider: 'generic', path: '/ping' },
      connection: {},
      credential: { token: 't' },
    });
    expect(req.kind).toBe('error');
    if (req.kind === 'error') expect(req.error.code).toBe('invalid_config');
  });
});

describe('provider atom', () => {
  it('fails fast when no credential or connection resolved', async () => {
    const node = makeNode({ config: { provider: 'stripe', path: '/v1/customers' } });
    const result = await runAtom({ ...baseCtx(node), credential: null, connection: null });
    expect(result.status).toBe('failed');
    expect(result.error?.code).toBe('credential_missing');
  });

  it('executes a resolved connection call', async () => {
    const node = makeNode({ config: { provider: 'stripe', method: 'GET', path: '/v1/customers' } });
    const called: { url: string }[] = [];
    let result: Awaited<ReturnType<typeof runAtom>> | undefined;
    const ctx: AtomContext = {
      ...baseCtx(node),
      credential: { apiKey: 'sk_test_123' },
      connection: { id: 'c1', provider: 'stripe' },
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        called.push({ url: String(input) });
        return new Response('{"data":[]}', { status: 200, headers: { 'content-type': 'application/json' } });
      }) as typeof fetch,
    };
    result = await runAtom(ctx);
    expect(result?.status).toBe('succeeded');
    expect(called[0].url).toContain('https://api.stripe.com/v1/customers');
  });

  it('reports provider http errors as failed + retryable', async () => {
    const node = makeNode({ config: { provider: 'stripe', path: '/v1/customers' } });
    const ctx: AtomContext = {
      ...baseCtx(node),
      credential: { apiKey: 'sk_' },
      connection: { id: 'c1', provider: 'stripe' },
      fetchImpl: (async () => new Response('{"error":"forbidden"}', { status: 500 })) as typeof fetch,
    };
    const result = await runAtom(ctx);
    expect(result?.status).toBe('failed');
    expect(result?.error?.retryable).toBe(true);
  });
});
