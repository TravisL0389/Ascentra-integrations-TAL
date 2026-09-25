import { arePortTypesCompatible, getPort, getPorts } from './definitions.js';
import { resolveBuilderKind } from './registry.js';
import { validateWorkflowGraph } from './validation.js';

function issue(code, message, nodeId = null, severity = 'error') {
  return { code, message, nodeId, severity };
}

export function wouldCreateCycle(nodes, edges, from, to) {
  if (!from || !to || from === to) return true;
  const ids = new Set(nodes.map((node) => node.id));
  if (!ids.has(from) || !ids.has(to)) return true;
  const outgoing = new Map(nodes.map((node) => [node.id, []]));
  [...edges, { from, to }].forEach((edge) => {
    if (outgoing.has(edge.from) && ids.has(edge.to)) outgoing.get(edge.from).push(edge.to);
  });
  const stack = [to];
  const seen = new Set();
  while (stack.length) {
    const current = stack.pop();
    if (current === from) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(outgoing.get(current) || []));
  }
  return false;
}

export function buildConnection(nodes, edges, from, to, options = {}) {
  const source = nodes.find((node) => String(node.id) === String(from));
  const target = nodes.find((node) => String(node.id) === String(to));
  if (!source || !target) return { ok: false, code: 'unknown_edge_endpoint', message: 'Both connected atoms must exist.' };
  if (String(from) === String(to)) return { ok: false, code: 'self_loop', message: 'An atom cannot connect to itself.' };
  const sourcePortId = options.sourcePortId || getPorts(source, 'output')[0]?.id;
  const targetPortId = options.targetPortId || getPorts(target, 'input')[0]?.id;
  const sourcePort = getPort(source, sourcePortId, 'output');
  const targetPort = getPort(target, targetPortId, 'input');
  if (!sourcePort || !targetPort) return { ok: false, code: 'connection_port_missing', message: 'The selected ports do not exist on these atoms.' };
  if (!arePortTypesCompatible(sourcePort.dataType, targetPort.dataType)) return { ok: false, code: 'port_type_mismatch', message: 'These ports accept incompatible data types.' };
  const label = options.label ?? (nextBranchLabel(nodes, edges, String(from)) || null);
  const duplicate = edges.some((edge) => String(edge.from) === String(from) && String(edge.to) === String(to) && String(edge.sourcePortId || sourcePortId) === String(sourcePortId) && String(edge.targetPortId || targetPortId) === String(targetPortId) && (edge.label || null) === label);
  if (duplicate) return { ok: false, code: 'duplicate_connection', message: 'These ports are already connected.' };
  if (wouldCreateCycle(nodes, edges, String(from), String(to))) return { ok: false, code: 'workflow_cycle', message: 'That connection would create a cycle.' };
  const id = options.id || `${from}:${sourcePortId}:${to}:${targetPortId}:${label || 'edge'}`;
  return { ok: true, edge: { id, from: String(from), to: String(to), sourcePortId, targetPortId, label, sortOrder: options.sortOrder ?? edges.length } };
}

export function nextBranchLabel(nodes, edges, sourceId) {
  const source = nodes.find((node) => node.id === sourceId);
  if (resolveBuilderKind(source) !== 'branch') return undefined;
  const used = new Set(edges.filter((edge) => edge.from === sourceId).map((edge) => edge.label));
  if (!used.has('true')) return 'true';
  if (!used.has('false')) return 'false';
  return undefined;
}

export function reachableUpstreamNodes(nodes, edges, nodeId) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map(nodes.map((node) => [node.id, []]));
  edges.forEach((edge) => incoming.get(edge.to)?.push(edge.from));
  const queue = [...(incoming.get(nodeId) || [])];
  const seen = new Set();
  const result = [];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (node) result.push(node);
    queue.push(...(incoming.get(id) || []));
  }
  return result.sort((a, b) => (a.column ?? 0) - (b.column ?? 0));
}

function compatibilityCode(entry, node) {
  if (entry.code === 'workflow_empty') return 'empty_workflow';
  if (entry.code === 'duplicate_node_id') return 'duplicate_node';
  if (entry.code === 'unknown_edge_endpoint') return 'dangling_connection';
  if (entry.code === 'self_loop') return 'self_connection';
  if (entry.code === 'trigger_missing') return 'missing_trigger';
  if (entry.code === 'unsupported_atomic_kind') return 'unsupported_atom';
  if (entry.code === 'workflow_cycle') return 'cycle';
  if (entry.code === 'config_invalid' && entry.field === 'url' && node && ['http', 'make'].includes(resolveBuilderKind(node))) return resolveBuilderKind(node) === 'http' ? 'http_url_missing' : 'make_url_missing';
  if (entry.code === 'config_required' && node && resolveBuilderKind(node) === 'ai' && entry.field === 'prompt') return 'ai_prompt_missing';
  if (entry.code === 'config_required' && node && resolveBuilderKind(node) === 'ai' && entry.field === 'connection') return 'ai_connection_missing';
  if (entry.code === 'config_required' && node && resolveBuilderKind(node) === 'branch' && entry.field === 'groups') return 'condition_missing';
  return entry.code;
}

export function validateWorkflow(nodes = [], edges = []) {
  const result = validateWorkflowGraph(nodes, edges);
  const nodeMap = new Map(nodes.map((node) => [String(node.id), node]));
  const issues = result.issues.map((entry) => {
    const node = entry.nodeId != null ? nodeMap.get(String(entry.nodeId)) : null;
    return { ...entry, code: compatibilityCode(entry, node) };
  });
  const seenEdges = new Set();
  edges.forEach((edge) => {
    const key = `${edge.from}:${edge.to}:${edge.label || ''}`;
    if (seenEdges.has(key)) issues.push(issue('duplicate_connection', 'This connection appears more than once.', edge.to));
    seenEdges.add(key);
  });
  const errors = issues.filter((entry) => entry.severity === 'error').length;
  const warnings = issues.length - errors;
  return { ...result, valid: errors === 0, issues, errors, warnings, summary: { ...result.summary, errors, warnings } };
}

export { validateWorkflowGraph };
