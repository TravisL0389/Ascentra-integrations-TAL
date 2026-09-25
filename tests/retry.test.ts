import { describe, it, expect } from 'vitest';
import { backoffDelay, computeRetryAt, isRetryableError, maxAttemptsFromNode, DEFAULT_RETRY } from '../supabase/functions/_shared/retry.ts';

describe('retry / backoff', () => {
  it('grows exponentially with attempts', () => {
    const p = { ...DEFAULT_RETRY, jitter: false, baseDelayMs: 1000, factor: 2, maxDelayMs: 60000 };
    expect(backoffDelay(1, p)).toBe(1000); // after attempt 1, wait ~1s before attempt 2
    expect(backoffDelay(2, p)).toBe(2000); // after attempt 2, wait ~2s
    expect(backoffDelay(3, p)).toBe(0); // maxAttempts reached
  });

  it('caps the delay', () => {
    const p = { ...DEFAULT_RETRY, jitter: false, baseDelayMs: 1000, factor: 10, maxDelayMs: 5000, maxAttempts: 10 };
    expect(backoffDelay(5, p)).toBe(5000);
  });

  it('computes concrete retry timestamps', () => {
    const at = computeRetryAt(1_000_000, 1, { maxAttempts: 3, baseDelayMs: 1000, factor: 2, maxDelayMs: 60000, jitter: false });
    expect(at).toBe(1_001_000);
    expect(computeRetryAt(1_000_000, 3, DEFAULT_RETRY)).toBeNull();
  });

  it('classifies retryable errors', () => {
    expect(isRetryableError({ retryable: true })).toBe(true);
    expect(isRetryableError({ code: 'timeout' })).toBe(true);
    expect(isRetryableError({ code: 'http_error' })).toBe(true);
    expect(isRetryableError({ code: 'invalid_config' })).toBe(false);
    expect(isRetryableError(null)).toBe(false);
  });

  it('derives max attempts from node.retries', () => {
    expect(maxAttemptsFromNode(undefined)).toBe(1);
    expect(maxAttemptsFromNode(0)).toBe(1);
    expect(maxAttemptsFromNode(2)).toBe(3);
  });
});