export const TERMINAL_EXECUTION_STATUSES = new Set(['succeeded', 'completed', 'success', 'failed', 'cancelled', 'canceled', 'rejected', 'timed_out', 'timeout']);
export const ACTIVE_EXECUTION_STATUSES = new Set(['queued', 'pending', 'running', 'in_progress', 'waiting_for_approval', 'awaiting_approval', 'paused']);

export function normalizeExecutionStatus(status) {
  const value = String(status || 'queued').toLowerCase().replace(/[\s-]+/g, '_');
  if (['complete', 'completed', 'success', 'succeeded'].includes(value)) return 'succeeded';
  if (['cancel', 'canceled', 'cancelled'].includes(value)) return 'cancelled';
  if (['timedout', 'timed_out', 'timeout'].includes(value)) return 'timed_out';
  if (['inprogress', 'in_progress', 'running', 'processing'].includes(value)) return 'running';
  if (['awaitingapproval', 'awaiting_approval', 'waitingforapproval', 'waiting_for_approval', 'approval_required'].includes(value)) return 'waiting_for_approval';
  if (['error', 'errored', 'failure', 'failed'].includes(value)) return 'failed';
  if (['paused', 'hold'].includes(value)) return 'paused';
  if (['pending', 'created', 'new'].includes(value)) return 'pending';
  return value || 'queued';
}

export function isTerminalExecutionStatus(status) {
  return TERMINAL_EXECUTION_STATUSES.has(normalizeExecutionStatus(status));
}

export function isActiveExecutionStatus(status) {
  return ACTIVE_EXECUTION_STATUSES.has(normalizeExecutionStatus(status));
}

export function normalizeNodeRun(run = {}) {
  const status = normalizeExecutionStatus(run.status || run.state);
  return {
    id: String(run.id ?? run.nodeRunId ?? run.node_run_id ?? ''),
    nodeId: String(run.nodeId ?? run.node_id ?? ''),
    status,
    startedAt: run.startedAt ?? run.started_at ?? null,
    finishedAt: run.finishedAt ?? run.finished_at ?? null,
    durationMs: Number(run.durationMs ?? run.duration_ms) || null,
    error: run.error ?? run.error_message ?? null,
    attempt: Number(run.attempt) || null,
  };
}

export function summarizeNodeRuns(runs = []) {
  const normalized = (Array.isArray(runs) ? runs : []).map(normalizeNodeRun);
  const summary = {
    total: normalized.length,
    succeeded: 0,
    failed: 0,
    running: 0,
    waiting: 0,
    skipped: 0,
    pending: 0,
    cancelled: 0,
  };
  normalized.forEach((run) => {
    if (run.status === 'succeeded') summary.succeeded += 1;
    else if (run.status === 'failed') summary.failed += 1;
    else if (run.status === 'running') summary.running += 1;
    else if (run.status === 'waiting_for_approval') summary.waiting += 1;
    else if (run.status === 'skipped') summary.skipped += 1;
    else if (run.status === 'cancelled') summary.cancelled += 1;
    else summary.pending += 1;
  });
  return { runs: normalized, summary };
}

export function buildExecutionView(execution = {}, nodeRuns = []) {
  const status = normalizeExecutionStatus(execution.status || execution.state);
  const summarized = summarizeNodeRuns(nodeRuns);
  const completed = summarized.runs.filter((run) => isTerminalExecutionStatus(run.status)).length;
  return {
    id: String(execution.id ?? execution.executionId ?? execution.execution_id ?? ''),
    status,
    progress: summarized.summary.total ? Math.round((completed / summarized.summary.total) * 100) : 0,
    workflowId: execution.workflowId ?? execution.workflow_id ?? null,
    version: execution.version ?? execution.workflowVersion ?? execution.workflow_version ?? null,
    startedAt: execution.startedAt ?? execution.started_at ?? null,
    finishedAt: execution.finishedAt ?? execution.finished_at ?? null,
    error: execution.error ?? execution.error_message ?? null,
    ...summarized,
  };
}

export function canCancelExecution(status) {
  return isActiveExecutionStatus(status);
}
