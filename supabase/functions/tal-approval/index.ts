// tal-approval: approve or reject a pending approval gate.
//   POST { approvalId, action: "approve" | "reject", comment? }
// Member JWT required. Approving resolves the approval node's outbound edges
// (routes default to ['true'], overridable via node.config.routeOnApprove),
// enqueues the next jobs and wakes the worker. Rejecting cancels the execution.

import { json, getSupabase, errorResponse, pokeWorker, verifyMemberJwt } from '../_shared/edge.ts';
import { computeFrontier, resolveOutboundEdges, type ResolvedEdge } from '../_shared/graph.ts';
import { maxAttemptsFromNode } from '../_shared/retry.ts';
import { getExecution, loadWorkflowGraph } from '../_shared/db.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok');

  const userId = await verifyMemberJwt(request);
  if (!userId) return errorResponse('Unauthorized', 401);

  const supabase = getSupabase();
  let body: { approvalId?: string; action?: string; comment?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }
  const { approvalId, action, comment } = body;
  if (!approvalId || !['approve', 'reject'].includes(action ?? '')) {
    return errorResponse('approvalId and action ("approve"|"reject") are required');
  }

  const { data: approval, error: aerr } = await supabase
    .from('approvals')
    .select('*')
    .eq('id', approvalId)
    .maybeSingle();
  if (aerr || !approval) return errorResponse('Approval not found', 404);
  if (approval.status !== 'pending') return errorResponse('Approval already decided', 409);

  const { data: member } = await supabase
    .from('organization_memberships')
    .select('id')
    .eq('organization_id', approval.organization_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!member) return errorResponse('Not a member of this workspace', 403);

  if (action === 'reject') {
    await supabase
      .from('approvals')
      .update({ status: 'rejected', approver_id: userId, comment: comment ?? null, decided_at: new Date().toISOString() })
      .eq('id', approvalId);

    await supabase
      .from('execution_node_runs')
      .update({
        status: 'failed',
        error: { code: 'rejected', message: comment ? `Rejected: ${comment}` : 'Approval rejected' },
        finished_at: new Date().toISOString(),
      })
      .eq('execution_id', approval.execution_id)
      .eq('node_id', approval.node_id);

    await supabase
      .from('execution_jobs')
      .update({ status: 'canceled' })
      .eq('execution_id', approval.execution_id)
      .in('status', ['queued']);

    await supabase
      .from('executions')
      .update({
        status: 'canceled',
        error: { code: 'rejected', message: 'Approval rejected' },
        finished_at: new Date().toISOString(),
      })
      .eq('id', approval.execution_id);

    await supabase.from('execution_events').insert({
      execution_id: approval.execution_id,
      node_id: approval.node_id,
      event: 'approval.rejected',
      level: 'error',
      message: 'Approval rejected; execution canceled',
    });
    return json({ status: 'rejected' });
  }

  // --- Approve -------------------------------------------------------------
  await supabase
    .from('approvals')
    .update({ status: 'approved', approver_id: userId, comment: comment ?? null, decided_at: new Date().toISOString() })
    .eq('id', approvalId);

  const execution = await getExecution(supabase, approval.execution_id);
  if (!execution) return errorResponse('Execution not found', 404);
  const graph = execution.graph ?? { nodes: [], edges: [] };
  const node = (graph.nodes ?? []).find((n) => n.id === approval.node_id);
  const routes = (node?.config as { routeOnApprove?: string[] } | undefined)?.routeOnApprove ?? ['true'];

  // Approver's decision result becomes the node's output.
  await supabase
    .from('execution_node_runs')
    .update({
      status: 'succeeded',
      output: { approved: true, decidedAt: new Date().toISOString(), by: userId, routes },
      branch: routes[0] ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq('execution_id', approval.execution_id)
    .eq('node_id', approval.node_id);

  let progress: ResolvedEdge[] = resolveOutboundEdges(
    (execution.progress?.resolvedEdges ?? []) as ResolvedEdge[],
    approval.node_id,
    graph,
    routes,
  );

  // Update stored progress + schedule ready nodes (no skip closure needed on
  // approve: the graph has no dead paths by definition here).
  const frontier = computeFrontier(graph, progress);
  const merged = [...(execution.progress?.resolvedEdges ?? [])];
  for (const r of progress) {
    if (!merged.some((m) => m.from === r.from && m.to === r.to && m.label === r.label)) merged.push(r);
  }
  await supabase.from('executions').update({ status: 'running', progress: { resolvedEdges: merged } }).eq('id', approval.execution_id);
  await supabase.from('execution_events').insert({
    execution_id: approval.execution_id,
    node_id: approval.node_id,
    event: 'approval.approved',
    message: comment ? `Approved by ${userId}: ${comment}` : 'Approved',
  });

  for (const nodeId of frontier.ready) {
    const n = (graph.nodes ?? []).find((g) => g.id === nodeId);
    await supabase.rpc('enqueue_execution_job', {
      p_execution_id: approval.execution_id,
      p_node_id: nodeId,
      p_node_type: n?.type ?? 'unknown',
      p_attempt: 1,
      p_max_attempts: maxAttemptsFromNode(n?.retries),
      p_available_at: new Date().toISOString(),
      p_job_key: null,
    });
  }

  pokeWorker().catch(() => {});
  return json({ status: 'approved', executionId: approval.execution_id });
});