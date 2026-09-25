// Shared execution entry logic: snapshot the current workflow graph into an
// immutable version, insert the execution row, seed entry-node jobs, and wake
// the worker. Used by create-execution, tal-hooks and tal-scheduler.

import { computeFrontier, validateGraph } from './graph.ts';
import { maxAttemptsFromNode } from './retry.ts';
import { pokeWorker, type SupabaseLike } from './edge.ts';
import type { DbClient } from './db.ts';
import type { WorkflowGraph, WorkflowNode } from './types.ts';

export function sanitizeGraph(graph: WorkflowGraph): WorkflowGraph {
  const trimNode = (n: WorkflowNode): WorkflowNode => ({
    id: n.id,
    type: n.type ?? 'manual',
    title: n.title ?? '',
    subtitle: n.subtitle ?? '',
    lane: n.lane ?? 0,
    column_index: n.column_index ?? 0,
    x: n.x ?? null,
    y: n.y ?? null,
    kind: n.kind ?? undefined,
    definitionVersion: n.definitionVersion ?? undefined,
    disabled: n.disabled === true,
    config: n.config ?? undefined,
    ...(n.makeConfig && typeof n.makeConfig === 'object' && Object.keys(n.makeConfig).length ? { makeConfig: n.makeConfig } : {}),
    ...(n.retries !== undefined ? { retries: n.retries } : {}),
    ...(n.agent_id !== undefined ? { agent_id: n.agent_id } : {}),
  });
  return {
    nodes: (graph.nodes ?? []).map(trimNode),
    edges: (graph.edges ?? []).map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      sourcePortId: e.sourcePortId ?? undefined,
      targetPortId: e.targetPortId ?? undefined,
      label: e.label ?? null,
      sort_order: e.sort_order ?? e.sortOrder ?? 0,
    })),
  };
}

export interface CreateExecutionOpts {
  workflowId: string;
  organizationId: string;
  graph: WorkflowGraph;
  triggerType: 'manual' | 'webhook' | 'schedule' | 'api' | 'resume';
  payload?: unknown;
  createdBy?: string | null;
}

export async function createExecution(
  supabase: DbClient,
  opts: CreateExecutionOpts,
): Promise<{ executionId: string }> {
  const graph = sanitizeGraph(opts.graph);
  if ((graph.nodes ?? []).length === 0) throw new Error('Workflow graph is empty');
  validateGraph(graph);

  // Capture an immutable history snapshot (next free version number).
  const { data: versionRow } = await supabase
    .from('workflow_versions')
    .select('version')
    .eq('workflow_id', opts.workflowId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = ((versionRow?.version as number) ?? 0) + 1;
  const { data: version, error: verr } = await supabase
    .from('workflow_versions')
    .insert({
      workflow_id: opts.workflowId,
      organization_id: opts.organizationId,
      version: nextVersion,
      status: 'draft',
      name: 'Run snapshot',
      summary: `Triggered by ${opts.triggerType}`,
      graph,
      created_by: opts.createdBy ?? null,
    })
    .select('id')
    .single();
  if (verr) throw new Error(`Failed to snapshot workflow: ${verr.message}`);

  const { data, error } = await supabase
    .from('executions')
    .insert({
      workflow_id: opts.workflowId,
      workflow_version_id: version?.id ?? null,
      organization_id: opts.organizationId,
      trigger_type: opts.triggerType,
      payload: opts.payload ?? { body: {}, headers: {}, method: 'POST' },
      graph,
      status: 'queued',
      created_by: opts.createdBy ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Failed to create execution: ${error?.message ?? 'unknown'}`);
  const executionId = data.id as string;

  const frontier = computeFrontier(graph, []);
  for (const nodeId of frontier.ready) {
    const node = (graph.nodes ?? []).find((n) => n.id === nodeId);
    const { error: jerr } = await supabase.rpc('enqueue_execution_job', {
      p_execution_id: executionId,
      p_node_id: nodeId,
      p_node_type: node?.type ?? 'manual',
      p_attempt: 1,
      p_max_attempts: maxAttemptsFromNode(node?.retries),
      p_available_at: new Date().toISOString(),
      p_job_key: null,
    });
    if (jerr) throw new Error(`Failed to enqueue entry node: ${jerr.message}`);
  }

  // Let the insert response commit before the fire-and-forget worker poke can
  // claim the newly enqueued job.
  setTimeout(() => { pokeWorker().catch(() => {}); }, 100);
  return { executionId };
}
