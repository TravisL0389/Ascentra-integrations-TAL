import { hasSupabaseConfig, supabase } from './supabaseClient.js';
import { buildVersionPayload, nextVersionNumber } from '../atom-builder/persistence.js';

function assertSupabase() {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect the backend.');
  }
}

function sanitizeNode(node, index) {
  return {
    id: node.id,
    flow_id: null,
    title: node.title,
    subtitle: node.subtitle,
    type: node.type,
    kind: node.kind ?? node.config?.kind ?? null,
    definition_version: node.definitionVersion ?? null,
    lane: node.lane ?? 0,
    column_index: node.column ?? index,
    x: node.x ?? null,
    y: node.y ?? null,
    color: node.color ?? null,
    agent_id: node.agentId ?? null,
    mode: node.mode ?? null,
    approval: node.approval ?? null,
    retries: Number(node.retries ?? 0),
    notes: node.notes ?? '',
    make_config: node.makeConfig ?? null,
    config: node.config ?? null,
    disabled: node.disabled === true,
  };
}

export async function saveAutomationFlow({
  flowId,
  flowName,
  flowSummary,
  planName,
  nodes,
  edges,
  organizationId = null,
  createdBy = null,
}) {
  assertSupabase();

  const flowPayload = {
    id: flowId || undefined,
    name: flowName,
    summary: flowSummary,
    plan_name: planName,
    organization_id: organizationId,
    created_by: createdBy,
  };

  const { data: flow, error: flowError } = await supabase
    .from('automation_flows')
    .upsert(flowPayload)
    .select('id, name, summary, plan_name, updated_at')
    .single();

  if (flowError) throw flowError;

  const nextFlowId = flow.id;

  await supabase.from('automation_edges').delete().eq('flow_id', nextFlowId);
  await supabase.from('automation_nodes').delete().eq('flow_id', nextFlowId);

  const nodeRows = nodes.map((node, index) => ({
    ...sanitizeNode(node, index),
    flow_id: nextFlowId,
  }));

  const edgeRows = edges.map((edge, index) => ({
    id: edge.id || undefined,
    flow_id: nextFlowId,
    from_node_id: edge.from,
    to_node_id: edge.to,
    label: edge.label ?? null,
    source_port_id: edge.sourcePortId ?? null,
    target_port_id: edge.targetPortId ?? null,
    sort_order: edge.sortOrder ?? index,
  }));

  if (nodeRows.length) {
    const { error: nodeError } = await supabase.from('automation_nodes').insert(nodeRows);
    if (nodeError) throw nodeError;
  }

  if (edgeRows.length) {
    const { error: edgeError } = await supabase.from('automation_edges').insert(edgeRows);
    if (edgeError) throw edgeError;
  }

  if (organizationId) {
    const { count: flowCount } = await supabase
      .from('automation_flows')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    await supabase
      .from('usage_counters')
      .update({ automations_saved: flowCount || 0 })
      .eq('organization_id', organizationId);
  }

  return flow;
}

export async function listAutomationFlows({ organizationId = null } = {}) {
  assertSupabase();
  let query = supabase
    .from('automation_flows')
    .select('id, name, summary, plan_name, version_id, published_version_id, updated_at, created_at')
    .order('updated_at', { ascending: false });

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function loadAutomationFlow(flowId, { organizationId = null } = {}) {
  assertSupabase();

  const [{ data: flow, error: flowError }, { data: nodes, error: nodesError }, { data: edges, error: edgesError }] = await Promise.all([
    (() => {
      let query = supabase
        .from('automation_flows')
        .select('id, name, summary, plan_name, organization_id, version_id, published_version_id, updated_at, created_at')
        .eq('id', flowId);

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      return query.single();
    })(),
    supabase
      .from('automation_nodes')
       .select('id, title, subtitle, type, kind, definition_version, lane, column_index, x, y, color, agent_id, mode, approval, retries, notes, make_config, config, disabled, created_at, updated_at')
      .eq('flow_id', flowId)
      .order('column_index', { ascending: true }),
    supabase
      .from('automation_edges')
       .select('id, from_node_id, to_node_id, source_port_id, target_port_id, sort_order, label')
      .eq('flow_id', flowId)
      .order('sort_order', { ascending: true }),
  ]);

  if (flowError) throw flowError;
  if (nodesError) throw nodesError;
  if (edgesError) throw edgesError;

  return {
    flow,
    nodes: nodes || [],
    edges: edges || [],
  };
}

export async function listWorkflowVersions(flowId, { organizationId = null } = {}) {
  assertSupabase();
  let query = supabase
    .from('workflow_versions')
    .select('id, workflow_id, organization_id, version, status, name, summary, graph, created_by, created_at, published_at')
    .eq('workflow_id', flowId)
    .order('version', { ascending: false });

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function saveWorkflowVersion(flowId, {
  name = '',
  summary = '',
  nodes = [],
  edges = [],
  organizationId = null,
  createdBy = null,
  status = 'draft',
  changeSummary = '',
} = {}) {
  assertSupabase();
  const versionPayload = buildVersionPayload({ nodes, edges }, { status, changeSummary });
  const { data: latest, error: latestError } = await supabase
    .from('workflow_versions')
    .select('version')
    .eq('workflow_id', flowId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw latestError;

  const { data, error } = await supabase
    .from('workflow_versions')
    .insert({
      workflow_id: flowId,
      organization_id: organizationId,
      version: nextVersionNumber(latest ? [latest] : []),
      status,
      name,
      summary,
      graph: versionPayload.graph,
      created_by: createdBy,
      published_at: status === 'published' ? new Date().toISOString() : null,
    })
    .select('id, workflow_id, organization_id, version, status, name, summary, graph, created_by, created_at, published_at')
    .single();

  if (error) throw error;
  return { ...data, revision: versionPayload.revision, changeSummary: versionPayload.changeSummary };
}

export async function deleteAutomationFlow(flowId, { organizationId = null } = {}) {
  assertSupabase();
  let query = supabase.from('automation_flows').delete().eq('id', flowId);
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  const { error } = await query;
  if (error) throw error;
}

export async function listAutomationRuns(flowId, { organizationId = null } = {}) {
  assertSupabase();

  let query = supabase
    .from('automation_runs')
    .select('id, flow_id, mode, plan_name, flow_name, status, summary, started_at, finished_at')
    .order('started_at', { ascending: false })
    .limit(10);

  if (flowId) {
    query = query.eq('flow_id', flowId);
  }

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function listAutomationRunSteps(runId) {
  assertSupabase();
  const { data, error } = await supabase
    .from('automation_run_steps')
    .select('id, node_id, node_title, status, response_preview, created_at')
    .eq('run_id', runId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getAutomationBackendStatus() {
  assertSupabase();
  const { data, error } = await supabase.functions.invoke('execute-automation', {
    body: {
      mode: 'health',
    },
  });

  if (error) throw error;
  return data;
}

export async function runAutomationNode({ flowId, node, flowName, flowSummary, planName }) {
  assertSupabase();
  const { data, error } = await supabase.functions.invoke('execute-automation', {
    body: {
      mode: 'node',
      flowId,
      flowName,
      flowSummary,
      planName,
      node,
    },
  });

  if (error) throw error;
  return data;
}

export async function runAutomationPath({ flowId, nodes, edges, flowName, flowSummary, planName }) {
  assertSupabase();
  const { data, error } = await supabase.functions.invoke('execute-automation', {
    body: {
      mode: 'path',
      flowId,
      flowName,
      flowSummary,
      planName,
      nodes,
      edges,
    },
  });

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Native execution engine (create-execution edge function + execution tables)
// ---------------------------------------------------------------------------

export async function runExecutionNative({ flowId, nodes, edges, payload, createdBy = null }) {
  assertSupabase();
  const graph = {
    schemaVersion: 1,
    nodes: (nodes || []).map((node) => ({
      id: node.id,
      title: node.title,
      subtitle: node.subtitle,
      type: node.type,
      kind: node.nativeKind ?? node.kind ?? node.config?.kind ?? node.type,
      definitionVersion: node.definitionVersion ?? null,
      lane: node.lane ?? 0,
      column: node.column ?? 0,
      column_index: node.column ?? 0,
      x: node.x ?? null,
      y: node.y ?? null,
      config: node.config ?? undefined,
      makeConfig: node.makeConfig ?? undefined,
      retries: Number(node.retries ?? 0),
      agent_id: node.agentId ?? null,
      disabled: node.disabled === true,
    })),
    edges: (edges || []).map((edge, index) => ({
      from: edge.from,
      to: edge.to,
      sourcePortId: edge.sourcePortId ?? edge.fromPortId ?? null,
      targetPortId: edge.targetPortId ?? edge.toPortId ?? null,
      id: edge.id ?? undefined,
      label: edge.label ?? null,
      sortOrder: edge.sortOrder ?? index,
      sort_order: edge.sortOrder ?? index,
    })),
  };

  const { data, error } = await supabase.functions.invoke('create-execution', {
    body: {
      flow_id: flowId,
      graph,
      trigger_type: 'manual',
      payload: payload ?? {},
      created_by: createdBy,
    },
  });

  if (error) throw error;
  if (!data?.executionId) {
    throw new Error(data?.error || 'Native execution failed to start.');
  }
  return data.executionId;
}

const TERMINAL_EXECUTION_STATUSES = new Set(['completed', 'failed', 'canceled', 'timed_out']);

export async function getExecutionDetail(executionId) {
  assertSupabase();
  const [{ data: execution, error: execError }, { data: nodeRuns, error: runsError }, { data: events, error: eventsError }] =
    await Promise.all([
      supabase.from('executions').select('*').eq('id', executionId).maybeSingle(),
      supabase
        .from('execution_node_runs')
        .select('*')
        .eq('execution_id', executionId)
        .order('attempt', { ascending: true }),
      supabase
        .from('execution_events')
        .select('*')
        .eq('execution_id', executionId)
        .order('created_at', { ascending: true }),
    ]);

  if (execError) throw execError;
  if (runsError) throw runsError;
  if (eventsError) throw eventsError;
  return { execution, nodeRuns: nodeRuns || [], events: events || [] };
}

export async function listNativeExecutions(flowId, { organizationId = null } = {}) {
  assertSupabase();
  let query = supabase
    .from('executions')
    .select('id, workflow_id, status, trigger_type, error, created_at, started_at, finished_at')
    .order('created_at', { ascending: false })
    .limit(25);

  if (flowId) query = query.eq('workflow_id', flowId);
  if (organizationId) query = query.eq('organization_id', organizationId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export { TERMINAL_EXECUTION_STATUSES };

// ---------------------------------------------------------------------------
// Execution controls (tal-executions edge function)
// ---------------------------------------------------------------------------

export async function listExecutions({ organizationId = null, workflowId = null } = {}) {
  assertSupabase();
  const body = { action: 'list' };
  if (organizationId) body.organizationId = organizationId;
  if (workflowId) body.workflowId = workflowId;
  const { data, error } = await supabase.functions.invoke('tal-executions', {
    method: 'POST',
    body,
  });
  if (error) throw error;
  return data?.executions || [];
}

export async function cancelExecution(executionId) {
  assertSupabase();
  const { data, error } = await supabase.functions.invoke('tal-executions', {
    method: 'POST',
    body: { action: 'cancel', executionId },
  });
  if (error) throw error;
  return data;
}

export async function retryExecution(executionId) {
  assertSupabase();
  const { data, error } = await supabase.functions.invoke('tal-executions', {
    method: 'POST',
    body: { action: 'retry', executionId },
  });
  if (error) throw error;
  return data;
}

export async function getExecutionConsole(executionId) {
  assertSupabase();
  const { data, error } = await supabase.functions.invoke('tal-executions', {
    method: 'POST',
    body: { action: 'detail', executionId },
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Connections + credentials (tal-connections edge function)
// ---------------------------------------------------------------------------

export async function listConnectionsAndCredentials() {
  assertSupabase();
  const { data, error } = await supabase.functions.invoke('tal-connections', {
    method: 'POST',
    body: { action: 'list' },
  });
  if (error) throw error;
  return data;
}

export async function createConnection({ organizationId, name, provider, credentialId = null, scopes = [] }) {
  assertSupabase();
  const { data, error } = await supabase.functions.invoke('tal-connections', {
    method: 'POST',
    body: { action: 'createConnection', organizationId, name, provider, credentialId, scopes },
  });
  if (error) throw error;
  return data;
}

export async function updateConnection(id, patch) {
  assertSupabase();
  const { data, error } = await supabase.functions.invoke('tal-connections', {
    method: 'POST',
    body: { action: 'updateConnection', id, ...patch },
  });
  if (error) throw error;
  return data;
}

export async function deleteConnection(id) {
  assertSupabase();
  const { data, error } = await supabase.functions.invoke('tal-connections', {
    method: 'POST',
    body: { action: 'deleteConnection', id },
  });
  if (error) throw error;
  return data;
}

export async function createCredential({ organizationId, name, provider, secret, isSecret = true }) {
  assertSupabase();
  const { data, error } = await supabase.functions.invoke('tal-connections', {
    method: 'POST',
    body: { action: 'createCredential', organizationId, name, provider, secret, isSecret },
  });
  if (error) throw error;
  return data;
}

export async function deleteCredential(id) {
  assertSupabase();
  const { data, error } = await supabase.functions.invoke('tal-connections', {
    method: 'POST',
    body: { action: 'deleteCredential', id },
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Approvals (tal-approval edge function + approvals table)
// ---------------------------------------------------------------------------

export async function listApprovals({ organizationId = null, status = 'pending' } = {}) {
  assertSupabase();
  let query = supabase
    .from('approvals')
    .select('id, organization_id, execution_id, node_id, title, message, status, comment, created_at, decided_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (status) query = query.eq('status', status);
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function decideApproval({ approvalId, action, comment = null }) {
  assertSupabase();
  const { data, error } = await supabase.functions.invoke('tal-approval', {
    method: 'POST',
    body: { approvalId, action, comment },
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Schedules / webhooks / variables (RLS-direct tables)
// ---------------------------------------------------------------------------

export async function listSchedules({ organizationId = null, workflowId = null } = {}) {
  assertSupabase();
  let query = supabase
    .from('workflow_schedules')
    .select('id, organization_id, workflow_id, name, trigger_type, interval_seconds, cron_expr, schedule_time, timezone, next_run_at, enabled, created_at')
    .order('created_at', { ascending: false });
  if (organizationId) query = query.eq('organization_id', organizationId);
  if (workflowId) query = query.eq('workflow_id', workflowId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function upsertSchedule(schedule) {
  assertSupabase();
  const { data, error } = await supabase.from('workflow_schedules').upsert(schedule).select('id').single();
  if (error) throw error;
  return data;
}

export async function deleteSchedule(id) {
  assertSupabase();
  const { error } = await supabase.from('workflow_schedules').delete().eq('id', id);
  if (error) throw error;
}

export async function listWebhooks({ organizationId = null, workflowId = null } = {}) {
  assertSupabase();
  let query = supabase
    .from('webhook_endpoints')
    .select('id, organization_id, workflow_id, token, name, method, enabled, created_at, last_request_at, last_status')
    .order('created_at', { ascending: false });
  if (organizationId) query = query.eq('organization_id', organizationId);
  if (workflowId) query = query.eq('workflow_id', workflowId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createWebhook({ organizationId, workflowId, name, method = 'POST' }) {
  assertSupabase();
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .insert({ organization_id: organizationId, workflow_id: workflowId, name: name || '', method })
    .select('id, token, name')
    .single();
  if (error) throw error;
  return data;
}

export async function toggleWebhook(id, enabled) {
  assertSupabase();
  const { error } = await supabase.from('webhook_endpoints').update({ enabled }).eq('id', id);
  if (error) throw error;
}

export async function deleteWebhook(id) {
  assertSupabase();
  const { error } = await supabase.from('webhook_endpoints').delete().eq('id', id);
  if (error) throw error;
}

export async function listVariables({ organizationId = null } = {}) {
  assertSupabase();
  let query = supabase
    .from('organization_variables')
    .select('id, organization_id, key, value_type, is_secret, created_at, updated_at')
    .order('created_at', { ascending: false });
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function upsertVariable(row) {
  assertSupabase();
  const { data, error } = await supabase
    .from('organization_variables')
    .upsert(row, { onConflict: 'organization_id,key' })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVariable(id) {
  assertSupabase();
  const { error } = await supabase.from('organization_variables').delete().eq('id', id);
  if (error) throw error;
}
