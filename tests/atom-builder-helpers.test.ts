import { describe, expect, it } from 'vitest';
import { getDefaultConfigForKind, getNodeDefinition, getPorts } from '../src/atom-builder/definitions.js';
import { applyMapping, evaluateSafeExpression, getValueAtPath, interpolateSafe, isSafePath } from '../src/atom-builder/mapping.js';
import { normalizeWorkflow, workflowFingerprint } from '../src/atom-builder/model.js';
import { validateWorkflowGraph } from '../src/atom-builder/validation.js';
import { simulateWorkflow } from '../src/atom-builder/simulation.js';
import { buildVersionPayload, detectSaveConflict, nextVersionNumber, saveDraft, loadDraft } from '../src/atom-builder/persistence.js';
import { buildExecutionView, normalizeExecutionStatus } from '../src/atom-builder/execution.js';

function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index: number): string | null { return [...values.keys()][index] || null; },
    getItem(key: string): string | null { return values.get(key) ?? null; },
    setItem(key: string, value: string): void { values.set(key, String(value)); },
    removeItem(key: string): void { values.delete(key); },
  };
}

describe('atom builder definitions and model', () => {
  it('exposes typed ports and versioned defaults', () => {
    const definition = getNodeDefinition({ type: 'agent' });
    expect(definition.nativeKind).toBe('ai');
    expect(getPorts({ type: 'agent' }, 'input')[0].dataType).toBe('any');
    expect(getDefaultConfigForKind('agent')).toMatchObject({ kind: 'ai', model: 'gpt-4o-mini' });
  });

  it('normalizes graph endpoints without mutating the source', () => {
    const source: any = { nodes: [{ id: 'a', type: 'trigger' }], edges: [{ from: 'a', to: 'b' }] };
    const graph = normalizeWorkflow(source);
    expect(graph.nodes[0].config.kind).toBe('manual');
    expect(graph.edges[0].sourcePortId).toBe('payload');
    expect(source.nodes[0].config).toBeUndefined();
    expect(workflowFingerprint(graph)).toBe(workflowFingerprint(normalizeWorkflow(graph)));
  });
});

describe('safe mapping utilities', () => {
  it('evaluates whitelisted expressions and interpolates values', () => {
    const scope = { input: { name: 'Ada' }, previous: { output: 'ready' } };
    expect(evaluateSafeExpression('uppercase(input.name)', scope)).toBe('ADA');
    expect(interpolateSafe('Hello {{ input.name }}', scope)).toBe('Hello Ada');
    expect(() => evaluateSafeExpression('fetch("/secret")', scope)).toThrow();
  });

  it('blocks prototype traversal and maps nested values', () => {
    expect(isSafePath('__proto__.polluted')).toBe(false);
    expect(getValueAtPath({ safe: { value: 4 } }, 'safe.value')).toBe(4);
    expect(applyMapping({ result: 'input.value' }, { input: { value: 4 } })).toEqual({ result: 4 });
  });
});

describe('workflow validation and simulation', () => {
  it('reports required config and connection errors', () => {
    const result = validateWorkflowGraph([
      { id: 'start', type: 'trigger' },
      { id: 'request', type: 'integration', title: 'HTTP', config: { kind: 'http', url: '' } },
    ], [{ from: 'start', to: 'request' }]);
    expect(result.valid).toBe(false);
    expect(result.issues.some((entry) => entry.field === 'url')).toBe(true);
  });

  it('walks a branch and marks external nodes as boundaries', () => {
    const result = simulateWorkflow({
      nodes: [
        { id: 'start', type: 'trigger' },
        { id: 'route', type: 'logic', config: { kind: 'branch', groups: [{ groupOperator: 'and', conditions: [{ path: 'trigger.body.amount', operator: 'greater_than', value: 100 }] }] } },
        { id: 'yes', type: 'logic', config: { kind: 'transform', mapping: { amount: 'input.amount' } } },
        { id: 'no', type: 'logic', config: { kind: 'transform', mapping: { amount: 'input.amount' } } },
        { id: 'remote', type: 'integration', config: { kind: 'http', url: 'https://example.com', method: 'POST' } },
      ],
      edges: [
        { from: 'start', to: 'route' },
        { from: 'route', to: 'yes', label: 'true' },
        { from: 'route', to: 'no', label: 'false' },
        { from: 'yes', to: 'remote' },
      ],
    }, { triggerPayload: { body: { amount: 300 } } });
    expect(result.ok).toBe(true);
    expect(result.completedNodeIds).toContain('yes');
    expect(result.completedNodeIds).not.toContain('no');
    expect(result.boundaries).toHaveLength(1);
  });

  it('skips disabled nodes while preserving the downstream route in simulation', () => {
    const result = simulateWorkflow({
      nodes: [
        { id: 'start', type: 'trigger' },
        { id: 'disabled', type: 'logic', disabled: true, config: { kind: 'transform', mapping: { value: 'input.value' } } },
        { id: 'next', type: 'logic', config: { kind: 'transform', mapping: { value: 'previous.output.value' } } },
      ],
      edges: [{ from: 'start', to: 'disabled' }, { from: 'disabled', to: 'next' }],
    }, { triggerPayload: { value: 7 } });
    expect(result.ok).toBe(true);
    expect(result.trace.find((entry) => entry.nodeId === 'disabled')?.status).toBe('skipped');
    expect(result.completedNodeIds).toContain('next');
  });
});

describe('persistence and execution adapters', () => {
  it('stores versioned drafts and detects revisions', () => {
    const storage = memoryStorage();
    const graph = { nodes: [{ id: 'start', type: 'trigger' }], edges: [] };
    const saved = saveDraft(graph, { flowId: 'flow-1', workflowId: 'workflow-1' }, storage);
    expect(saved.revision).toHaveLength(8);
    expect(loadDraft('flow-1', storage)?.graph.nodes[0].id).toBe('start');
    expect(nextVersionNumber([{ version: 2 }, { version: 4 }])).toBe(5);
    expect(detectSaveConflict({ expectedRevision: 'old', remoteGraph: graph, localGraph: graph }).conflict).toBe(true);
    expect(buildVersionPayload(graph).graph.nodes).toHaveLength(1);
  });

  it('normalizes execution status and aggregates node runs', () => {
    const view = buildExecutionView({ id: 'execution-1', status: 'completed' }, [
      { node_id: 'a', status: 'succeeded' },
      { node_id: 'b', status: 'failed' },
    ]);
    expect(normalizeExecutionStatus('success')).toBe('succeeded');
    expect(view.progress).toBe(100);
    expect(view.summary.failed).toBe(1);
  });
});
