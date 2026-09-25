// Minimal HTTP client used by http/ai/make atoms.
// fetchImpl is injectable so tests never touch the network.

import { TALError } from '../errors.ts';

export interface HttpRequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  followRedirects?: boolean;
  fetchImpl?: typeof fetch;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  text: string;
  json: unknown;
  durationMs: number;
}

const DEFAULT_TIMEOUT_MS = 15000;

export async function httpRequest(opts: HttpRequestOptions, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<HttpResponse> {
  const fetcher = opts.fetchImpl ?? fetch;
  const controller = 'AbortController' in globalThis ? new AbortController() : undefined;
  const timer = controller
    ? setTimeout(() => controller.abort(), opts.timeoutMs ?? timeoutMs)
    : undefined;

  const init: RequestInit = {
    method: (opts.method ?? 'GET').toUpperCase(),
    headers: opts.headers ?? {},
    body: opts.body === undefined ? undefined : typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body),
    signal: controller?.signal,
    redirect: opts.followRedirects === false ? 'manual' : 'follow',
  };
  if (init.body !== undefined && typeof opts.body !== 'string' && !Object.prototype.hasOwnProperty.call(init.headers!, 'content-type')) {
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
  }

  const start = Date.now();
  try {
    const res = await fetcher(opts.url, init);
    const text = await res.text();
    let json: unknown = null;
    if (text) {
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('json') || text.trimStart().startsWith('{') || text.trimStart().startsWith('[')) {
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
      }
    }
    const headerOut: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headerOut[k] = v;
    });
    return {
      status: res.status,
      statusText: res.statusText,
      headers: headerOut,
      text,
      json,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    if (timer) clearTimeout(timer);
    if (aborted) {
      throw new TALError({ code: 'timeout', message: `Request timed out after ${opts.timeoutMs ?? timeoutMs}ms`, retryable: true });
    }
    throw new TALError({
      code: 'network_error',
      message: err instanceof Error ? `Network error: ${err.message}` : 'Network error',
      retryable: true,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function retryableHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const t = value.trim();
  if (!t) return value;
  if (!t.startsWith('{') && !t.startsWith('[')) return value;
  try {
    return JSON.parse(t);
  } catch {
    return value;
  }
}