// HTTP Request atom - native replacement for Make webhook calls. SSRF-guarded.

import { TALError } from '../errors.ts';
import { deepInterpolate } from '../expression.ts';
import { assertSafeHttpUrl, assertSafeRedirect } from '../ssrf.ts';
import type { AtomContext, AtomResult } from '../types.ts';
import { httpRequest, parseMaybeJson, retryableHttpStatus } from './httpClient.ts';

export interface HttpAtomConfig {
  url?: string;
  method?: string;
  headers?: Record<string, unknown> | string;
  body?: unknown;
  query?: Record<string, unknown> | string;
  timeoutMs?: number;
  followRedirects?: boolean;
}

function normalizeHeaders(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch (err) {
      throw new TALError({ code: 'invalid_config', message: `HTTP headers are not valid JSON: ${err instanceof Error ? err.message : ''}` });
    }
  }
  if (typeof raw === 'object') {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      out[k] = String(v);
    }
    return out;
  }
  return {};
}

export const httpAtom = {
  type: 'http',
  label: 'HTTP Request',
  async run(ctx: AtomContext): Promise<AtomResult> {
    const config = (ctx.node.config ?? {}) as HttpAtomConfig;
    const rawUrl = config.url ?? '';
    if (!rawUrl) {
      throw new TALError({ code: 'invalid_config', message: 'HTTP atom requires a URL', node_id: ctx.node.id });
    }
    const interpolated = deepInterpolate(config, { roots: ctx.scope, helpers: ctx.helpers }) as HttpAtomConfig;
    let url = String(interpolated.url);
    const method = (interpolated.method ?? 'GET').toUpperCase();
    const headers = normalizeHeaders(interpolated.headers);
    const credential = ctx.credential as Record<string, unknown> | null | undefined;
    if (credential) {
      const token = credential.token ?? credential.access_token ?? credential.apiKey ?? credential.api_key;
      if (token) {
        const headerName = String(credential.headerName ?? credential.header_name ?? 'authorization').toLowerCase();
        const prefix = String(credential.prefix ?? (headerName === 'authorization' ? 'Bearer ' : ''));
        const existing = Object.keys(headers).some((key) => key.toLowerCase() === headerName);
        if (!existing) headers[headerName] = `${prefix}${String(token)}`;
      }
    }
    const timeoutMs = Number(interpolated.timeoutMs ?? 15000);
    const followRedirects = interpolated.followRedirects !== false;

    // Merge the optional `query` map into the URL as query parameters.
    if (interpolated.query !== undefined && interpolated.query !== null) {
      const parsed = new URL(url);
      const raw =
        typeof interpolated.query === 'string'
          ? (() => {
              try {
                return JSON.parse(interpolated.query) as Record<string, unknown>;
              } catch {
                throw new TALError({ code: 'invalid_config', message: 'HTTP query params are not valid JSON', node_id: ctx.node.id });
              }
            })()
          : interpolated.query;
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (v === undefined || v === null || v === '') continue;
        parsed.searchParams.set(k, String(v));
      }
      url = parsed.toString();
    }

    const resolved = await assertSafeHttpUrl(url, (host) => resolveDns(host, ctx));

    let response;
    try {
      response = await httpRequest(
        {
          url: url,
          method,
          headers,
          body: interpolated.body,
          timeoutMs,
          followRedirects: false, // we validate each hop ourselves
          fetchImpl: ctx.fetchImpl,
        },
        timeoutMs,
      );
    } catch (err) {
      const e = err instanceof TALError ? err : new TALError({ code: 'network_error', message: String(err), retryable: true });
      e.node_id = ctx.node.id;
      throw e;
    }

    // Validate 3xx hops the same way (redirect target must also be safe).
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers['location'];
      if (location && followRedirects && !response.headers['location']?.startsWith('data:')) {
        const nextUrl = new URL(location, resolved).toString();
        await assertSafeRedirect(nextUrl, (host) => resolveDns(host, ctx), { originalHost: resolved.hostname });
        throw new TALError({
          code: 'http_error',
          message: `Redirect to "${nextUrl}" requires approval in follow mode; retry resolved`,
          retryable: false,
        });
      }
    }

    if (response.status >= 400) {
      const e = new TALError({
        code: 'http_error',
        message: `HTTP ${response.status}: ${response.text.slice(0, 500)}`,
        retryable: retryableHttpStatus(response.status),
        details: { status: response.status, url },
      });
      e.node_id = ctx.node.id;
      throw e;
    }

    const body = response.json !== null ? response.json : parseMaybeJson(response.text || null);
    return {
      output: {
        body,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        url,
        durationMs: response.durationMs,
      },
      http: { status: response.status, body, headers: response.headers },
      status: 'succeeded',
      routes: ['true'],
    };
  },
};

// Resolve a hostname to IPs. Prefer injected resolver, fall back to a literal
// or to the platform's DNS when available at runtime.
async function resolveDns(host: string, ctx: AtomContext): Promise<string[]> {
  // Non-hostname literals short-circuit in assertSafeHttpUrl; anything
  // reaching here should be an actual hostname.
  if (host.includes('[') || host.includes(']')) return [host.replace(/^\[|\]$/g, '')];
  // Injected resolver (Deno worker passes Deno.resolveDns wrapper).
  const injected = ctx.resolveDns;
  if (injected) return injected(host);
  return [host];
}
