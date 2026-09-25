// Graph planner: dependency readiness, branch-route resolution, cycles, validation.
// Pure functions over the WorkflowGraph + resolved-edge progress stored on the
// execution record (`executions.progress.resolvedEdges`).

import { TALError } from './errors.ts';
import type { WorkflowEdge, WorkflowGraph, WorkflowNode } from './types.ts';

export interface ResolvedEdge {
  from: string;
  to: string;
  label?: WorkflowEdge['label'];
  closed: boolean; // true = branch route did NOT match => downstream is skipped
}

export interface NodeInputs {
  [upstreamId: string]: { output?: unknown; branch?: WorkflowEdge['label']; status?: string };
}

export interface PlanResult {
  ready: string[]; // node ids whose inbound edges are all resolved
  skipped: string[]; // node ids whose inbound edges are all resolved AND closed
  blocked: string[]; // node ids still waiting on unresolved inbound edges
  inputs: Record<string, NodeInputs>;
}

export function toEdgeList(graph: WorkflowGraph): WorkflowEdge[] {
  return graph.edges ?? [];
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

// Topological order (Kahn). Used for validation + stable ids.
export function topologicalOrder(graph: WorkflowGraph): string[] {
  const nodes = graph.nodes ?? [];
  const edges = toEdgeList(graph);
  const inbound = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const outbound = new Map<string, string[]>(nodes.map((n) => [n.id, []]));

  for (const e of edges) {
    if (!inbound.has(e.from) || !inbound.has(e.to)) continue;
    inbound.set(e.to, (inbound.get(e.to) ?? 0) + 1);
    outbound.get(e.from)?.push(e.to);
  }

  const queue = nodes.filter((n) => (inbound.get(n.id) ?? 0) === 0).map((n) => n.id);
  const out: string[] = [];
  while (queue.length) {
    const id = queue.shift() as string;
    out.push(id);
    for (const next of outbound.get(id) ?? []) {
      inbound.set(next, (inbound.get(next) ?? 1) - 1);
      if ((inbound.get(next) ?? 0) === 0) queue.push(next);
    }
  }
  return out;
}

export function hasCycle(graph: WorkflowGraph): boolean {
  const ordered = topologicalOrder(graph);
  const nodeCount = (graph.nodes ?? []).length;
  return ordered.length < nodeCount;
}

export function validateGraph(graph: WorkflowGraph): void {
  const nodes = graph.nodes ?? [];
  const ids = nodes.map((n) => n.id);
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new TALError({ code: 'invalid_graph', message: `Duplicate node id "${id}"` });
    }
    seen.add(id);
  }
  for (const e of toEdgeList(graph)) {
    if (!seen.has(e.from)) {
      throw new TALError({ code: 'invalid_graph', message: `Edge references unknown node "${e.from}"` });
    }
    if (!seen.has(e.to)) {
      throw new TALError({ code: 'invalid_graph', message: `Edge references unknown node "${e.to}"` });
    }
  }
  if (hasCycle(graph)) {
    throw new TALError({ code: 'invalid_graph', message: 'Workflow graph contains a cycle' });
  }
}

// Resolve the branch route emitted by a just-completed node against its
// outbound edges. `closeAll` forces every outbound edge closed (dead-path skip).
export function resolveOutboundEdges(
  resolvedEdges: ResolvedEdge[],
  nodeId: string,
  graph: WorkflowGraph,
  emittedRoutes: string[] = [],
  opts: { closeAll?: boolean } = {},
): ResolvedEdge[] {
  const next = [...resolvedEdges];
  const outbound = toEdgeList(graph).filter((e) => e.from === nodeId);
  for (const e of outbound) {
    const route = e.label;
    const passes = closeAll(opts) ? false : route == null || emittedRoutes.includes(route);
    if (next.some((r) => r.from === e.from && r.to === e.to && (r.label ?? null) === (e.label ?? null))) continue;
    next.push({ from: e.from, to: e.to, label: e.label ?? undefined, closed: !passes });
  }
  return next;
}

function closeAll(opts: { closeAll?: boolean }): boolean {
  return opts.closeAll === true;
}

/**
 * Compute the frontier: which nodes now have ALL inbound edges resolved.
 *  - all inbound closed  -> skipped (dead branch)
 *  - >=1 inbound passed  -> ready (queued for execution)
 *  - inbound unresolved   -> blocked
 * Also builds the input map from passed inbound edges (points at the upstream
 * node's stored output).
 */
export function computeFrontier(
  graph: WorkflowGraph,
  resolvedEdges: ResolvedEdge[],
): PlanResult {
  const nodes = graph.nodes ?? [];
  const inbound = new Map<string, WorkflowEdge[]>();
  for (const n of nodes) inbound.set(n.id, []);
  for (const e of toEdgeList(graph)) {
    inbound.get(e.to)?.push(e);
  }

  const inputMap: Record<string, NodeInputs> = {};
  const readyIds: string[] = [];
  const skippedIds: string[] = [];
  const blockedIds: string[] = [];

  for (const n of nodes) {
    const inEdges = inbound.get(n.id) ?? [];
    if (inEdges.length === 0) {
      // Entry node: no dependencies, always starts.
      inputMap[n.id] = {};
      readyIds.push(n.id);
      continue;
    }
    const resolved = inEdges.filter((e) =>
      resolvedEdges.some((r) => r.from === e.from && r.to === e.to && (r.label ?? null) === (e.label ?? null)),
    );
    if (resolved.length < inEdges.length) {
      blockedIds.push(n.id);
      continue;
    }
    const passed = resolvedEdges.filter(
      (r) => r.to === n.id && !r.closed && inEdges.some((e) => e.from === r.from && e.to === r.to && (e.label ?? null) === (r.label ?? null)),
    );
    if (passed.length === 0) {
      skippedIds.push(n.id);
      continue;
    }
    inputMap[n.id] = {};
    for (const p of passed) {
      inputMap[n.id][p.from] = { branch: p.label ?? undefined };
    }
    readyIds.push(n.id);
  }

  return { ready: readyIds, skipped: skippedIds, blocked: blockedIds, inputs: inputMap };
}

export function seedResolvedEdges(graph: WorkflowGraph): ResolvedEdge[] {
  // Entry nodes (no inbound edges) are always "resolved" so they can start.
  const nodes = graph.nodes ?? [];
  const edges = toEdgeList(graph);
  const inbound = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (const e of edges) {
    if (inbound.has(e.to)) inbound.set(e.to, (inbound.get(e.to) ?? 0) + 1);
  }
  return [];
}

// Sort ready nodes deterministically by position (column then lane).
export function sortByPosition(ids: string[], graph: WorkflowGraph): string[] {
  const byId = new Map((graph.nodes ?? []).map((n) => [n.id, n]));
  return [...ids].sort((a, b) => {
    const na = byId.get(a);
    const nb = byId.get(b);
    const ca = (na?.column_index ?? 0);
    const cb = (nb?.column_index ?? 0);
    if (ca !== cb) return ca - cb;
    return (na?.lane ?? 0) - (nb?.lane ?? 0);
  });
}

export function upstreamOf(nodeId: string, graph: WorkflowGraph): string[] {
  return unique(toEdgeList(graph).filter((e) => e.to === nodeId).map((e) => e.from));
}

export function downstreamOf(nodeId: string, graph: WorkflowGraph): WorkflowEdge[] {
  return toEdgeList(graph).filter((e) => e.from === nodeId);
}

export function nodeById(graph: WorkflowGraph, id: string): WorkflowNode | undefined {
  return (graph.nodes ?? []).find((n) => n.id === id);
}
