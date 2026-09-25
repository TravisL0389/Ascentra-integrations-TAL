// AI atom - native executor for LLM calls via stored credentials.
// Providers: openai / anthropic / google (gemini) / generic (OpenAI-compatible).

import { TALError } from '../errors.ts';
import { deepInterpolate } from '../expression.ts';
import type { AtomContext, AtomResult } from '../types.ts';
import { httpRequest, retryableHttpStatus } from './httpClient.ts';

export interface AiConfig {
  provider?: string;
  model?: string;
  systemPrompt?: string;
  prompt?: string;
  temperature?: number;
  maxTokens?: number;
  credentialRef?: string; // name of a credential in the org vault
  baseUrl?: string; // generic / OpenAI-compatible override
}

interface AiProviderSpec {
  url: string;
  buildBody: (cfg: AiConfig, prompt: string) => unknown;
  extract: (json: any, text: string) => string;
  headers: (key: string) => Record<string, string>;
}

function buildOpenAI(cfg: AiConfig, baseUrl: string | undefined): AiProviderSpec {
  const url = baseUrl ?? 'https://api.openai.com/v1/chat/completions';
  return {
    url,
    headers: (key) => ({ authorization: `Bearer ${key}`, 'content-type': 'application/json' }),
    buildBody: (c, prompt) => ({
      model: c.model ?? 'gpt-4o-mini',
      temperature: c.temperature ?? 0,
      max_tokens: c.maxTokens ?? 1024,
      messages: [
        ...(c.systemPrompt ? [{ role: 'system', content: c.systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
    }),
    extract: (json) => json?.choices?.[0]?.message?.content ?? (json?.error ? JSON.stringify(json.error) : ''),
  };
}

function buildAnthropic(): AiProviderSpec {
  return {
    url: 'https://api.anthropic.com/v1/messages',
    headers: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    }),
    buildBody: (c, prompt) => ({
      model: c.model ?? 'claude-3-5-haiku-latest',
      max_tokens: c.maxTokens ?? 1024,
      temperature: c.temperature ?? 0,
      system: c.systemPrompt ?? undefined,
      messages: [{ role: 'user', content: prompt }],
    }),
    extract: (json) => json?.content?.[0]?.text ?? (json?.error?.message ? JSON.stringify(json.error) : ''),
  };
}

function buildGemini(): AiProviderSpec {
  return {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/{{model}}:generateContent',
    headers: (key) => ({ 'content-type': 'application/json' }),
    buildBody: (c, prompt) => ({
      systemInstruction: c.systemPrompt ? { parts: [{ text: c.systemPrompt }] } : undefined,
      generationConfig: { temperature: c.temperature ?? 0, maxOutputTokens: c.maxTokens ?? 1024 },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
    extract: (json) => json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '',
  };
}

function providerSpec(cfg: AiConfig): AiProviderSpec {
  switch ((cfg.provider ?? 'openai').toLowerCase()) {
    case 'anthropic':
      return buildAnthropic();
    case 'google':
    case 'gemini':
      return buildGemini();
    default:
      return buildOpenAI(cfg, cfg.baseUrl);
  }
}

export const aiAtom = {
  type: 'ai',
  label: 'AI Execute',
  async run(ctx: AtomContext): Promise<AtomResult> {
    const raw = (ctx.node.config ?? {}) as AiConfig;
    const cfg = deepInterpolate(raw, { roots: ctx.scope, helpers: ctx.helpers }) as AiConfig;

    const prompt = String(cfg.prompt ?? '');
    if (!prompt.trim()) {
      throw new TALError({ code: 'invalid_config', message: 'AI atom requires a prompt', node_id: ctx.node.id });
    }

    let apiKey: string | undefined;
    const cred = ctx.credential;
    if (cred && typeof cred === 'object') {
      const flat = cred as Record<string, unknown>;
      apiKey = typeof flat.apiKey === 'string' ? flat.apiKey : String(flat.api_key ?? '');
    }
    if (!apiKey) {
      const err = new TALError({
        code: 'credential_missing',
        message: `AI atom needs an API key credential${cfg.credentialRef ? ` matching "${cfg.credentialRef}"` : ''}`,
        node_id: ctx.node.id,
      });
      throw err;
    }

    const spec = providerSpec(cfg);
    const url = spec.url.replace('{{model}}', cfg.model ?? '');
    let response;
    try {
      response = await httpRequest(
        { url, method: 'POST', headers: spec.headers(apiKey), body: spec.buildBody(cfg, prompt), timeoutMs: 60000, fetchImpl: ctx.fetchImpl },
        60000,
      );
    } catch (err) {
      const e = err instanceof TALError ? err : new TALError({ code: 'network_error', message: String(err), retryable: true });
      e.node_id = ctx.node.id;
      throw e;
    }

    if (response.status >= 400) {
      const e = new TALError({
        code: 'http_error',
        message: `${cfg.provider ?? 'AI'} error ${response.status}: ${response.text.slice(0, 500)}`,
        retryable: retryableHttpStatus(response.status),
        details: { status: response.status },
      });
      e.node_id = ctx.node.id;
      throw e;
    }

    const content = spec.extract(response.json, response.text);
    return {
      output: { content, provider: cfg.provider ?? 'openai', model: cfg.model, usage: (response.json as any)?.usage ?? null },
      status: 'succeeded',
      routes: ['true'],
    };
  },
};