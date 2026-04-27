import { hasSupabaseConfig, supabase } from './supabaseClient.js';

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
  };
}

export async function saveAutomationFlow({ flowId, flowName, flowSummary, planName, nodes, edges }) {
  assertSupabase();

  const flowPayload = {
    id: flowId || undefined,
    name: flowName,
    summary: flowSummary,
    plan_name: planName,
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
    flow_id: nextFlowId,
    from_node_id: edge.from,
    to_node_id: edge.to,
    sort_order: index,
  }));

  if (nodeRows.length) {
    const { error: nodeError } = await supabase.from('automation_nodes').insert(nodeRows);
    if (nodeError) throw nodeError;
  }

  if (edgeRows.length) {
    const { error: edgeError } = await supabase.from('automation_edges').insert(edgeRows);
    if (edgeError) throw edgeError;
  }

  return flow;
}

export async function listAutomationFlows() {
  assertSupabase();
  const { data, error } = await supabase
    .from('automation_flows')
    .select('id, name, summary, plan_name, updated_at, created_at')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function loadAutomationFlow(flowId) {
  assertSupabase();

  const [{ data: flow, error: flowError }, { data: nodes, error: nodesError }, { data: edges, error: edgesError }] = await Promise.all([
    supabase.from('automation_flows').select('id, name, summary, plan_name, updated_at, created_at').eq('id', flowId).single(),
    supabase
      .from('automation_nodes')
      .select('id, title, subtitle, type, lane, column_index, x, y, color, agent_id, mode, approval, retries, notes, make_config, created_at, updated_at')
      .eq('flow_id', flowId)
      .order('column_index', { ascending: true }),
    supabase
      .from('automation_edges')
      .select('id, from_node_id, to_node_id, sort_order')
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

export async function deleteAutomationFlow(flowId) {
  assertSupabase();
  const { error } = await supabase.from('automation_flows').delete().eq('id', flowId);
  if (error) throw error;
}

export async function listAutomationRuns(flowId) {
  assertSupabase();

  let query = supabase
    .from('automation_runs')
    .select('id, flow_id, mode, plan_name, flow_name, status, summary, started_at, finished_at')
    .order('started_at', { ascending: false })
    .limit(10);

  if (flowId) {
    query = query.eq('flow_id', flowId);
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
