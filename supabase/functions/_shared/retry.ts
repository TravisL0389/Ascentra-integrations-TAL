// Retry / backoff scheduling helpers. Pure, testable.

export interface RetryPolicy {
  maxAttempts: number; // total attempts allowed (1 = no retry)
  baseDelayMs?: number; // first retry delay
  factor?: number; // exponential multiplier
  maxDelayMs?: number; // cap per attempt
  jitter?: boolean;
}

export const DEFAULT_RETRY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  factor: 2,
  maxDelayMs: 60000,
  jitter: true,
};

/**
 * Delay before the next attempt (attempt numbers are 1-based; attempt 1 = first run).
 * attemptNo is the attempt that just *failed*, so we schedule attemptNo + 1.
 */
export function backoffDelay(attemptNo: number, policy: RetryPolicy = DEFAULT_RETRY): number {
  if (attemptNo >= policy.maxAttempts) return 0;
  const exp = Math.max(0, attemptNo - 1);
  let delay = (policy.baseDelayMs ?? 1000) * Math.pow(policy.factor ?? 2, exp);
  const cap = policy.maxDelayMs ?? 60000;
  delay = Math.min(delay, cap);
  if (policy.jitter) {
    delay = Math.floor(delay * (0.75 + Math.random() * 0.5));
  }
  return delay;
}

export function isRetryableError(err: { retryable?: boolean; code?: string } | undefined | null): boolean {
  if (!err) return false;
  if (err.retryable === true) return true;
  const code = err.code;
  return (
    code === 'http_error' ||
    code === 'network_error' ||
    code === 'timeout' ||
    code === 'rate_limited' ||
    code === 'internal' ||
    code === 'credential_decrypt_failed'
  );
}

export function computeRetryAt(nowMs: number, failedAttempt: number, policy: RetryPolicy = DEFAULT_RETRY): number | null {
  const delay = backoffDelay(failedAttempt, policy);
  if (delay <= 0) return null;
  return nowMs + delay;
}

export function maxAttemptsFromNode(retries?: number): number {
  // node.retries counts extra retries beyond the first attempt
  const r = typeof retries === 'number' && retries >= 0 ? retries : 0;
  return Math.max(1, r + 1);
}

export function describePolicy(policy: RetryPolicy): string {
  return `${policy.maxAttempts} attempt${policy.maxAttempts === 1 ? '' : 's'}, backoff up to ${policy.maxDelayMs}ms`;
}