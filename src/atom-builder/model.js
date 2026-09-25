import { getDefaultConfigForKind, getNodeDefinition, getNodeKind, getPorts } from './definitions.js';

export function cloneValue(value, seen = new WeakMap()) {
  if (Array.isArray(value)) {
    if (seen.has(value)) return seen.get(value);
    const copy = [];
    seen.set(value, copy);
    value.forEach((entry) => copy.push(cloneValue(entry, seen)));
    return copy;
  }
  if (value && typeof value === 'object') {
    if (seen.has(value)) return seen.get(value);
    const copy = {};
    seen.set(value, copy);
    Object.entries(value).forEach(([key, entry]) => {
      if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') copy[key] = cloneValue(entry, seen);
    });
    return copy;
  }
  return value;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function firstPortId(node, direction) {
  const ports = getPorts(node, direction);
  return ports[0]?.id || null;
}

function edgeEndpoint(edge, direction) {
  if (direction === 'source') return edge.from ?? edge.source ?? edge.sourceNodeId ?? edge.source_node_id ?? null;
  return edge.to ?? edge.target ?? edge.targetNodeId ?? edge.target_node_id ?? null;
}

export function normalizeNode(node) {
  const source = node && typeof node === 'object' ? node : {};
  const definition = getNodeDefinition(source);
  const configSource = source.config && typeof source.config === 'object' ? source.config : {};
  const config = { ...getDefaultConfigForKind(definition), ...cloneValue(configSource) };
  const kind = source.kind || configSource.kind || definition.kind;
  const id = String(source.id ?? source.nodeId ?? source.node_id ?? `${kind}-${Math.random().toString(36).slice(2, 9)}`);
  const title = String(source.title ?? source.name ?? definition.kind);
  const lane = finiteNumber(source.lane, finiteNumber(source.column, 0));
  const column = finiteNumber(source.column, lane);
  const normalized = {
    ...cloneValue(source),
    id,
    type: source.type || definition.kind,
    kind,
    title,
    lane,
    column,
    config,
    definitionVersion: source.definitionVersion ?? definition.version,
  };
  if (source.agentId != null) normalized.agentId = source.agentId;
  if (source.x !== undefined) normalized.x = finiteNumber(source.x, undefined);
  if (source.y !== undefined) normalized.y = finiteNumber(source.y, undefined);
  if (source.mindMapPosition !== undefined) normalized.mindMapPosition = cloneValue(source.mindMapPosition);
  return normalized;
}

export function normalizeEdge(edge, nodes = [], index = 0) {
  const source = edge && typeof edge === 'object' ? edge : {};
  const from = edgeEndpoint(source, 'source');
  const to = edgeEndpoint(source, 'target');
  const fromNode = nodes.find((node) => String(node?.id) === String(from));
  const toNode = nodes.find((node) => String(node?.id) === String(to));
  const sourcePortId = source.sourcePortId ?? source.source_port_id ?? source.sourcePort ?? firstPortId(fromNode, 'output');
  const targetPortId = source.targetPortId ?? source.target_port_id ?? source.targetPort ?? firstPortId(toNode, 'input');
  const label = source.label == null ? null : String(source.label);
  return {
    ...cloneValue(source),
    id: String(source.id ?? source.edgeId ?? source.edge_id ?? `${from}:${to}:${label || 'edge'}:${index}`),
    from: from == null ? null : String(from),
    to: to == null ? null : String(to),
    sourcePortId: sourcePortId == null ? null : String(sourcePortId),
    targetPortId: targetPortId == null ? null : String(targetPortId),
    label,
    sortOrder: finiteNumber(source.sortOrder ?? source.sort_order, index),
  };
}

export function normalizeWorkflow(workflow = {}) {
  const source = workflow && typeof workflow === 'object' ? workflow : {};
  const nodes = Array.isArray(source.nodes) ? source.nodes.map(normalizeNode) : [];
  const edges = Array.isArray(source.edges) ? source.edges.map((edge, index) => normalizeEdge(edge, nodes, index)) : [];
  return {
    ...cloneValue(source),
    schemaVersion: finiteNumber(source.schemaVersion ?? source.schema_version, 1),
    nodes,
    edges,
  };
}

export function serializeWorkflow(workflow) {
  return JSON.stringify(normalizeWorkflow(workflow));
}

export function deserializeWorkflow(value) {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = {};
    }
  }
  return normalizeWorkflow(parsed || {});
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

export function workflowFingerprint(workflow) {
  const normalized = normalizeWorkflow(workflow);
  const value = stableStringify({ nodes: normalized.nodes, edges: normalized.edges });
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function getNodeById(workflow, nodeId) {
  return normalizeWorkflow(workflow).nodes.find((node) => String(node.id) === String(nodeId)) || null;
}

export function getEdgeById(workflow, edgeId) {
  return normalizeWorkflow(workflow).edges.find((edge) => String(edge.id) === String(edgeId)) || null;
}

export function getOutgoingEdges(workflow, nodeId) {
  return normalizeWorkflow(workflow).edges.filter((edge) => String(edge.from) === String(nodeId));
}

export function getIncomingEdges(workflow, nodeId) {
  return normalizeWorkflow(workflow).edges.filter((edge) => String(edge.to) === String(nodeId));
}

export function updateNodeById(workflow, nodeId, updater) {
  const current = normalizeWorkflow(workflow);
  const update = typeof updater === 'function' ? updater : () => updater;
  return {
    ...current,
    nodes: current.nodes.map((node) => String(node.id) === String(nodeId) ? normalizeNode({ ...node, ...update(node) }) : node),
  };
}

export function removeNodeById(workflow, nodeId) {
  const current = normalizeWorkflow(workflow);
  return {
    ...current,
    nodes: current.nodes.filter((node) => String(node.id) !== String(nodeId)),
    edges: current.edges.filter((edge) => String(edge.from) !== String(nodeId) && String(edge.to) !== String(nodeId)),
  };
}

export function updateEdgeById(workflow, edgeId, updater) {
  const current = normalizeWorkflow(workflow);
  const update = typeof updater === 'function' ? updater : () => updater;
  return {
    ...current,
    edges: current.edges.map((edge) => String(edge.id) === String(edgeId) ? normalizeEdge({ ...edge, ...update(edge) }, current.nodes) : edge),
  };
}

export function removeEdgeById(workflow, edgeId) {
  const current = normalizeWorkflow(workflow);
  return { ...current, edges: current.edges.filter((edge) => String(edge.id) !== String(edgeId)) };
}

export function addNodeToWorkflow(workflow, node) {
  const current = normalizeWorkflow(workflow);
  return { ...current, nodes: [...current.nodes, normalizeNode(node)] };
}

export function addEdgeToWorkflow(workflow, edge) {
  const current = normalizeWorkflow(workflow);
  return { ...current, edges: [...current.edges, normalizeEdge(edge, current.nodes, current.edges.length)] };
}

export function getNodePosition(node) {
  if (Number.isFinite(node?.x) && Number.isFinite(node?.y)) return { x: node.x, y: node.y };
  const lane = finiteNumber(node?.lane, finiteNumber(node?.column, 0));
  const column = finiteNumber(node?.column, lane);
  return { x: 100 + column * 260, y: 100 + lane * 180 };
}

export function setNodePosition(node, position = {}) {
  return normalizeNode({
    ...node,
    x: finiteNumber(position.x, getNodePosition(node).x),
    y: finiteNumber(position.y, getNodePosition(node).y),
  });
}

export function getGraphBounds(workflow) {
  const { nodes } = normalizeWorkflow(workflow);
  if (!nodes.length) return null;
  const positions = nodes.map((node) => getNodePosition(node));
  return {
    minX: Math.min(...positions.map((position) => position.x)),
    minY: Math.min(...positions.map((position) => position.y)),
    maxX: Math.max(...positions.map((position) => position.x)),
    maxY: Math.max(...positions.map((position) => position.y)),
  };
}

export function getNodeKindForWorkflow(node) {
  return getNodeKind(node);
}
