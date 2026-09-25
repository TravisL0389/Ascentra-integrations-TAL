import { getNodeDefinition, getNodeKind, getPorts } from './definitions.js';
import { isSafePath, validateExpression } from './mapping.js';

const supportedKinds = new Set(['manual', 'webhook', 'schedule', 'ai', 'agent', 'http', 'branch', 'approval', 'delay', 'transform', 'make']);

function issue(code, message, node = null, severity = 'error', extra = {}) {
  return { code, message, nodeId: node?.id ?? null, severity, ...extra };
}

function edgeEndpoint(edge, direction) {
  if (direction === 'source') return edge?.from ?? edge?.source ?? edge?.sourceNodeId ?? edge?.source_node_id ?? null;
  return edge?.to ?? edge?.target ?? edge?.targetNodeId ?? edge?.target_node_id ?? null;
}

function edgePortId(edge, direction, node) {
  const explicit = direction === 'source' ? edge?.sourcePortId ?? edge?.source_port_id : edge?.targetPortId ?? edge?.target_port_id;
  if (explicit != null) return String(explicit);
  return getPorts(node, direction === 'source' ? 'output' : 'input')[0]?.id || null;
}

function isValidHttpUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validCron(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const fields = value.trim().split(/\s+/);
  return [5, 6].includes(fields.length) && fields.every((field) => /^[\d*/?,\-A-Za-z]+$/.test(field));
}

function validateMapping(mapping, node, fieldKey = 'mapping') {
  const issues = [];
  if (mapping === undefined || mapping === null || (Array.isArray(mapping) && !mapping.length) || (typeof mapping === 'object' && !Array.isArray(mapping) && !Object.keys(mapping).length)) {
    return [issue('config_required', 'At least one mapped field is required.', node, 'error', { field: fieldKey })];
  }
  const entries = Array.isArray(mapping) ? mapping : Object.entries(mapping).map(([target, value]) => ({ target, path: value }));
  entries.forEach((entry, index) => {
    const target = entry?.target || entry?.to || `field_${index + 1}`;
    if (!isSafePath(target)) issues.push(issue('mapping_path_invalid', `Mapped field ${target} has an invalid path.`, node, 'error', { field: fieldKey }));
    const path = entry?.path ?? entry?.value;
    if (typeof path === 'string' && path.includes('{{')) {
      const result = validateExpression(path.replace(/\{\{([\s\S]*?)\}\}/g, '$1'), { required: true });
      result.issues.forEach((entryIssue) => issues.push(issue(entryIssue.code, `Mapped field ${target} is invalid.`, node, 'error', { field: fieldKey, detail: entryIssue.message })));
    } else if (path !== undefined && typeof path !== 'string' && typeof path !== 'number' && typeof path !== 'boolean' && path !== null) {
      issues.push(issue('mapping_value_invalid', `Mapped field ${target} has an invalid source.`, node, 'error', { field: fieldKey }));
    } else if (typeof path === 'string' && !isSafePath(path) && !path.includes('{{')) {
      issues.push(issue('mapping_source_invalid', `Mapped field ${target} has an invalid source.`, node, 'error', { field: fieldKey }));
    }
  });
  return issues;
}

function validateConditions(config, node) {
  const issues = [];
  const groups = config?.groups ?? config?.conditions;
  if (!Array.isArray(groups) || !groups.length) return [issue('config_required', 'At least one condition is required.', node, 'error', { field: 'groups' })];
  groups.forEach((group, groupIndex) => {
    const conditions = group?.conditions;
    if (!Array.isArray(conditions) || !conditions.length) {
      issues.push(issue('condition_group_empty', `Condition group ${groupIndex + 1} needs at least one condition.`, node, 'error', { field: 'groups' }));
      return;
    }
    conditions.forEach((condition, conditionIndex) => {
      if (!isSafePath(condition?.path)) issues.push(issue('condition_path_invalid', `Condition ${conditionIndex + 1} needs a valid input path.`, node, 'error', { field: 'groups' }));
      const operator = String(condition?.operator || '').toLowerCase();
      const operators = new Set(['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'exists', 'not_exists', 'is_empty', 'not_empty']);
      if (!operators.has(operator)) issues.push(issue('condition_operator_invalid', `Condition ${conditionIndex + 1} has an unsupported operator.`, node, 'error', { field: 'groups' }));
      if (!['exists', 'not_exists', 'is_empty', 'not_empty'].includes(operator) && (condition?.value === undefined || condition?.value === null || condition.value === '')) {
        issues.push(issue('condition_value_required', `Condition ${conditionIndex + 1} needs a comparison value.`, node, 'error', { field: 'groups' }));
      }
    });
  });
  return issues;
}

export function validateNodeConfig(node) {
  const definition = getNodeDefinition(node);
  const kind = definition.kind;
  const config = node?.config && typeof node.config === 'object' ? node.config : {};
  const issues = [];
  definition.configFields.forEach((descriptor) => {
    const value = config[descriptor.key];
    if (descriptor.required && (value === undefined || value === null || value === '')) issues.push(issue('config_required', `${descriptor.label} is required.`, node, 'error', { field: descriptor.key }));
    if (value !== undefined && value !== null && value !== '') {
      const valid = descriptor.type === 'number' ? typeof value === 'number' && Number.isFinite(value) : descriptor.type === 'boolean' ? typeof value === 'boolean' : descriptor.type === 'array' ? Array.isArray(value) : descriptor.type === 'json' || descriptor.type === 'mapping' || descriptor.type === 'conditions' ? Boolean(value) && typeof value === 'object' : typeof value === 'string';
      if (!valid) issues.push(issue('config_type', `${descriptor.label} has an invalid value.`, node, 'error', { field: descriptor.key }));
    }
  });
  if (kind === 'agent' || kind === 'ai') {
    if (!config.prompt && !config.input) issues.push(issue('config_required', 'Prompt is required.', node, 'error', { field: 'prompt' }));
    if (!config.connection && !config.credentialRef) issues.push(issue('config_required', 'AI connection is required.', node, 'error', { field: 'connection' }));
    if (config.temperature !== undefined && (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2)) issues.push(issue('config_range', 'Temperature must be between 0 and 2.', node, 'error', { field: 'temperature' }));
    if (config.maxTokens !== undefined && (typeof config.maxTokens !== 'number' || config.maxTokens < 1)) issues.push(issue('config_range', 'Max tokens must be a positive number.', node, 'error', { field: 'maxTokens' }));
  }
  if (kind === 'http' || kind === 'make') {
    const url = config.url || config.makeConfig?.webhookUrl;
    if (!isValidHttpUrl(url)) issues.push(issue('config_invalid', `${kind === 'make' ? 'Make' : 'HTTP'} URL is invalid.`, node, 'error', { field: 'url' }));
    const method = String(config.method || '').toUpperCase();
    if (kind === 'http' && method && !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) issues.push(issue('config_invalid', 'HTTP method is invalid.', node, 'error', { field: 'method' }));
  }
  if (kind === 'schedule' && !validCron(config.cronExpr)) issues.push(issue('config_invalid', 'Schedule cron expression is invalid.', node, 'error', { field: 'cronExpr' }));
  if (kind === 'delay') {
    if (typeof config.seconds !== 'number' || !Number.isFinite(config.seconds) || config.seconds < 0) issues.push(issue('config_range', 'Delay seconds must be a non-negative number.', node, 'error', { field: 'seconds' }));
  }
  if (kind === 'branch') issues.push(...validateConditions(config, node));
  if (kind === 'transform') issues.push(...validateMapping(config.mapping, node));
  return issues;
}

function validatePortTypes(sourceNode, targetNode, edge) {
  const issues = [];
  const sourcePortId = edgePortId(edge, 'source', sourceNode);
  const targetPortId = edgePortId(edge, 'target', targetNode);
  const sourcePort = getPorts(sourceNode, 'output').find((entry) => entry.id === sourcePortId);
  const targetPort = getPorts(targetNode, 'input').find((entry) => entry.id === targetPortId);
  if (!sourcePort) issues.push(issue('connection_port_missing', `Source port ${sourcePortId || 'output'} does not exist.`, targetNode, 'error', { edgeId: edge?.id, portId: sourcePortId, side: 'source' }));
  if (!targetPort) issues.push(issue('connection_port_missing', `Target port ${targetPortId || 'input'} does not exist.`, targetNode, 'error', { edgeId: edge?.id, portId: targetPortId, side: 'target' }));
  if (sourcePort && targetPort && sourcePort.dataType !== 'any' && targetPort.dataType !== 'any' && sourcePort.dataType !== targetPort.dataType) issues.push(issue('port_type_mismatch', 'Connected ports have incompatible data types.', targetNode, 'error', { edgeId: edge?.id, sourceType: sourcePort.dataType, targetType: targetPort.dataType }));
  return issues;
}

function reachableNodeIds(nodes, edges, entryIds) {
  const outgoing = new Map(nodes.map((node) => [String(node.id), []]));
  edges.forEach((edge) => {
    const from = edgeEndpoint(edge, 'source');
    const to = edgeEndpoint(edge, 'target');
    if (from != null && to != null && outgoing.has(String(from))) outgoing.get(String(from)).push(String(to));
  });
  const visited = new Set(entryIds.map(String));
  const queue = [...visited];
  while (queue.length) {
    const current = queue.shift();
    for (const next of outgoing.get(current) || []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

function hasCycle(nodes, edges) {
  const indegree = new Map(nodes.map((node) => [String(node.id), 0]));
  const outgoing = new Map(nodes.map((node) => [String(node.id), []]));
  edges.forEach((edge) => {
    const from = edgeEndpoint(edge, 'source');
    const to = edgeEndpoint(edge, 'target');
    if (from == null || to == null || !indegree.has(String(from)) || !indegree.has(String(to))) return;
    outgoing.get(String(from)).push(String(to));
    indegree.set(String(to), indegree.get(String(to)) + 1);
  });
  const queue = [...indegree.entries()].filter(([, count]) => count === 0).map(([id]) => id);
  let visited = 0;
  while (queue.length) {
    const current = queue.shift();
    visited += 1;
    for (const next of outgoing.get(current) || []) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  return visited !== nodes.length;
}

export function validateWorkflowGraph(nodes = [], edges = []) {
  const nodeList = Array.isArray(nodes) ? nodes : [];
  const edgeList = Array.isArray(edges) ? edges : [];
  const issues = [];
  const byNode = {};
  const byEdge = {};
  const nodeMap = new Map();
  const add = (node, entry) => {
    issues.push(entry);
    const key = String(node?.id ?? entry.nodeId ?? '');
    byNode[key] = [...(byNode[key] || []), entry];
    if (entry.edgeId != null) byEdge[String(entry.edgeId)] = [...(byEdge[String(entry.edgeId)] || []), entry];
  };
  if (!nodeList.length) {
    issues.push(issue('workflow_empty', 'Add at least one atom to the workflow.', null, 'error'));
    return { valid: false, issues, byNode, byEdge, summary: { errors: 1, warnings: 0, native: 0, total: nodeList.length } };
  }
  nodeList.forEach((node) => {
    const id = String(node?.id ?? '');
    if (!id) add(node, issue('node_id_required', 'Every atom needs an id.', node, 'error'));
    if (nodeMap.has(id)) add(node, issue('duplicate_node_id', `Atom id ${id} is duplicated.`, node, 'error'));
    nodeMap.set(id, node);
    const kind = getNodeDefinition(node).kind;
    if (!supportedKinds.has(kind)) add(node, issue('unsupported_atomic_kind', `Atom type ${kind} is not supported by the native execution engine.`, node, 'warning'));
    validateNodeConfig(node).forEach((entry) => add(node, entry));
  });
  const validEdges = [];
  edgeList.forEach((edge) => {
    const from = edgeEndpoint(edge, 'source');
    const to = edgeEndpoint(edge, 'target');
    const source = nodeMap.get(String(from));
    const target = nodeMap.get(String(to));
    if (!source || !target) {
      add(target || source || null, issue('unknown_edge_endpoint', 'Connection references an atom that does not exist.', target || source, 'error', { edgeId: edge?.id, from, to }));
      return;
    }
    validEdges.push(edge);
    if (String(from) === String(to)) add(target, issue('self_loop', 'An atom cannot connect to itself.', target, 'error', { edgeId: edge?.id }));
    validatePortTypes(source, target, edge).forEach((entry) => add(target, entry));
    if (getNodeDefinition(source).kind === 'branch' && !String(edge.label || '').trim()) add(target, issue('branch_route_unlabeled', 'Add a label to this branch route.', target, 'warning', { edgeId: edge?.id }));
  });
  const triggerNodes = nodeList.filter((node) => getNodeDefinition(node).isTrigger);
  if (!triggerNodes.length) add(null, issue('trigger_missing', 'Add a trigger atom to start the workflow.', null, 'error'));
  if (triggerNodes.length) {
    const reachable = reachableNodeIds(nodeList, validEdges, triggerNodes.map((node) => node.id));
    nodeList.forEach((node) => {
      if (!triggerNodes.some((trigger) => String(trigger.id) === String(node.id)) && !reachable.has(String(node.id))) add(node, issue('disconnected_atom', `Atom ${node.title || node.id} is not connected to a trigger.`, node, 'warning'));
    });
  }
  if (hasCycle(nodeList, validEdges)) add(null, issue('workflow_cycle', 'Workflow connections contain a cycle.', null, 'error'));
  const errors = issues.filter((entry) => entry.severity === 'error').length;
  const warnings = issues.filter((entry) => entry.severity === 'warning').length;
  return { valid: errors === 0, issues, byNode, byEdge, summary: { errors, warnings, native: nodeList.filter((node) => supportedKinds.has(getNodeDefinition(node).kind)).length, total: nodeList.length } };
}

export const validateWorkflow = validateWorkflowGraph;

export function getNodeIssueMap(result) {
  return result?.byNode || {};
}

export function isValidWorkflow(result) {
  return Boolean(result?.valid);
}

export function getValidationSummary(result) {
  return result?.summary || { errors: 0, warnings: 0, native: 0, total: 0 };
}
