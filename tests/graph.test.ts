import { describe, it, expect } from 'vitest';
import {
  topologicalOrder,
  hasCycle,
  validateGraph,
  resolveOutboundEdges,
  computeFrontier,
  type ResolvedEdge,
} from '../supabase/functions/_shared/graph.ts';
import { TALError } from '../supabase/functions/_shared/errors.ts';
import type { WorkflowGraph } from '../supabase/functions/_shared/types.ts';

const graph: WorkflowGraph = {
  nodes: [
    { id: 'manual', type: 'manual', column_index: 0 },
    { id: 'transform', type: 'logic', column_index: 1 },
    { id: 'branch', type: 'logic', column_index: 2 },
    { id: 'http', type: 'integration', column_index: 3 },
    { id: 'false-path', type: 'integration', column_index: 3 },
  ],
  edges: [
    { from: 'manual', to: 'transform' },
    { from: 'transform', to: 'branch' },
    { from: 'branch', to: 'http', label: 'true' },
    { from: 'branch', to: 'false-path', label: 'false' },
  ],
};

describe('graph planner', () => {
  it('computes topological order', () => {
    const order = topologicalOrder(graph);
    expect(order[0]).toBe('manual');
    expect(order).toHaveLength(5);
    expect(order.indexOf('branch')).toBeGreaterThan(order.indexOf('manual'));
    expect(order.indexOf('branch')).toBeGreaterThan(order.indexOf('transform'));
  });

  it('detects cycles', () => {
    const cyclic: WorkflowGraph = {
      nodes: [{ id: 'a', type: 'manual' }, { id: 'b', type: 'http' }],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
    };
    expect(hasCycle(cyclic)).toBe(true);
    expect(hasCycle(graph)).toBe(false);
  });

  it('validates graphs', () => {
    expect(() => validateGraph(graph)).not.toThrow();
    expect(() =>
      validateGraph({ nodes: graph.nodes, edges: [{ from: 'manual', to: 'nope' }] }),
    ).toThrow(TALError);
    expect(() =>
      validateGraph({ nodes: [{ id: 'a', type: 'manual' }, { id: 'a', type: 'manual' }], edges: [] }),
    ).toThrow(TALError);
  });

  it('entry nodes are always ready', () => {
    const f = computeFrontier(graph, []);
    expect(f.ready).toContain('manual');
    expect(f.ready).toHaveLength(1);
  });

  it('resolves branch routes to open the taken path and close the other', () => {
    let progress: ResolvedEdge[] = [];
    progress = resolveOutboundEdges(progress, 'transform', graph, ['true']);
    const f1 = computeFrontier(graph, progress);
    expect(f1.ready).toContain('branch');

    progress = resolveOutboundEdges(progress, 'branch', graph, ['false']);
    const f2 = computeFrontier(graph, progress);
    // http has inbound edge labeled 'true' -> closed -> skipped
    expect(f2.skipped).toContain('http');
    // false-path has inbound edge labeled 'false' -> passes -> ready
    expect(f2.ready).toContain('false-path');
  });

  it('allows unlabeled edges to pass regardless of routes', () => {
    const g: WorkflowGraph = {
      nodes: [{ id: 'a', type: 'transform' }, { id: 'b', type: 'http' }],
      edges: [{ from: 'a', to: 'b' }],
    };
    let progress: ResolvedEdge[] = [];
    progress = resolveOutboundEdges(progress, 'a', g, []);
    const f = computeFrontier(g, progress);
    expect(f.ready).toContain('b');
  });

  it('treats explicit null edge labels as unlabeled', () => {
    const g: WorkflowGraph = {
      nodes: [{ id: 'a', type: 'manual' }, { id: 'b', type: 'logic' }],
      edges: [{ from: 'a', to: 'b', label: null }],
    };
    const progress = resolveOutboundEdges([], 'a', g, ['true']);
    const f = computeFrontier(g, progress);
    expect(f.ready).toContain('b');
    expect(f.skipped).not.toContain('b');
  });

  it('skip closure marks the dead subtree', () => {
    let progress: ResolvedEdge[] = [];
    progress = resolveOutboundEdges(progress, 'branch', graph, ['true'] as never, { closeAll: true });
    const f = computeFrontier(graph, progress);
    expect(f.skipped).toContain('false-path');
    expect(f.skipped).toContain('http');
  });
});
