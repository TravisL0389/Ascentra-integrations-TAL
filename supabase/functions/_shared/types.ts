// Dependency-free shared types for the native execution engine.
// Must be importable from both Deno edge functions and vitest (Node), so:
//   - use `import type` only for type-only deps
//   - never import from "node:*" or use Deno globals in logic modules
//   - keep everything tree-shakeable and sync unless the atom itself is async

export type NodeType =
  | 'manual'
  | 'http'
  | 'transform'
  | 'branch'
  | 'delay'
  | 'approval'
  | 'ai'
  | 'make'
  | 'webhook'
  | 'schedule'
  | string; // legacy 'logic' / integration types remain renderable, not executable

export type EdgeLabel = string | null;

export interface WorkflowNode {
  id: string;
  title?: string;
  subtitle?: string;
  type: NodeType;
  lane?: number;
  column_index?: number;
  config?: Record<string, unknown>; // native atom config
  makeConfig?: {
    enabled?: boolean;
    webhookUrl?: string;
    method?: string;
    payload?: string;
    headers?: string;
    [key: string]: unknown;
  }; // legacy Make connector config (kept for backward compat)
  retries?: number;
  mode?: string;
  approval?: unknown;
  agent_id?: string;
  [key: string]: unknown;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  sourcePortId?: string;
  targetPortId?: string;
  sortOrder?: number;
  label?: EdgeLabel; // branch route ('true' | 'false') or null for pass-through
  sort_order?: number;
  id?: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  meta?: Record<string, unknown>;
}

export type ExecutionStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'awaiting_approval'
  | 'retry_scheduled'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'timed_out';

export type NodeRunStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'waiting'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'canceled'
  | 'retrying';

export interface ExecutionNodeRun {
  execution_id: string;
  node_id: string;
  node_type: NodeType;
  attempt: number;
  status: NodeRunStatus;
  input?: unknown;
  output?: unknown;
  error?: { code?: string; message: string; [key: string]: unknown } | null;
  branch?: EdgeLabel;
  http_status?: number | null;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
}

export interface ExecutionJobRecord {
  id: string;
  execution_id: string;
  node_id: string;
  node_type: NodeType;
  attempt: number;
  max_attempts: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'canceled' | 'released';
  available_at: string;
  locked_at: string | null;
  worker_id: string | null;
  job_key: string | null;
}

export interface ExpressionScope {
  trigger?: Record<string, unknown> | null;
  input?: unknown; // shorthand root for the node's primary input
  previous?: { output?: unknown; branch?: EdgeLabel } | null;
  nodes?: Record<string, { output?: unknown; branch?: EdgeLabel; status?: NodeRunStatus }>;
  variables?: Record<string, unknown>;
  execution?: Record<string, unknown>;
  [key: string]: unknown;
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'exists'
  | 'not_exists'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'empty'
  | 'not_empty'
  | 'starts_with'
  | 'ends_with'
  | 'matches';

export interface Condition {
  path: string; // expression scope path, e.g. trigger.body.amount
  operator: ConditionOperator;
  value?: unknown;
}

export interface AtomContext {
  node: WorkflowNode;
  graph: WorkflowGraph;
  scope: ExpressionScope;
  variables: Record<string, unknown>;
  trigger: Record<string, unknown> | null;
  helpers: Record<string, (...args: unknown[]) => unknown>;
  now: () => string;
  credential?: Record<string, unknown> | null;
  connection?: Record<string, unknown> | null;
  fetchImpl?: typeof fetch;
  resolveDns?: (hostname: string) => Promise<string[]> | string[];
  // runtime hooks (injected by the worker; pure atoms ignore them)
  onEvent?: (event: { node_id: string; event: string; level: string; message: string; metadata?: Record<string, unknown> }) => Promise<void>;
}

export interface AtomResult {
  output: unknown;
  status: NodeRunStatus;
  routes?: string[]; // branch routes this atom emits downstream
  error?: { code?: string; message: string; retryable?: boolean; [key: string]: unknown };
  delayMs?: number; // delay atom: how long before downstream may run
  approval?: { title?: string; message?: string };
  http?: { status: number; body: unknown; headers?: Record<string, string> };
}

export interface AtomDefinition {
  type: string;
  label: string;
  isTrigger?: boolean;
  isAsync?: boolean; // cannot be awaited inline (delay/approval) -> schedules downstream job
  run: (ctx: AtomContext) => Promise<AtomResult> | AtomResult;
}

export const EXECUTION_STATUSES: ExecutionStatus[] = [
  'queued',
  'running',
  'waiting',
  'awaiting_approval',
  'retry_scheduled',
  'completed',
  'failed',
  'canceled',
  'timed_out',
];

export const NODE_RUN_STATUSES: NodeRunStatus[] = [
  'pending',
  'queued',
  'running',
  'waiting',
  'succeeded',
  'failed',
  'skipped',
  'canceled',
  'retrying',
];
