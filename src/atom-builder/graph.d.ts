export type BuilderNode = {
  id: string;
  type?: string;
  title?: string;
  column?: number;
  config?: Record<string, unknown>;
  makeConfig?: { webhookUrl?: string };
};

export type BuilderEdge = {
  from: string;
  to: string;
  label?: string | null;
  id?: string;
  sourcePortId?: string | null;
  targetPortId?: string | null;
  sortOrder?: number;
};

export type WorkflowIssue = {
  code: string;
  message: string;
  nodeId: string | null;
  severity: 'error' | 'warning';
};

export type WorkflowValidation = {
  valid: boolean;
  issues: WorkflowIssue[];
  errors: number;
  warnings: number;
};

export function wouldCreateCycle(nodes: BuilderNode[], edges: BuilderEdge[], from: string, to: string): boolean;
export function buildConnection(nodes: BuilderNode[], edges: BuilderEdge[], from: string, to: string, options?: { sourcePortId?: string; targetPortId?: string; label?: string | null; id?: string; sortOrder?: number }): { ok: boolean; code?: string; message?: string; edge?: BuilderEdge };
export function nextBranchLabel(nodes: BuilderNode[], edges: BuilderEdge[], sourceId: string): string | undefined;
export function reachableUpstreamNodes(nodes: BuilderNode[], edges: BuilderEdge[], nodeId: string): BuilderNode[];
export function validateWorkflow(nodes?: BuilderNode[], edges?: BuilderEdge[]): WorkflowValidation;
