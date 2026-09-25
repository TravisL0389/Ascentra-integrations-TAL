// tal-executions: execution control + inspection.
//   GET  /?executionId=<id>            list, or one execution detail
//   POST { action: "cancel", executionId }   cancel a runnable execution
//   POST { action: "retry",  executionId }   re-run a failed/canceled execution
//   POST { action: "list",   organizationId?, workflowId? }   list executions
//   POST { action: "detail", executionId }    full detail (runs/events/approvals)
// Member JWT required.

import { json, getSupabase, errorResponse, pokeWorker, verifyMemberJwt } from '../_shared/edge.ts';
import type { WorkflowGraph } from '../_shared/types.ts';
import { computeFrontier } from '../_shared/graph.ts';
import { maxAttemptsFromNode } from '../_shared/retry.ts';

const RUNNABLE = new Set(['queued', 'running', 'retry_scheduled', 'waiting', 'awaiting_approval']);
const RETRYABLE = new Set(['failed', 'canceled', 'timed_out']);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok');
  const userId = await verifyMemberJwt(request);
  if (!userId) return errorResponse('Unauthorized', 401);

  const supabase = getSupabase();
  const { data: orgRows } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', userId);
  const orgIds = (orgRows ?? []).map((r) => r.organization_id);

  let body: Record<string, unknown> = {};
  if (request.method === 'POST') {
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }
  } else if (request.method === 'GET') {
    const url = new URL(request.url);
    body = Object.fromEntries(url.searchParams.entries());
  } else {
    return errorResponse('Method not allowed', 405);
  }

  const action = (body.action as string) ?? 'list';

  // Lists.
  if (action === 'list' || request.method === 'GET' && !body.executionId) {
    const org = body.organizationId ? String(body.organizationId) : null;
    const workflowId = body.workflowId ? String(body.workflowId) : null;
    let query = supabase
      .from('executions')
      .select('id, workflow_id, workflow_version_id, organization_id, trigger_type, status, started_at, finished_at, duration_ms, error, created_at')
      .in('organization_id', orgIds)
      .order('started_at', { ascending: false })
      .limit(200);
    if (org && orgIds.includes(org)) query = query.eq('organization_id', org);
    if (workflowId) query = query.eq('workflow_id', workflowId);
    const { data, error } = await query;
    if (error) return errorResponse(error.message, 500);
    return json({ executions: data ?? [] });
  }

  const executionId = body.executionId ? String(body.executionId) : null;
  if (!executionId) return errorResponse('executionId required', 400);

  const { data: execution, error: execErr } = await supabase
    .from('executions')
    .select('*')
    .eq('id', executionId)
    .maybeSingle();
  if (execErr || !execution) return errorResponse('Execution not found', 404);
  if (!orgIds.includes(execution.organization_id)) return errorResponse('Not a member of this workspace', 403);

  // Detail.
  if (action === 'detail' || request.method === 'GET') {
    const [runs, events, approvals] = await Promise.all([
      supabase.from('execution_node_runs').select('*').eq('execution_id', executionId).order('created_at', { ascending: true }),
      supabase.from('execution_events').select('*').eq('execution_id', executionId).order('created_at', { ascending: true }),
      supabase.from('approvals').select('*').eq('execution_id', executionId),
    ]);
    return json({ execution, runs: runs.data ?? [], events: events.data ?? [], approvals: approvals.data ?? [] });
  }

  // Cancel.
  if (action === 'cancel') {
    if (!RUNNABLE.has(execution.status)) {
      return errorResponse(`Cannot cancel an execution in status "${execution.status}"`, 409);
    }
    const finishedAt = new Date().toISOString();
    await supabase
      .from('execution_jobs')
      .update({ status: 'canceled' })
      .eq('execution_id', executionId)
      .in('status', ['queued', 'running']);
    await supabase
      .from('execution_node_runs')
      .update({ status: 'canceled', finished_at: finishedAt })
      .eq('execution_id', executionId)
      .in('status', ['pending', 'queued', 'running', 'waiting', 'retrying']);
    await supabase
      .from('executions')
      .update({
        status: 'canceled',
        error: { code: 'canceled', message: 'Canceled by user' },
        finished_at: finishedAt,
        duration_ms: execution.started_at ? new Date(finishedAt).getTime() - new Date(execution.started_at).getTime() : null,
      })
      .eq('id', executionId);
    await supabase.from('execution_events').insert({
      execution_id: executionId,
      event: 'execution.canceled',
      level: 'warning',
      message: `Canceled by ${userId}`,
    });
    return json({ status: 'canceled', executionId });
  }

  // Retry.
  if (action === 'retry') {
    if (!RETRYABLE.has(execution.status)) {
      return errorResponse(`Cannot retry an execution in status "${execution.status}"`, 409);
    }
    const graph = (execution.graph ?? { nodes: [], edges: [] }) as WorkflowGraph;
    if ((graph.nodes ?? []).length === 0) return errorResponse('Execution has no graph to re-run', 400);

    const nowIso = new Date().toISOString();
    await supabase.from('execution_node_runs').delete().eq('execution_id', executionId);
    await supabase
      .from('execution_events')
      .delete()
      .eq('execution_id', executionId)
      .in('event', ['execution.completed', 'execution.failed', 'execution.canceled']);
    await supabase.from('approvals').delete().eq('execution_id', executionId);
    await supabase
      .from('executions')
      .update({ status: 'running', error: null, finished_at: null, duration_ms: null, progress: { resolvedEdges: [] }, started_at: nowIso })
      .eq('id', executionId);

    const frontier = computeFrontier(graph, []);
    for (const nodeId of frontier.ready) {
      const node = (graph.nodes ?? []).find((n) => n.id === nodeId);
      await supabase.rpc('enqueue_execution_job', {
        p_execution_id: executionId,
        p_node_id: nodeId,
        p_node_type: node?.type ?? 'manual',
        p_attempt: 1,
        p_max_attempts: maxAttemptsFromNode(node?.retries),
        p_available_at: new Date().toISOString(),
        p_job_key: null,
      });
    }
    await supabase.from('execution_events').insert({
      execution_id: executionId,
      event: 'execution.retried',
      message: `Retried by ${userId}`,
    });
    pokeWorker().catch(() => {});
    return json({ status: 'running', executionId });
  }

  return errorResponse('Not found', 404);
});
