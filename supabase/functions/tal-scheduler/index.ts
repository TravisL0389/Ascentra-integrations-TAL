// tal-scheduler: fires due workflow_schedules. Intended to be invoked on a
// timer (e.g. pg_cron, a cloud cron, or a manual poke). Each invocation:
//   1. finds enabled schedules whose next_run_at <= now
//   2. creates a 'schedule' execution for each (native graph snapshot)
//   3. rolls next_run_at forward
// Auth: TAL_WORKER_KEY header, or unauthenticated in local dev when the key is
// unset (this function does not mutate anything the caller controls).

import { json, getSupabase, errorResponse } from '../_shared/edge.ts';
import { createExecution } from '../_shared/createExecution.ts';
import { loadWorkflowGraph } from '../_shared/db.ts';
import { computeNextRun } from '../_shared/schedule.ts';

const BATCH = 25;
const WORKER_KEY = 'x-tal-worker-key';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok');

  const envKey = Deno.env.get('TAL_WORKER_KEY');
  const headerKey = request.headers.get(WORKER_KEY);
  if (envKey && headerKey !== envKey) {
    return errorResponse('Unauthorized', 401);
  }

  const supabase = getSupabase();
  const { data: due, error } = await supabase
    .from('workflow_schedules')
    .select('*')
    .eq('enabled', true)
    .lte('next_run_at', new Date().toISOString())
    .order('next_run_at', { ascending: true })
    .limit(BATCH);
  if (error) return errorResponse(error.message, 500);

  const fired: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const schedule of due ?? []) {
    const { data: flow, error: ferr } = await supabase
      .from('automation_flows')
      .select('id, organization_id')
      .eq('id', schedule.workflow_id)
      .maybeSingle();
    if (ferr || !flow) {
      failed.push({ id: schedule.id, error: 'workflow missing' });
      continue;
    }
    const graph = await loadWorkflowGraph(supabase, schedule.workflow_id);
    if (!graph) {
      failed.push({ id: schedule.id, error: 'empty graph' });
      continue;
    }
    try {
      await createExecution(supabase, {
        workflowId: schedule.workflow_id,
        organizationId: flow.organization_id as string,
        graph,
        triggerType: 'schedule',
        payload: { schedule: { id: schedule.id, name: schedule.name, triggerType: schedule.trigger_type } },
        createdBy: null,
      });
      fired.push(schedule.id);
    } catch (e) {
      failed.push({ id: schedule.id, error: e instanceof Error ? e.message : 'create failed' });
    }

    const next = computeNextRun(
      {
        triggerType: schedule.trigger_type,
        intervalSeconds: schedule.interval_seconds,
        cronExpr: schedule.cron_expr,
        scheduleTime: schedule.schedule_time,
      },
      new Date(),
    );
    await supabase
      .from('workflow_schedules')
      .update({ next_run_at: (next ?? new Date(Date.now() + 60_000)).toISOString() })
      .eq('id', schedule.id);
  }

  return json({ ok: true, fired, failed });
});