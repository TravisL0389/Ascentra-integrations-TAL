// tal-hooks: TAL-owned webhook trigger URL.
//   POST /functions/v1/tal-hooks            (uses `token` in body)
//   POST /functions/v1/tal-hooks/<token>    (path token)
//   GET  /functions/v1/tal-hooks/<token>    (query params become payload)
// Public by design: the token is the secret. Creates an execution from the
// endpoint's workflow snapshot and returns 202 with the execution id.

import { json, getSupabase, errorResponse } from '../_shared/edge.ts';
import { createExecution } from '../_shared/createExecution.ts';
import { loadWorkflowGraph } from '../_shared/db.ts';

function readBody(raw: string): Record<string, unknown> {
  if (!raw) return {};
  const t = raw.trim();
  if (t.startsWith('{')) {
    try {
      const parsed = JSON.parse(t);
      return parsed && typeof parsed === 'object' ? parsed : { raw: parsed };
    } catch {
      return {};
    }
  }
  return { raw: t };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok');

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const token = (pathParts[pathParts.length - 1] ?? url.searchParams.get('token') ?? '').trim();
  if (!token || token === 'tal-hooks') {
    return errorResponse('Missing webhook token', 400);
  }

  const supabase = getSupabase();
  const { data: hook, error: herr } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (herr || !hook) {
    // Do not leak whether an endpoint exists.
    return errorResponse('Webhook not found', 404);
  }
  if (!hook.enabled) {
    return json({ error: 'Webhook disabled' }, 410);
  }

  const { data: flow, error: ferr } = await supabase
    .from('automation_flows')
    .select('id, organization_id')
    .eq('id', hook.workflow_id)
    .maybeSingle();
  if (ferr || !flow) return errorResponse('Workflow not found', 404);

  const graph = await loadWorkflowGraph(supabase, hook.workflow_id);
  if (!graph) return errorResponse('Workflow has no graph', 400);

  const payload: Record<string, unknown> = {
    body: readBody(await request.text()),
    headers: Object.fromEntries(request.headers.entries()),
    method: request.method,
    query: Object.fromEntries(url.searchParams.entries()),
    webhook: { id: hook.id, token, name: hook.name },
  };

  // Sanity: notification-echo so callers get a fast receipt.
  await supabase
    .from('webhook_endpoints')
    .update({ last_request_at: new Date().toISOString(), last_status: 'received' })
    .eq('id', hook.id);

  try {
    const { executionId } = await createExecution(supabase, {
      workflowId: hook.workflow_id,
      organizationId: flow.organization_id as string,
      graph,
      triggerType: 'webhook',
      payload,
      createdBy: null,
    });
    return json({ accepted: true, executionId, id: hook.id }, 202);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Failed to create execution', 500);
  }
});