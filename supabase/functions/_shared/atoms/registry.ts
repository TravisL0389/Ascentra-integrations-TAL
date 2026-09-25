// Atom registry: maps a node's type to a runnable implementation and builds the
// expression scope for each node. Legacy integration types stay renderable but
// return a structured "not enabled" error when executed.

import { TALError } from '../errors.ts';
import { DEFAULT_HELPERS } from '../expression.ts';
import type {
  AtomContext,
  AtomDefinition,
  AtomResult,
  EdgeLabel,
  ExpressionScope,
  NodeRunStatus,
  WorkflowNode,
} from '../types.ts';
import { approvalAtom, makeAtom } from './approval.ts';
import { branchAtom, delayAtom, manualAtom, passthroughAtom, skipAtom, transformAtom } from './core.ts';
import { httpAtom } from './http.ts';
import { aiAtom } from './ai.ts';
import { providerAtom } from './provider.ts';
import type { NodeInputs } from '../graph.ts';
import { PROVIDERS } from '../providers.ts';

// Integration palette that exists for saved-legacy flows only.
const LEGACY_INTEGRATIONS = new Set(['hubspot', 'gmail', 'stripe', 'notion']);

// Native provider node kinds (config.kind === 'provider' or node.type ===
// 'provider'). Connection-driven atoms that resolve against stored credentials.
const PROVIDER_KINDS = new Set(Object.keys(PROVIDERS));

export interface ScopeBuildOpts {
  nodeId: string;
  inputs: NodeInputs;
  trigger: Record<string, unknown> | null;
  variables: Record<string, unknown>;
  execution: Record<string, unknown>;
}

export function buildScope(opts: ScopeBuildOpts): ExpressionScope {
  const previousEntry = Object.values(opts.inputs ?? {})[0];
  const nodes: Record<string, { output?: unknown; branch?: EdgeLabel | undefined; status?: NodeRunStatus | undefined }> = {};
  for (const [id, v] of Object.entries(opts.inputs ?? {})) {
    nodes[id] = {
      output: v.output,
      branch: v.branch as EdgeLabel | undefined,
      status: v.status as NodeRunStatus | undefined,
    };
  }
  return {
    trigger: opts.trigger ?? {},
    input: previousEntry?.output,
    previous: previousEntry,
    nodes,
    variables: opts.variables ?? {},
    execution: opts.execution ?? {},
  };
}

export function makeContext(
  node: WorkflowNode,
  ctx: Omit<AtomContext, 'node' | 'graph'>,
  graph: AtomContext['graph'],
): AtomContext {
  return { ...ctx, node, graph };
}

export const ATOMS: Record<string, AtomDefinition> = {
  manual: manualAtom,
  transform: transformAtom,
  branch: branchAtom,
  delay: delayAtom,
  approval: approvalAtom,
  http: httpAtom,
  ai: aiAtom,
  make: makeAtom,
  provider: providerAtom,
  webhook: passthroughAtom,
  schedule: passthroughAtom,
  logic: passthroughAtom,
};

const notEnabledAtom: AtomDefinition = {
  type: 'not_enabled',
  label: 'Not enabled',
  run(ctx: AtomContext): AtomResult {
    const err = new TALError({
      code: 'integration_not_enabled',
      message: `Integration "${ctx.node.type}" is not enabled in the native engine. Reconnect it in the Config tab or replace it with the HTTP node.`,
      node_id: ctx.node.id,
    });
    return { output: null, status: 'failed', routes: [], error: err.toJSON() };
  },
};

// The legacy builder stores atom kinds in the node's id prefix:
//   type 'logic' -> node id like "branch-0-0-abc", "approval-…", "delay-…", "transform-…"
//   type 'integration' -> node id like "http-…", "make-…", "hubspot-…"
// New native atoms store `config.kind`. Normalize all of them here so saved
// legacy flows keep executing correctly.
export function resolveKind(node: WorkflowNode): string {
  const t = String(node.type ?? '').toLowerCase();
  const cfgKind = node.config && typeof node.config === 'object' ? String((node.config as Record<string, unknown>).kind ?? '') : '';
  const id = String(node.id ?? '').toLowerCase();

  const byIdPrefix = (prefixes: string[]): string | null => {
    for (const p of prefixes) {
      if (id.startsWith(p)) return p;
    }
    return null;
  };

  // 'logic' / 'integration' are legacy buckets: the real atom kind lives in the
  // node id prefix (or config.kind for newly created nodes).
  if (t === 'logic') {
    const kind = byIdPrefix(['branch', 'approval', 'delay', 'transform']) ?? (cfgKind || null);
    if (kind) return kind;
    if (id.includes('branch') || id.includes('decision') || id.includes('tier')) return 'branch';
    if (id.includes('approval')) return 'approval';
    if (id.includes('delay')) return 'delay';
    if (id.includes('transform') || id.includes('shape')) return 'transform';
    return 'transform';
  }
  if (t === 'integration') {
    const kind = byIdPrefix(['http', 'make', 'hubspot', 'gmail', 'stripe', 'notion']) ?? (cfgKind || null);
    if (kind) return kind;
    if (id.includes('http')) return 'http';
    if (id.includes('make') || id.includes('webhook')) return 'make';
    return 'not_enabled';
  }
  if (t === 'trigger' || t === 'webhook' || t === 'schedule') {
    return t === 'trigger' ? 'manual' : t;
  }
  if (ATOMS[t]) return t;
  if (cfgKind) return cfgKind.toLowerCase();
  if (t === 'agent') return 'ai';
  return 'not_enabled';
}

export function atomFor(node: WorkflowNode): AtomDefinition {
  const kind = resolveKind(node);
  if (ATOMS[kind]) return ATOMS[kind];
  if (kind === 'change_role' || kind === 'sentiment' || kind === 'org_setup') return passthroughAtom;
  if (LEGACY_INTEGRATIONS.has(kind)) return notEnabledAtom;
  if (PROVIDER_KINDS.has(kind)) return providerAtom;
  if (kind === 'agent') return aiAtom;
  return notEnabledAtom;
}

export async function runAtom(ctx: AtomContext): Promise<AtomResult> {
  if (ctx.node.disabled === true) {
    return { output: null, status: 'skipped', routes: ['true'] };
  }
  const atom = atomFor(ctx.node);
  try {
    const result = await atom.run(ctx);
    return result;
  } catch (err) {
    const e = err instanceof TALError ? err : new TALError({ code: 'internal', message: err instanceof Error ? err.message : String(err) });
    if (!e.node_id) e.node_id = ctx.node.id;
    return {
      output: null,
      status: 'failed',
      routes: [],
      error: e.toJSON(),
    };
  }
}

export { DEFAULT_HELPERS as HELPERS, skipAtom };
export type { AtomDefinition, AtomResult };
