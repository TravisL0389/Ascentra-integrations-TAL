import { getNodeDefinition, getNodeKind, getPorts } from './definitions.js';
import { applyTransformConfig, evaluateGroups } from './mapping.js';
import { validateWorkflowGraph } from './validation.js';

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  return value;
}

function edgeEndpoints(edge, direction) {
  return direction === 'source' ? edge.from ?? edge.source ?? edge.sourceNodeId : edge.to ?? edge.target ?? edge.targetNodeId;
}

function edgeId(edge, index) {
  return String(edge.id ?? `${edgeEndpoints(edge, 'source')}:${edgeEndpoints(edge, 'target')}:${index}`);
}

function outputForNode(node, value) {
  const outputs = getPorts(node, 'output');
  const key = outputs[0]?.id || 'output';
  return { [key]: cloneValue(value), output: cloneValue(value) };
}

function scopeForInputs(triggerPayload, input) {
  const payload = cloneValue(triggerPayload || {});
  const inputValue = cloneValue(input);
  return { ...payload, trigger: payload, input: inputValue, previous: inputValue };
}

function boundaryResult(node, input) {
  const config = node.config || {};
  const payload = {
    kind: getNodeDefinition(node).kind,
    input: cloneValue(input),
  };
  if (config.url) payload.url = config.url;
  if (config.method) payload.method = config.method;
  if (config.credential || config.credentialRef) payload.credential = '[redacted]';
  return outputForNode(node, payload);
}

function runNode(node, input, context) {
  const definition = getNodeDefinition(node);
  if (definition.sideEffects || definition.simulation === 'boundary') {
    return { status: 'boundary', output: boundaryResult(node, input), reason: `${definition.kind} is an external boundary in local simulation.` };
  }
  if (definition.simulation === 'waiting' || definition.kind === 'approval') {
    return { status: 'waiting', output: outputForNode(node, input), reason: `${definition.kind} requires runtime interaction.` };
  }
  if (definition.kind === 'delay') {
    return { status: 'waiting', output: outputForNode(node, input), reason: `Delay is represented as ${node.config?.seconds ?? 0} seconds without waiting.` };
  }
  if (definition.kind === 'transform') {
    return { status: 'completed', output: outputForNode(node, applyTransformConfig(node.config || {}, context.scope)), reason: 'Mapping evaluated without side effects.' };
  }
  if (definition.kind === 'branch') {
    const matched = evaluateGroups(node.config?.groups, context.scope);
    return { status: 'completed', output: outputForNode(node, { matched, result: matched ? 'true' : 'false' }), branch: matched ? 'true' : 'false', reason: matched ? 'Condition matched true.' : 'No condition matched.' };
  }
  return { status: 'completed', output: outputForNode(node, input), reason: 'Node evaluated without side effects.' };
}

export function simulateWorkflow(workflow, options = {}) {
  const graph = workflow && typeof workflow === 'object' ? workflow : { nodes: [], edges: [] };
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const validation = options.skipValidation ? { valid: true, issues: [] } : validateWorkflowGraph(nodes, edges);
  if (!validation.valid) return { ok: false, mode: 'local', validation, trace: [], outputs: {}, boundaries: [] };
  const nodeMap = new Map(nodes.map((node) => [String(node.id), node]));
  const incoming = new Map(nodes.map((node) => [String(node.id), []]));
  const outgoing = new Map(nodes.map((node) => [String(node.id), []]));
  edges.forEach((edge, index) => {
    const from = String(edgeEndpoints(edge, 'source'));
    const to = String(edgeEndpoints(edge, 'target'));
    if (nodeMap.has(from) && nodeMap.has(to)) {
      incoming.get(to).push({ edge, index });
      outgoing.get(from).push({ edge, index });
    }
  });
  const activeEdges = new Set();
  const completed = new Set();
  const trace = [];
  const outputs = {};
  const boundaries = [];
  const triggerPayload = cloneValue(options.triggerPayload ?? options.input ?? {});
  let steps = 0;
  let progress = true;
  while (progress && steps < (options.maxSteps ?? 1000)) {
    progress = false;
    nodes.forEach((node) => {
      const id = String(node.id);
      if (completed.has(id)) return;
      const incomingEntries = incoming.get(id);
      const definition = getNodeDefinition(node);
      if (node.disabled === true) {
        const activeIncoming = incomingEntries.filter(({ index }) => activeEdges.has(index));
        if (!definition.isTrigger && incomingEntries.length && !activeIncoming.length) return;
        const input = activeIncoming.length ? activeIncoming[0] : triggerPayload;
        const output = outputForNode(node, input?.output ?? input);
        outputs[id] = output;
        completed.add(id);
        progress = true;
        outgoing.get(id).forEach(({ index }) => activeEdges.add(index));
        trace.push({ nodeId: id, status: 'skipped', output, reason: 'Node is disabled.' });
        return;
      }
      if (definition.isTrigger) {
        const output = outputForNode(node, triggerPayload);
        outputs[id] = output;
        completed.add(id);
        progress = true;
        outgoing.get(id).forEach(({ edge, index }) => activeEdges.add(index));
        trace.push({ nodeId: id, status: 'completed', output, edgeIds: outgoing.get(id).map(({ edge, index }) => edgeId(edge, index)) });
        return;
      }
      if (!incomingEntries.length) return;
      const activeIncoming = incomingEntries.filter(({ index }) => activeEdges.has(index));
      if (!activeIncoming.length) return;
      const input = activeIncoming.reduce((merged, { edge: incomingEdge }) => {
        const sourceId = String(edgeEndpoints(incomingEdge, 'source'));
        const sourceOutput = outputs[sourceId] || {};
        return sourceOutput.output !== undefined ? sourceOutput.output : sourceOutput;
      }, triggerPayload);
      const context = { scope: scopeForInputs(triggerPayload, input) };
      const result = runNode(node, input, context);
      completed.add(id);
      progress = true;
      outputs[id] = result.output;
      if (result.status === 'boundary') boundaries.push({ nodeId: id, kind: definition.kind, reason: result.reason });
      trace.push({ nodeId: id, status: result.status, output: result.output, reason: result.reason, branch: result.branch });
      outgoing.get(id).forEach(({ edge, index }) => {
        const sourceDefinition = getNodeDefinition(node);
        const routeMatches = sourceDefinition.kind !== 'branch' || String(edge.label || '').toLowerCase() === result.branch || (!edge.label && result.branch === 'true');
        if (routeMatches) activeEdges.add(index);
      });
    });
    steps += 1;
  }
  if (steps >= (options.maxSteps ?? 1000)) trace.push({ nodeId: null, status: 'error', reason: 'Simulation step limit reached.' });
  return {
    ok: true,
    mode: 'local',
    validation,
    trace,
    outputs,
    boundaries,
    completedNodeIds: [...completed],
    skippedNodeIds: nodes.filter((node) => !completed.has(String(node.id))).map((node) => String(node.id)),
  };
}

export function simulateNode(node, input = {}, context = {}) {
  return runNode(node, input, { scope: context.scope || scopeForInputs(context.triggerPayload || {}, input) });
}
