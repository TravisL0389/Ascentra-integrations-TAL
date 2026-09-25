// Provider atom: executes a connection-driven request against an external
// provider using a stored credential. The worker resolves the connection ->
// credential before the atom runs (see tal-worker). This atom only builds and
// dispatches the request.

import { TALError } from '../errors.ts';
import { deepInterpolate } from '../expression.ts';
import { buildProviderRequest, type ProviderConfig } from '../providers.ts';
import type { AtomContext, AtomResult } from '../types.ts';
import { httpRequest, retryableHttpStatus } from './httpClient.ts';

export const providerAtom = {
  type: 'provider',
  label: 'Provider Call',
  async run(ctx: AtomContext): Promise<AtomResult> {
    const raw = (ctx.node.config ?? {}) as ProviderConfig;
    const cfg = deepInterpolate(raw, { roots: ctx.scope, helpers: ctx.helpers }) as ProviderConfig;

    // Validate a connection or credential was resolved by the worker.
    const cred = ctx.credential;
    const connection = ctx.connection ?? null;
    const hasToken =
      !!cred &&
      (typeof (cred as Record<string, unknown>).apiKey === 'string' ||
        typeof (cred as Record<string, unknown>).api_key === 'string' ||
        typeof (cred as Record<string, unknown>).token === 'string' ||
        typeof (cred as Record<string, unknown>).access_token === 'string');

    const provided = (cfg.connection ?? cfg.credential) as string | undefined;
    if (!hasToken && !provided) {
      throw new TALError({
        code: 'credential_missing',
        message: 'Provider node needs a connection or credential. Attach one in the inspector.',
        node_id: ctx.node.id,
      });
    }

    const request = buildProviderRequest({
      nodeConfig: cfg,
      connection: connection ?? null,
      credential: cred ?? null,
    });
    if (request.kind === 'error') {
      request.error.node_id = ctx.node.id;
      throw request.error;
    }

    let response;
    try {
      response = await httpRequest(
        {
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: request.body,
          timeoutMs: Number(cfg.timeoutMs ?? 15000),
          followRedirects: false,
          fetchImpl: ctx.fetchImpl,
        },
        Number(cfg.timeoutMs ?? 15000),
      );
    } catch (err) {
      const e = err instanceof TALError ? err : new TALError({ code: 'network_error', message: String(err), retryable: true });
      e.node_id = ctx.node.id;
      throw e;
    }

    if (response.status >= 300) {
      const e = new TALError({
        code: 'http_error',
        message: `Provider ${response.status}: ${response.text.slice(0, 500)}`,
        retryable: retryableHttpStatus(response.status),
        details: { status: response.status, provider: cfg.provider },
      });
      e.node_id = ctx.node.id;
      throw e;
    }

    return {
      output: {
        body: response.json ?? response.text,
        status: response.status,
        headers: response.headers,
        url: request.url,
      },
      http: { status: response.status, body: response.json ?? response.text, headers: response.headers },
      status: 'succeeded',
      routes: ['true'],
    };
  },
};
