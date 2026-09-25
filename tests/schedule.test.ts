import { describe, it, expect } from 'vitest';
import { computeNextRun, parseCron } from '../supabase/functions/_shared/schedule.ts';

const T = '2026-08-29T10:15:00Z';

describe('schedule math', () => {
  it('interval rolls forward by seconds', () => {
    const next = computeNextRun({ triggerType: 'interval', intervalSeconds: 60 }, new Date(T));
    expect(next?.toISOString()).toBe('2026-08-29T10:16:00.000Z');
  });

  it('cron fires at the next matching minute', () => {
    const next = computeNextRun({ triggerType: 'cron', cronExpr: '*/30 * * * *' }, new Date(T));
    expect(next?.toISOString()).toBe('2026-08-29T10:30:00.000Z');
  });

  it('cron respects hour and day-of-month', () => {
    const next = computeNextRun({ triggerType: 'cron', cronExpr: '0 0 1 * *' }, new Date(T));
    expect(next?.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('daily time rolls to tomorrow when today is past', () => {
    const next = computeNextRun({ triggerType: 'time', scheduleTime: '09:00' }, new Date(T));
    expect(next?.toISOString()).toBe('2026-08-30T09:00:00.000Z');
  });

  it('daily time fires today when date is future', () => {
    const next = computeNextRun({ triggerType: 'time', scheduleTime: '11:00' }, new Date(T));
    expect(next?.toISOString()).toBe('2026-08-29T11:00:00.000Z');
  });

  it('rejects malformed specs', () => {
    expect(computeNextRun({ triggerType: 'interval', intervalSeconds: 0 })).toBeNull();
    expect(parseCron('bad cron')).toBeNull();
  });

  it('parses 5-field crons', () => {
    expect(parseCron('*/5 * * * *')).not.toBeNull();
    expect(parseCron('30 14 1,15 * 1-5')).not.toBeNull();
  });
});