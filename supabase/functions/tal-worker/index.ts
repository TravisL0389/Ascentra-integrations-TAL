// tal-worker: native execution engine worker.
//
// Drains `execution_jobs`: claims atomically (FOR UPDATE SKIP LOCKED), executes
// each node's atom against the execution snapshot, persists node runs, resolves
// branch routes, schedules downstream jobs, handles delay/approval/retries.
//
// Invoked by pokes from create-execution/hooks/scheduler/approval, or by any
// cron/realtime trigger. Auth: x-tal-worker-key (TAL_WORKER_KEY) or a valid
// member JWT. Local dev falls back to unauthenticated when TAL_WORKER_KEY unset.

import { json, getSupabase, buildDnsResolver, errorResponse } from '../_shared/edge.ts';
import { decryptSecret } from '../_shared/crypto.ts';
import { computeFrontier, resolveOutboundEdges, validateGraph, type ResolvedEdge } from '../_shared/graph.ts';
import { runAtom, buildScope, atomFor } from '../_shared/atoms/registry.ts';
import { maxAttemptsFromNode, computeRetryAt, isRetryableError } from '../_shared/retry.ts';
import { asTALError } from '../_shared/errors.ts';
import { DEFAULT_HELPERS } from '../_shared/expression.ts';
import {
  claimJobs,
  reapStaleJobs,
  setJobStatus,
  upsertNodeRun,
  latestNodeRun,
  updateExecution,
  cancelPendingJobs,
  writeEvent,
  loadVariables,
  findCredentialByName,
  findCredentialById,
  findConnectionByName,
  getExecution,
  enqueueJob,
  enqueueReadyNodes,
  type ExecutionRow,
} from '../_shared/db.ts';
import type { AtomContext, WorkflowGraph, WorkflowNode } from '../_shared/types.ts';

interface ErrorShape {
  code?: string;
  message: string;
  retryable?: boolean;
}

const BATCH = 1;
const MAX_JOBS_PER_INVOCATION = 20;
const WORKER_BUDGET_MS = 15000;
const MAX_GRAPH_NODES = 500;

interface Claim {
  job_id: string;
  execution_id: string;
  node_id: string;
  node_type: string;
  attempt: number;
  max_attempts: number;
}

const RUNNABLE = new Set(['queued', 'running', 'retry_scheduled', 'waiting']);

async function withTimeout<T>(promise: Promise<T>, label: string, ms = 10000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function authorized(request: Request): Promise<boolean> {
  const envKey = Deno.env.get('TAL_WORKER_KEY');
  const header = request.headers.get('x-tal-worker-key') ?? request.headers.get('authorization');
  if (envKey && header === envKey) return true;

  // Also allow member JWTs so staff can poke the worker from the UI dev tools.
  if (header && header.startsWith('Bearer ')) {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getUser(header.slice(7));
    if (!error && data?.user?.id) return true;
  }
  // Local-dev fallback: no key configured => open (documented).
  return !envKey;
}

function nodeById(graph: WorkflowGraph, id: string): WorkflowNode | undefined {
  return (graph.nodes ?? []).find((n) => n.id === id);
}

function inboundEdgeKeys(graph: WorkflowGraph, nodeId: string): string[] {
  return (graph.edges ?? []).filter((e) => e.to === nodeId).map((e) => `${e.from}|${e.label ?? ''}`);
}

function edgeMatches(e: { from: string; to: string; label?: string | null }, from: string, label: string | null | undefined): boolean {
  return e.from === from && (e.label ?? null) === (label ?? null);
}

// Build this node's expression-scope inputs from resolved progress + upstream runs.
async function buildInputs(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  execution: ExecutionRow,
  nodeId: string,
): Promise<Record<string, { output?: unknown; branch?: string | null; status?: string }>> {
  const graph = execution.graph;
  const resolved: ResolvedEdge[] = (execution.progress?.resolvedEdges ?? []) as ResolvedEdge[];
  const inboundKeys = new Set(inboundEdgeKeys(graph, nodeId));
  const passed = resolved.filter((r) => r.to === nodeId && !r.closed && inboundKeys.has(`${r.from}|${r.label ?? ''}`));
  const inputs: Record<string, { output?: unknown; branch?: string | null; status?: string }> = {};
  for (const edge of passed) {
    if (inputs[edge.from] !== undefined) continue;
    const run = await latestNodeRun(supabase, execution.id, edge.from);
    inputs[edge.from] = {
      output: run?.output ?? undefined,
      branch: run?.branch ?? edge.label ?? null,
      status: run?.status,
    };
  }
  return inputs;
}

// Resolve skips transitively: skipped paths close their outbound edges and mark
// the downstream subtree skipped, recursively, until the frontier stabilizes.
async function applySkipClosure(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  execution: ExecutionRow,
  progress: ResolvedEdge[],
): Promise<ResolvedEdge[]> {
  const graph = execution.graph;
  let frontier = computeFrontier(graph, progress);
  await writeEvent(supabase, execution.id, {
    event: 'worker.frontier',
    message: 'Computed worker frontier',
    metadata: {
      ready: frontier.ready,
      skipped: frontier.skipped,
      blocked: frontier.blocked,
      resolved_edges: progress.map((edge) => ({ from: edge.from, to: edge.to, label: edge.label ?? null, closed: edge.closed })),
    },
  });
  const skipped = new Set<string>();
  while (frontier.skipped.length > 0) {
    for (const id of frontier.skipped) {
      if (skipped.has(id)) {
        console.warn(JSON.stringify({ event: 'worker.skip_guard', execution_id: execution.id, node_id: id }));
        return progress;
      }
      skipped.add(id);
      await upsertNodeRun(supabase, {
        execution_id: execution.id,
        node_id: id,
        node_type: nodeById(graph, id)?.type ?? 'unknown',
        attempt: 1,
        status: 'skipped',
        output: null,
      });
      await writeEvent(supabase, execution.id, {
        node_id: id,
        event: 'node.skipped',
        message: `Node skipped (dead branch)`,
      });
      progress = resolveOutboundEdges(progress, id, graph, [], { closeAll: true });
    }
    frontier = computeFrontier(graph, progress);
  }
  return progress;
}

async function maybeFinalize(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  execution: ExecutionRow,
): Promise<void> {
  if (!['running', 'retry_scheduled', 'waiting', 'queued'].includes(execution.status)) return;

  const { count: pending, error: jerr } = await supabase
    .from('execution_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('execution_id', execution.id)
    .in('status', ['queued', 'running']);
  if (jerr) return;
  if ((pending ?? 0) > 0) return;

  const { count: waiting, error: werr } = await supabase
    .from('execution_node_runs')
    .select('id', { count: 'exact', head: true })
    .eq('execution_id', execution.id)
    .in('status', ['waiting', 'retrying', 'queued', 'running']);
  if (werr) return;
  if ((waiting ?? 0) > 0) return;

  const { count: approvals, error: aerr } = await supabase
    .from('approvals')
    .select('id', { count: 'exact', head: true })
    .eq('execution_id', execution.id)
    .eq('status', 'pending');
  if (aerr) return;
  if ((approvals ?? 0) > 0) return;

  const finished = new Date().toISOString();
  const durationMs = execution.started_at ? new Date(finished).getTime() - new Date(execution.started_at).getTime() : null;
  await updateExecution(supabase, execution.id, { status: 'completed', finished_at: finished, duration_ms: durationMs });
  await writeEvent(supabase, execution.id, { event: 'execution.completed', message: 'Execution completed' });
}

async function handleFailure(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  execution: ExecutionRow,
  claim: Claim,
  node: WorkflowNode | undefined,
  error: ErrorShape,
): Promise<{ handled: boolean }> {
  const retryable = isRetryableError(error as { retryable?: boolean; code?: string });
  const maxAttempts = claim.max_attempts || maxAttemptsFromNode(node?.retries) || 3;

  if (retryable && claim.attempt < maxAttempts) {
    const retryAtMs = computeRetryAt(Date.now(), claim.attempt, {
      maxAttempts,
      baseDelayMs: 1000,
      factor: 2,
      maxDelayMs: 60000,
      jitter: true,
    });
    const retryAt = retryAtMs ? new Date(retryAtMs).toISOString() : null;
    await upsertNodeRun(supabase, {
      execution_id: execution.id,
      node_id: claim.node_id,
      node_type: node?.type ?? claim.node_type,
      attempt: claim.attempt,
      status: 'retrying',
      error,
      retry_at: retryAt ?? undefined,
    });
    if (retryAt) {
      await enqueueJob(supabase, execution.id, claim.node_id, claim.node_type, {
        attempt: claim.attempt + 1,
        maxAttempts,
        availableAt: retryAt,
      });
      await updateExecution(supabase, execution.id, { status: 'retry_scheduled' });
      await writeEvent(supabase, execution.id, {
        node_id: claim.node_id,
        event: 'node.retry_scheduled',
        message: `Retry ${claim.attempt + 1} scheduled`,
      });
    }
    return { handled: true };
  }

  const failed = { code: error?.code ?? 'internal', message: error?.message ?? 'Execution failed', retryable: false };
  await upsertNodeRun(supabase, {
    execution_id: execution.id,
    node_id: claim.node_id,
    node_type: node?.type ?? claim.node_type,
    attempt: claim.attempt,
    status: 'failed',
    error: failed,
  });
  await updateExecution(supabase, execution.id, {
    status: 'failed',
    error: failed,
    finished_at: new Date().toISOString(),
  });
  await cancelPendingJobs(supabase, execution.id);
  await writeEvent(supabase, execution.id, {
    node_id: claim.node_id,
    event: 'execution.failed',
    level: 'error',
    message: failed.message,
  });
  return { handled: true };
}

async function processClaim(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  claim: Claim,
): Promise<void> {
  const execution = await withTimeout(getExecution(supabase, claim.execution_id), 'get execution');
  if (!execution) {
    await setJobStatus(supabase, claim.job_id, 'canceled', { message: 'Execution not found' });
    return;
  }
  const graph = execution.graph ?? { nodes: [], edges: [] };
  if ((graph.nodes ?? []).length > MAX_GRAPH_NODES) {
    await handleFailure(supabase, execution, claim, undefined, { code: 'graph_limit', message: 'Workflow exceeds the native node limit', retryable: false });
    await setJobStatus(supabase, claim.job_id, 'failed', { code: 'graph_limit', message: 'Workflow exceeds the native node limit' });
    return;
  }
  try {
    validateGraph(graph);
  } catch (e) {
    const error = { code: 'invalid_graph', message: e instanceof Error ? e.message : 'Invalid workflow graph', retryable: false };
    await handleFailure(supabase, execution, claim, undefined, error);
    await setJobStatus(supabase, claim.job_id, 'failed', error);
    return;
  }
  const node = nodeById(graph, claim.node_id);
  if (!node) {
    await setJobStatus(supabase, claim.job_id, 'canceled', { message: `Node ${claim.node_id} not in graph` });
    await writeEvent(supabase, execution.id, { node_id: claim.node_id, event: 'node.missing', level: 'error', message: 'Node missing from graph snapshot' });
    return;
  }

  if (!RUNNABLE.has(execution.status) || execution.status === 'canceled') {
    await setJobStatus(supabase, claim.job_id, 'completed', { message: 'dropped: execution not runnable' });
    return;
  }

  const previousRun = await withTimeout(latestNodeRun(supabase, execution.id, claim.node_id), 'load existing node run');
  if (previousRun && previousRun.attempt === claim.attempt && ['succeeded', 'skipped'].includes(previousRun.status)) {
    console.log(JSON.stringify({ event: 'worker.dedup', execution_id: execution.id, job_id: claim.job_id, node_id: claim.node_id, attempt: claim.attempt }));
    await setJobStatus(supabase, claim.job_id, 'completed', { message: 'Node attempt already finalized' });
    return;
  }

  await withTimeout(updateExecution(supabase, execution.id, { status: 'running' }), 'mark execution running');

  const inputs = await withTimeout(buildInputs(supabase, execution, claim.node_id), 'build inputs');
  const variables = await withTimeout(loadVariables(supabase, execution.organization_id), 'load variables');
  const scope = buildScope({
    nodeId: claim.node_id,
    inputs,
    trigger: (execution.payload as Record<string, unknown>) ?? null,
    variables,
    execution: { id: execution.id, workflowId: execution.workflow_id, startedAt: execution.started_at },
  });

  // Decrypt credential for native provider atoms (ai / provider / http-with-auth).
  let credential: Record<string, unknown> | undefined;
  let connection: Record<string, unknown> | undefined;
  let credentialError: ErrorShape | undefined;
  const config = (node.config ?? {}) as Record<string, unknown>;
  const atomType = atomFor(node).type;
  const isAi = atomType === 'ai';
  const isProvider = atomType === 'provider';
  const isHttpWithAuth = atomType === 'http' && Boolean(config.connection || config.credential);
  if (!node.disabled && (isAi || isProvider || isHttpWithAuth)) {
    // Resolve via an explicit connection reference first, else by credential by
    // name, else (ai) fall back to the provider name as a credential name.
    const connectionRef = (config.connection as string) ?? undefined;
    const credentialRef = (config.credential as string) ?? (config.credentialRef as string) ?? (isProvider ? undefined : ((config.provider as string) ?? 'openai'));
    let cred: Awaited<ReturnType<typeof findCredentialByName>> | null = null;
    if (connectionRef) {
      const conn = await findConnectionByName(supabase, execution.organization_id, connectionRef);
      if (conn) {
        connection = conn as unknown as Record<string, unknown>;
        await supabase.from('integration_connections').update({ last_used_at: new Date().toISOString() }).eq('id', conn.id);
        cred = conn.credential_id
          ? await findCredentialById(supabase, execution.organization_id, conn.credential_id)
          : null;
      } else {
        credentialError = { code: 'credential_missing', message: `No connection named "${connectionRef}"`, retryable: false };
      }
    } else if (credentialRef) {
      cred = await findCredentialByName(supabase, execution.organization_id, credentialRef);
    }
    if (cred) {
      try {
        const plain = await decryptSecret(cred.encrypted_data);
        credential = JSON.parse(plain);
      } catch (e) {
        credentialError = { code: 'credential_decrypt_failed', message: e instanceof Error ? e.message : 'Credential decryption failed', retryable: true };
      }
    } else if (!credential && !credentialError) {
      credentialError = { code: 'credential_missing', message: `No credential resolved for this node`, retryable: false };
    }
  }

  if (credentialError) {
    await handleFailure(supabase, execution, claim, node, credentialError);
    await setJobStatus(supabase, claim.job_id, 'failed', credentialError);
    return;
  }

  const startedAt = new Date().toISOString();
  await withTimeout(upsertNodeRun(supabase, {
    execution_id: execution.id,
    node_id: claim.node_id,
    node_type: node.type ?? claim.node_type,
    attempt: claim.attempt,
    status: 'running',
    input: inputs,
    started_at: startedAt,
  }), 'create node run');

  let result: Awaited<ReturnType<typeof runAtom>>;
  try {
    result = await runAtom({
      node,
      graph,
      scope,
      variables,
      trigger: (execution.payload as Record<string, unknown>) ?? null,
      helpers: DEFAULT_HELPERS,
      now: () => new Date().toISOString(),
      credential,
      connection: connection as Record<string, unknown> | null,
      resolveDns: buildDnsResolver(),
      onEvent: (evt) => writeEvent(supabase, execution.id, evt),
    });
  } catch (e) {
    const err = asTALError(e).toJSON();
    result = { output: null, status: 'failed', routes: [], error: err };
  }

  const finishedAt = new Date().toISOString();
  const durationMs = Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime());

  // --- Approval -------------------------------------------------------------
  if (result.approval) {
    const { data, error: aerr } = await supabase.from('approvals').insert({
      organization_id: execution.organization_id,
      execution_id: execution.id,
      node_id: claim.node_id,
      title: result.approval.title ?? node.title ?? 'Approval required',
      message: result.approval.message ?? '',
      status: 'pending',
    }).select('id').single();
    if (aerr) {
      await setJobStatus(supabase, claim.job_id, 'failed', aerr);
      return;
    }
    await upsertNodeRun(supabase, {
      execution_id: execution.id,
      node_id: claim.node_id,
      node_type: node.type ?? claim.node_type,
      attempt: claim.attempt,
      status: 'waiting',
      output: result.output,
      finished_at: finishedAt,
      duration_ms: durationMs,
    });
    await updateExecution(supabase, execution.id, { status: 'awaiting_approval' });
    await writeEvent(supabase, execution.id, {
      node_id: claim.node_id,
      event: 'approval.requested',
      message: `Waiting for approval (${data?.id ?? 'n/a'})`,
    });
    await setJobStatus(supabase, claim.job_id, 'completed');
    return;
  }

  // --- Delay ----------------------------------------------------------------
  if (typeof result.delayMs === 'number' && result.delayMs > 0) {
    await upsertNodeRun(supabase, {
      execution_id: execution.id,
      node_id: claim.node_id,
      node_type: node.type ?? claim.node_type,
      attempt: claim.attempt,
      status: 'succeeded',
      output: result.output,
      finished_at: finishedAt,
      duration_ms: durationMs,
    });
    await writeEvent(supabase, execution.id, {
      node_id: claim.node_id,
      event: 'node.delayed',
      message: `Delaying ${result.delayMs}ms before continuing`,
    });
    const progress: ResolvedEdge[] = resolveOutboundEdges(
      (execution.progress?.resolvedEdges ?? []) as ResolvedEdge[],
      claim.node_id,
      graph,
      result.routes ?? ['true'],
    );
    const delayedAt = new Date(Date.now() + result.delayMs).toISOString();
    const next = (execution.progress?.resolvedEdges ?? []) as ResolvedEdge[];
    const merged = [...next];
    for (const r of progress) {
      if (!merged.some((m) => m.from === r.from && m.to === r.to && m.label === r.label)) merged.push(r);
    }
    const afterSkip = await applySkipClosure(supabase, execution, merged);
    await updateExecution(supabase, execution.id, { progress: { resolvedEdges: afterSkip } });
    const frontier = computeFrontier(graph, afterSkip);
    await enqueueReadyNodes(supabase, execution.id, graph, frontier.ready, { availableAt: delayedAt });
    await setJobStatus(supabase, claim.job_id, 'completed');
    await maybeFinalize(supabase, execution);
    return;
  }

  // --- Success (or explicit skip-as-success) --------------------------------
  if (result.status === 'succeeded' || result.status === 'skipped') {
    const routes = result.status === 'succeeded' ? (result.routes ?? ['true']) : [];
    await upsertNodeRun(supabase, {
      execution_id: execution.id,
      node_id: claim.node_id,
      node_type: node.type ?? claim.node_type,
      attempt: claim.attempt,
      status: 'succeeded',
      branch: routes[0] ?? null,
      output: result.output,
      finished_at: finishedAt,
      duration_ms: durationMs,
      http_status: result.http?.status,
    });
    await writeEvent(supabase, execution.id, {
      node_id: claim.node_id,
      event: 'node.succeeded',
      message: node.title ?? claim.node_id,
    });

    let progress: ResolvedEdge[] = resolveOutboundEdges(
      (execution.progress?.resolvedEdges ?? []) as ResolvedEdge[],
      claim.node_id,
      graph,
      routes,
    );
    progress = await applySkipClosure(supabase, execution, progress);
    await updateExecution(supabase, execution.id, { progress: { resolvedEdges: progress } });
    const frontier = computeFrontier(graph, progress);
    await enqueueReadyNodes(supabase, execution.id, graph, frontier.ready);
    await setJobStatus(supabase, claim.job_id, 'completed');
    await maybeFinalize(supabase, execution);
    return;
  }

  // --- Failure --------------------------------------------------------------
  const err = result.error ?? { code: 'internal', message: 'Atom failed without an error' };
  await handleFailure(supabase, execution, claim, node, err);
  await setJobStatus(supabase, claim.job_id, 'failed', err);
}

async function drain(supabase: Awaited<ReturnType<typeof getSupabase>>, workerId: string): Promise<{ processed: number; reaped: number }> {
  const startedAt = Date.now();
  const reaped = await reapStaleJobs(supabase, workerId);
  let processed = 0;

  while (processed < MAX_JOBS_PER_INVOCATION && Date.now() - startedAt < WORKER_BUDGET_MS) {
    let claims: Claim[];
    try {
      claims = (await claimJobs(supabase, BATCH, workerId)) as unknown as Claim[];
    } catch (e) {
      console.error('claim failed', e);
      break;
    }
    if (!claims.length) break;
    for (const claim of claims) {
      if (processed >= MAX_JOBS_PER_INVOCATION) break;
      try {
        await processClaim(supabase, claim);
      } catch (e) {
        console.error('processClaim failed', e);
        await setJobStatus(supabase, claim.job_id, 'failed', { message: e instanceof Error ? e.message : String(e) });
      }
      processed += 1;
      console.log(JSON.stringify({ event: 'worker.claim_processed', worker_id: workerId, execution_id: claim.execution_id, job_id: claim.job_id, node_id: claim.node_id, node_type: claim.node_type, attempt: claim.attempt, claim_count: processed, elapsed_ms: Date.now() - startedAt }));
    }
  }
  if (Date.now() - startedAt >= WORKER_BUDGET_MS) {
    console.log(JSON.stringify({ event: 'worker.budget_exhausted', worker_id: workerId, claim_count: processed, elapsed_ms: Date.now() - startedAt }));
  }
  return { processed, reaped };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-tal-worker-key, content-type' } });
  }
  if (!(await authorized(request))) {
    return errorResponse('Unauthorized', 401);
  }
  const supabase = getSupabase();
  const workerId = `worker-${crypto.randomUUID().slice(0, 8)}`;
  const { processed, reaped } = await drain(supabase, workerId);
  return json({ ok: true, processed, reaped, workerId });
});
