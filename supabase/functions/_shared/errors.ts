// Error model for the execution engine. Serializable, typed, testable.

export type TALErrorCode =
  | 'invalid_config'
  | 'invalid_expression'
  | 'invalid_graph'
  | 'integration_not_enabled'
  | 'credential_missing'
  | 'credential_decrypt_failed'
  | 'http_error'
  | 'network_error'
  | 'timeout'
  | 'ssrf_blocked'
  | 'branch_no_match'
  | 'approval_needed'
  | 'not_found'
  | 'unauthorized'
  | 'rate_limited'
  | 'internal';

export interface TALErrorShape {
  code: TALErrorCode;
  message: string;
  retryable?: boolean;
  node_id?: string;
  attempt?: number;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

export class TALError extends Error {
  code: TALErrorCode;
  retryable: boolean;
  node_id?: string;
  attempt?: number;
  details?: Record<string, unknown>;

  constructor(shape: TALErrorShape) {
    super(shape.message);
    this.name = 'TALError';
    this.code = shape.code;
    this.retryable = shape.retryable ?? false;
    this.node_id = shape.node_id;
    this.attempt = shape.attempt;
    this.details = shape.details;
  }

  toJSON(): TALErrorShape {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      node_id: this.node_id,
      attempt: this.attempt,
      details: this.details,
    };
  }
}

export function asTALError(err: unknown, fallbackCode: TALErrorCode = 'internal'): TALError {
  if (err instanceof TALError) return err;
  if (err instanceof Error) {
    return new TALError({ code: fallbackCode, message: err.message });
  }
  if (typeof err === 'object' && err !== null && 'code' in err && 'message' in err) {
    const e = err as TALErrorShape;
    return new TALError({ code: e.code, message: e.message, retryable: e.retryable, details: e.details });
  }
  return new TALError({ code: fallbackCode, message: String(err) });
}

export const ms = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));