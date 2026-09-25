// Provider framework: maps a connection-driven node to a concrete provider
// implementation. A node config references a stored connection by name; the
// worker resolves that connection -> its credential, then this module turns the
// credential + node config into an authenticated request.
//
// Pure and dependency-free (mirrors schedule.ts / retry.ts) so it is testable
// in Node. No OAuth handshake here: external providers use their stored bearer
// token / api-key credential. The connection row records provider + scopes.

import { TALError } from './errors.ts';

export type ProviderId =
  | 'generic'
  | 'http'
  | 'stripe'
  | 'resend'
  | 'slack'
  | 'notion'
  | 'github'
  | 'openai'
  | 'anthropic'
  | 'gemini';

export interface ProviderSpec {
  id: ProviderId;
  label: string;
  // How to attach the connection's credential to an outgoing request.
  auth: 'bearer' | 'api-key' | 'none';
  // Default base URL for the provider (may be overridden by config.baseUrl).
  baseUrl?: string;
}

// The connection-driven provider palette. See the migration check constraint
// for the full set of connection.provider values; a subset maps to executable
// provider atoms here. 'make'/'hubspot'/'gmail' are legacy-only and stay out.
export const PROVIDERS: Record<string, ProviderSpec> = {
  generic: { id: 'generic', label: 'Generic API', auth: 'bearer' },
  http: { id: 'http', label: 'HTTP Endpoint', auth: 'bearer' },
  stripe: { id: 'stripe', label: 'Stripe', auth: 'bearer', baseUrl: 'https://api.stripe.com' },
  resend: { id: 'resend', label: 'Resend', auth: 'bearer', baseUrl: 'https://api.resend.com' },
  slack: { id: 'slack', label: 'Slack', auth: 'bearer', baseUrl: 'https://slack.com/api' },
  notion: { id: 'notion', label: 'Notion', auth: 'bearer', baseUrl: 'https://api.notion.com' },
  github: { id: 'github', label: 'GitHub', auth: 'bearer', baseUrl: 'https://api.github.com' },
  openai: { id: 'openai', label: 'OpenAI', auth: 'api-key', baseUrl: 'https://api.openai.com' },
  anthropic: { id: 'anthropic', label: 'Anthropic', auth: 'api-key', baseUrl: 'https://api.anthropic.com' },
  gemini: { id: 'gemini', label: 'Google Gemini', auth: 'api-key', baseUrl: 'https://generativelanguage.googleapis.com' },
};

export interface ProviderConfig {
  provider?: string;
  connection?: string; // name of the stored integration_connection
  credential?: string; // fallback: name of a stored credential
  baseUrl?: string;
  method?: string;
  path?: string;
  headers?: Record<string, unknown> | string;
  query?: Record<string, unknown> | string;
  body?: unknown;
  timeoutMs?: number;
}

// A provider-specific handler can be registered by id to override the generic
// request building (e.g. to inject provider-specific headers).
export type ProviderRequest =
  | { kind: 'http'; url: string; method: string; headers: Record<string, string>; body?: unknown }
  | { kind: 'error'; error: TALError };

export interface ProviderRuntime {
  nodeConfig: ProviderConfig;
  connection: Record<string, unknown> | null; // resolved connection row
  credential: Record<string, unknown> | null; // decrypted credential payload
}

// Build the outbound request for a provider atom given the resolved connection
// and its decrypted credential. Pure: no I/O.
export function buildProviderRequest(runtime: ProviderRuntime): ProviderRequest {
  const cfg = runtime.nodeConfig ?? {};
  const providerId = normalizeProvider(cfg.provider);
  const spec = PROVIDERS[providerId];

  if (!spec) {
    return {
      kind: 'error',
      error: new TALError({ code: 'integration_not_enabled', message: `Provider "${String(cfg.provider)}" is not enabled` }),
    };
  }

  const credential = runtime.credential ?? {};
  const token =
    typeof credential.apiKey === 'string'
      ? credential.apiKey
      : typeof credential.api_key === 'string'
        ? credential.api_key
        : typeof credential.token === 'string'
          ? credential.token
          : typeof credential.access_token === 'string'
            ? credential.access_token
            : undefined;

  const baseUrl = (cfg.baseUrl ?? spec.baseUrl ?? '').replace(/\/+$/, '');
  const path = (cfg.path ?? '').startsWith('/') ? cfg.path : `/${String(cfg.path ?? '')}`;
  const url = `${baseUrl}${path}`;
  if (!baseUrl || !/^https:\/\//.test(url)) {
    return { kind: 'error', error: new TALError({ code: 'invalid_config', message: 'Provider requires a valid https base URL' }) };
  }

  const headers = buildHeaders(cfg.headers);
  if (spec.auth === 'bearer' && token) {
    headers['authorization'] = `Bearer ${token}`;
  } else if (spec.auth === 'api-key' && token) {
    headers['x-api-key'] = token;
  }
  if (spec.id === 'notion') headers['notion-version'] ??= '2022-06-28';
  if (spec.id === 'anthropic') headers['anthropic-version'] ??= '2023-06-01';

  if (cfg.query !== undefined && cfg.query !== null) {
    const parsed = new URL(url);
    const raw = typeof cfg.query === 'string' ? safeParseJson(cfg.query, {}) : cfg.query;
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (v !== undefined && v !== null && v !== '') parsed.searchParams.set(k, String(v));
    }
    // NOTE: url string is returned separately below; callers re-parse params.
    return { kind: 'http', url: parsed.toString(), method: (cfg.method ?? 'GET').toUpperCase(), headers, body: cfg.body };
  }

  return { kind: 'http', url, method: (cfg.method ?? 'GET').toUpperCase(), headers, body: cfg.body };
}

function normalizeProvider(p: unknown): string {
  return String(p ?? 'generic').toLowerCase();
}

function buildHeaders(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    const parsed = safeParseJson(raw, null);
    if (parsed && typeof parsed === 'object') return toStringMap(parsed);
    return {};
  }
  if (typeof raw === 'object') return toStringMap(raw);
  return {};
}

function toStringMap(obj: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

function safeParseJson(text: string, fallback: unknown): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
