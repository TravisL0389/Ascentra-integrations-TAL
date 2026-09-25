// create-execution: snapshot the current workflow graph and enqueue an
// execution. Frontend calls this with a member JWT for manual runs. Service-role
// functions (hooks/scheduler) call their own paths and share the seeding logic.

import { json, getSupabase, errorResponse, verifyMemberJwt } from '../_shared/edge.ts';
import { createExecution } from '../_shared/createExecution.ts';
import { loadWorkflowGraph } from '../_shared/db.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok');

  const userId = await verifyMemberJwt(request);
  if (!userId) return errorResponse('Unauthorized', 401);

  const supabase = getSupabase();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }
  const workflowId = String(body.workflowId ?? body.flow_id ?? '');
  if (!workflowId) return errorResponse('workflowId is required');

  const { data: flow, error: ferr } = await supabase
    .from('automation_flows')
    .select('id, name, summary, organization_id, plan_name')
    .eq('id', workflowId)
    .maybeSingle();
  if (ferr || !flow) return errorResponse('Workflow not found', 404);

  const orgId = flow.organization_id as string | null;
  if (!orgId) return errorResponse('Workflow has no organization', 400);

  const { data: member, error: merr } = await supabase
    .from('organization_memberships')
    .select('id')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();
  if (merr || !member) return errorResponse('Not a member of this workspace', 403);

  // Prefer the live graph snapshot from the caller; fall back to the saved draft.
  let graph = (body.graph as { nodes: unknown[]; edges: unknown[] } | undefined) ?? null;
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    graph = await loadWorkflowGraph(supabase, workflowId);
  }
  if (!graph || (graph.nodes ?? []).length === 0) return errorResponse('Workflow graph is empty', 400);

  try {
    const { executionId } = await createExecution(supabase, {
      workflowId,
      organizationId: orgId,
      graph,
      triggerType: 'manual',
      payload: (body.payload as Record<string, unknown>) ?? { body: {}, headers: {}, method: 'POST' },
      createdBy: userId,
    });
    return json({ executionId, status: 'queued', workflowId });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Failed to create execution', 400);
  }
});