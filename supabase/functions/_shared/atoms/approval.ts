// Approval atom. The worker handles record creation + resume; this atom just
// declares what to surface to a human reviewer.

import { TALError } from '../errors.ts';
import { deepInterpolate } from '../expression.ts';
import type { AtomContext, AtomResult } from '../types.ts';
import { httpRequest, retryableHttpStatus } from './httpClient.ts';

export interface ApprovalConfig {
  title?: string;
  message?: string;
  routeOnApprove?: string[];
}

export const approvalAtom = {
  type: 'approval',
  label: 'Approval',
  isAsync: true,
  run(ctx: AtomContext): AtomResult {
    const config = (ctx.node.config ?? {}) as ApprovalConfig;
    const title = String(deepInterpolate(config.title ?? (ctx.node.title || 'Approval'), { roots: ctx.scope, helpers: ctx.helpers }) ?? 'Approval');
    const message = String(deepInterpolate(config.message ?? '', { roots: ctx.scope, helpers: ctx.helpers }) ?? '');
    if (!title.trim() && !message.trim()) {
      throw new TALError({ code: 'invalid_config', message: 'Approval requires a title or message', node_id: ctx.node.id });
    }
    return {
      output: { approval: { title, message } },
      status: 'waiting',
      approval: { title, message },
      routes: config.routeOnApprove ?? ['true'],
    };
  },
};

// Make atom: legacy Make.com connector, kept optional. Only runs when a webhook
// URL actually exists; otherwise it yields an explicit, structured "not enabled"
// error so callers can branch on it — never silently "fake-succeeds".

export interface MakeConfig {
  webhookUrl?: string;
  method?: string;
  payload?: string;
  headers?: string;
}

export const makeAtom = {
  type: 'make',
  label: 'Make Webhook',
  async run(ctx: AtomContext): Promise<AtomResult> {
    const cfg = (ctx.node.makeConfig ?? {}) as MakeConfig;
    const interpolated = deepInterpolate({ ...cfg }, { roots: ctx.scope, helpers: ctx.helpers }) as MakeConfig;
    // New native editor writes the URL into config.url; legacy builder uses
    // makeConfig.webhookUrl. Prefer makeConfig, fall back to config.url.
    const webhookUrl = (interpolated.webhookUrl ?? (ctx.node.config as { url?: string } | undefined)?.url ?? '').trim();

    if (!webhookUrl) {
      const err = new TALError({
        code: 'integration_not_enabled',
        message: 'This Make node has no webhook URL configured. Configure it, or swap to the native HTTP node.',
        node_id: ctx.node.id,
      });
      return {
        output: null,
        status: 'failed',
        routes: [],
        error: err.toJSON(),
      };
    }

    if (!/^https:\/\//.test(webhookUrl) || !webhookUrl.includes('make.com')) {
      const err = new TALError({
        code: 'invalid_config',
        message: 'Make webhook URLs must be https://*.make.com endpoints.',
        node_id: ctx.node.id,
      });
      return { output: null, status: 'failed', routes: [], error: err.toJSON() };
    }

    let payload: unknown = {};
    try {
      payload = interpolated.payload ? JSON.parse(interpolated.payload) : {};
    } catch {
      const err = new TALError({ code: 'invalid_config', message: 'Make payload is not valid JSON.', node_id: ctx.node.id });
      return { output: null, status: 'failed', routes: [], error: err.toJSON() };
    }

    let headers: Record<string, string> = {};
    try {
      headers = interpolated.headers ? JSON.parse(interpolated.headers) : {};
    } catch {
      headers = {};
    }

    const method = (interpolated.method ?? 'POST').toUpperCase();
    try {
      const response = await httpRequest(
        { url: webhookUrl, method, headers, body: payload, fetchImpl: ctx.fetchImpl },
        20000,
      );
      if (response.status >= 400) {
        const err = new TALError({
          code: 'http_error',
          message: `Make returned HTTP ${response.status}: ${response.text.slice(0, 500)}`,
          retryable: retryableHttpStatus(response.status),
          details: { status: response.status },
        });
        return { output: null, status: 'failed', routes: [], error: err.toJSON() };
      }
      return {
        output: { status: response.status, body: response.json ?? response.text },
        status: 'succeeded',
        routes: ['true'],
      };
    } catch (err) {
      return {
        output: null,
        status: 'failed',
        routes: [],
        error: err instanceof Error ? { message: err.message, retryable: true } : { message: String(err), retryable: true },
      };
    }
  },
};