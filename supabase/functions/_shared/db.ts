// DB access helpers used by the worker and entry functions. All queries go
// through the service-role client (functions run server-side).

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { ExecutionJobRecord, ExecutionNodeRun, WorkflowGraph } from './types.ts';
import { maxAttemptsFromNode } from './retry.ts';

// Un-typed-tables client: our schema ships as raw SQL migrations, so suppress
// supabase-js's "never" default row type in favour of loose typing.
export type DbClient = SupabaseClient<any>;

export interface ExecutionRow {
  id: string;
  workflow_id: string | null;
  workflow_version_id: string | null;
  organization_id: string | null;
  trigger_type: string;
  payload: unknown;
  graph: WorkflowGraph;
  status: string;
  progress: { resolvedEdges?: { from: string; to: string; label?: string | null; closed: boolean }[] };
  started_at: string | null;
  finished_at: string | null;
  error: unknown;
  resume_token: string;
}

const TERMINAL = new Set(['completed', 'failed', 'canceled', 'timed_out']);

export async function getExecution(supabase: DbClient, id: string): Promise<ExecutionRow | null> {
  const { data, error } = await supabase.from('executions').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return { ...data, progress: data.progress ?? { resolvedEdges: [] } };
}

export function isTerminal(status: string): boolean {
  return TERMINAL.has(status);
}

export async function updateExecution(
  supabase: DbClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await supabase.from('executions').update(patch).eq('id', id);
}

export async function enqueueJob(
  supabase: DbClient,
  executionId: string,
  nodeId: string,
  nodeType: string,
  opts: { attempt?: number; maxAttempts?: number; availableAt?: string; jobKey?: string } = {},
): Promise<string | null> {
  const { data, error } = await supabase.rpc('enqueue_execution_job', {
    p_execution_id: executionId,
    p_node_id: nodeId,
    p_node_type: nodeType,
    p_attempt: opts.attempt ?? 1,
    p_max_attempts: opts.maxAttempts ?? 3,
    p_available_at: opts.availableAt ?? new Date().toISOString(),
    p_job_key: opts.jobKey ?? null,
  });
  if (error) {
    console.error('enqueue failed', error);
    return null;
  }
  return (data as string) ?? null;
}

export async function claimJobs(supabase: DbClient, limit: number, workerId: string): Promise<Array<{ job_id: string; execution_id: string; node_id: string; node_type: string; attempt: number; max_attempts: number }>> {
  const { data, error } = await supabase.rpc('claim_available_jobs', {
    p_limit: limit,
    p_worker_id: workerId,
  });
  if (error) throw error;
  return (data ?? []) as { job_id: string; execution_id: string; node_id: string; node_type: string; attempt: number; max_attempts: number }[];
}

export async function reapStaleJobs(supabase: DbClient, workerId: string): Promise<number> {
  const { data } = await supabase.rpc('reap_stale_jobs', { p_stale_after: '10 minutes' });
  return (data as number) ?? 0;
}

export async function setJobStatus(
  supabase: DbClient,
  jobId: string,
  status: 'completed' | 'failed' | 'canceled',
  error?: unknown,
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (error !== undefined) patch.error = error;
  await supabase.from('execution_jobs').update(patch).eq('id', jobId);
}

export interface NodeRunRow extends ExecutionNodeRun {
  retry_at?: string | null;
}

export async function getNodeRun(
  supabase: DbClient,
  executionId: string,
  nodeId: string,
  attempt: number,
): Promise<NodeRunRow | null> {
  const { data, error } = await supabase
    .from('execution_node_runs')
    .select('*')
    .eq('execution_id', executionId)
    .eq('node_id', nodeId)
    .eq('attempt', attempt)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function upsertNodeRun(supabase: DbClient, run: Partial<ExecutionNodeRun>): Promise<void> {
  await supabase.from('execution_node_runs').upsert(run as ExecutionNodeRun, {
    onConflict: 'execution_id,node_id,attempt',
  });
}

export async function latestNodeRun(
  supabase: DbClient,
  executionId: string,
  nodeId: string,
): Promise<NodeRunRow | null> {
  const { data, error } = await supabase
    .from('execution_node_runs')
    .select('*')
    .eq('execution_id', executionId)
    .eq('node_id', nodeId)
    .order('attempt', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function loadVariables(supabase: DbClient, orgId: string | null): Promise<Record<string, unknown>> {
  if (!orgId) return {};
  const { data, error } = await supabase
    .from('organization_variables')
    .select('key, value')
    .eq('organization_id', orgId);
  if (error || !data) return {};
  const out: Record<string, unknown> = {};
  for (const row of data) {
    // resolve a value stored as jsonb; keep primitives as-is
    out[row.key] = row.value !== null && typeof row.value === 'object'
      ? (row.value as Record<string, unknown>).__talValue ?? row.value
      : row.value;
  }
  return out;
}

export async function findCredentialByName(
  supabase: DbClient,
  orgId: string | null,
  name: string,
): Promise<{ id: string; name: string; provider: string; encrypted_data: string } | null> {
  if (!orgId) return null;
  const { data, error } = await supabase
    .from('credentials')
    .select('id, name, provider, encrypted_data')
    .eq('organization_id', orgId)
    .eq('name', name)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function findCredentialById(
  supabase: DbClient,
  orgId: string | null,
  id: string,
): Promise<{ id: string; name: string; provider: string; encrypted_data: string } | null> {
  if (!orgId) return null;
  const { data, error } = await supabase
    .from('credentials')
    .select('id, name, provider, encrypted_data')
    .eq('organization_id', orgId)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function findConnectionByName(
  supabase: DbClient,
  orgId: string | null,
  name: string,
): Promise<{ id: string; name: string; provider: string; credential_id: string | null; oauth_metadata?: Record<string, unknown> | null; scopes?: unknown } | null> {
  if (!orgId) return null;
  const { data, error } = await supabase
    .from('integration_connections')
    .select('id, name, provider, credential_id, oauth_metadata, scopes')
    .eq('organization_id', orgId)
    .eq('name', name)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function getOrgForWorkflow(supabase: DbClient, workflowId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('automation_flows')
    .select('organization_id')
    .eq('id', workflowId)
    .maybeSingle();
  if (error || !data) return null;
  return data.organization_id ?? null;
}

export async function loadWorkflowGraph(
  supabase: DbClient,
  workflowId: string,
): Promise<WorkflowGraph | null> {
  const { data: nodes } = await supabase
    .from('automation_nodes')
    .select('*')
    .eq('flow_id', workflowId);
  if (!nodes) return null;
  const { data: edges } = await supabase
    .from('automation_edges')
    .select('*')
    .eq('flow_id', workflowId);
  return {
    nodes: (nodes ?? []).map((n: Record<string, any>) => ({
      id: String(n.id),
      type: n.type ?? 'manual',
      title: n.title ?? '',
      subtitle: n.subtitle ?? '',
      lane: n.lane ?? 0,
      column_index: n.column_index ?? 0,
      config: n.config ?? undefined,
      kind: n.kind ?? undefined,
      definitionVersion: n.definition_version ?? undefined,
      disabled: n.disabled === true,
      makeConfig: n.make_config ?? undefined,
      retries: n.retries ?? 0,
      agent_id: n.agent_id ?? undefined,
    })),
    edges: (edges ?? []).map((e: Record<string, any>) => ({
      from: e.from_node_id,
      to: e.to_node_id,
      label: e.label ?? null,
      id: e.id ?? undefined,
      sourcePortId: e.source_port_id ?? undefined,
      targetPortId: e.target_port_id ?? undefined,
      sort_order: e.sort_order ?? 0,
    })),
  };
}

export async function cancelPendingJobs(supabase: DbClient, executionId: string): Promise<void> {
  await supabase
    .from('execution_jobs')
    .update({ status: 'canceled' })
    .eq('execution_id', executionId)
    .in('status', ['queued']);
}

// Enqueue frontier-ready nodes, skipping anything already recorded or queued.
export async function enqueueReadyNodes(
  supabase: DbClient,
  executionId: string,
  graph: WorkflowGraph,
  readyIds: string[],
  opts: { availableAt?: string } = {},
): Promise<void> {
  if (readyIds.length === 0) return;
  const { data: runs } = await supabase
    .from('execution_node_runs')
    .select('node_id')
    .eq('execution_id', executionId)
    .eq('attempt', 1);
  const recorded = new Set((runs ?? []).map((r: Record<string, any>) => r.node_id));
  const { data: jobs } = await supabase
    .from('execution_jobs')
    .select('node_id')
    .eq('execution_id', executionId)
    .in('status', ['queued', 'running']);
  const queued = new Set((jobs ?? []).map((r: Record<string, any>) => r.node_id));

  for (const nodeId of readyIds) {
    if (recorded.has(nodeId) || queued.has(nodeId)) continue;
    const node = (graph.nodes ?? []).find((n) => n.id === nodeId);
    await supabase.rpc('enqueue_execution_job', {
      p_execution_id: executionId,
      p_node_id: nodeId,
      p_node_type: node?.type ?? 'unknown',
      p_attempt: 1,
      p_max_attempts: maxAttemptsFromNode(node?.retries),
      p_available_at: opts.availableAt ?? new Date().toISOString(),
      p_job_key: null,
    });
  }
}

export async function writeEvent(
  supabase: DbClient,
  executionId: string,
  evt: { node_id?: string; event: string; level?: string; message: string; metadata?: Record<string, unknown> },
): Promise<void> {
  await supabase.from('execution_events').insert({
    execution_id: executionId,
    node_id: evt.node_id ?? null,
    event: evt.event,
    level: evt.level ?? 'info',
    message: evt.message,
    metadata: evt.metadata ?? {},
  });
}
