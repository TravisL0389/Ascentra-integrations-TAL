// Minimal schedule math: interval / 5-field cron / daily-time. Pure, testable,
// intentionally small (no external cron dependency).

export interface ScheduleSpec {
  triggerType: 'interval' | 'cron' | 'time';
  intervalSeconds?: number;
  cronExpr?: string;
  scheduleTime?: string; // "HH:MM"
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(y: number, m: number): number {
  if (m === 1 && isLeap(y)) return 29;
  return MONTH_DAYS[m];
}

function parseField(field: string, min: number, max: number): number[] | null {
  if (field === '*' || field === '?') {
    const all: number[] = [];
    for (let i = min; i <= max; i++) all.push(i);
    return all;
  }
  const parts = field.split(',');
  const out: number[] = [];
  for (const p of parts) {
    if (p === '*') {
      for (let i = min; i <= max; i++) out.push(i);
      continue;
    }
    const starStep = p.match(/^\*\/(\d+)$/);
    if (starStep) {
      const step = Number(starStep[1]);
      if (step < 1) return null;
      for (let v = min; v <= max; v += step) out.push(v);
      continue;
    }
    const m = p.match(/^(\d+)(?:-(\d+))?(?:\/(\d+))?$/);
    if (!m) return null;
    let start = Number(m[1]);
    let end = m[2] ? Number(m[2]) : start;
    const step = m[3] ? Number(m[3]) : 1;
    if (start < min || end > max || step < 1) return null;
    for (let v = start; v <= end; v += step) out.push(v);
  }
  return out.length ? out : null;
}

export interface CronMatch {
  minutes: number[];
  hours: number[];
  dom: number[];
  months: number[];
  dow: number[];
  domStar: boolean;
  dowStar: boolean;
}

export function parseCron(expr: string): CronMatch | null {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const minutes = parseField(fields[0], 0, 59);
  const hours = parseField(fields[1], 0, 23);
  const dom = parseField(fields[2], 1, 31);
  const months = parseField(fields[3], 1, 12);
  const dow = parseField(fields[4], 0, 6);
  if (!minutes || !hours || !dom || !months || !dow) return null;
  return {
    minutes,
    hours,
    dom,
    months,
    dow,
    domStar: fields[2] === '*',
    dowStar: fields[4] === '*',
  };
}

function matchesCronAt(expr: CronMatch, d: Date): boolean {
  const mm = d.getUTCMinutes();
  const hh = d.getUTCHours();
  const day = d.getUTCDate();
  const mon = d.getUTCMonth() + 1;
  const dow = d.getUTCDay();
  if (
    !expr.minutes.includes(mm) ||
    !expr.hours.includes(hh) ||
    !expr.months.includes(mon)
  ) {
    return false;
  }
  const domOk = expr.domStar || expr.dom.includes(day);
  const dowOk = expr.dowStar || expr.dow.includes(dow);
  if (expr.domStar && expr.dowStar) return true;
  if (expr.domStar) return dowOk;
  if (expr.dowStar) return domOk;
  return domOk || dowOk; // vixie-cron: both restricted => OR
}

function nextCron(expr: string, from: Date): Date | null {
  const parsed = parseCron(expr);
  if (!parsed) return null;
  // Scan forward minute-by-minute from `from + 1 minute` (bounded by 2 years).
  const cursor = new Date(from.getTime() + 60_000);
  const cap = cursor.getTime() + 2 * 365 * 24 * 60 * 60 * 1000;
  while (cursor.getTime() <= cap) {
    if (
      matchesCronAt(parsed, cursor) &&
      cursor.getTime() > from.getTime() + 60_000 - 1000
    ) {
      return new Date(Math.ceil(cursor.getTime() / 1000) * 1000);
    }
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  return null;
}

function nextDaily(scheduleTime: string, from: Date): Date | null {
  const m = scheduleTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const min2 = Number(m[2]);
  const next = new Date(Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
    hh,
    min2,
    0,
  ));
  if (next.getTime() <= from.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

export function computeNextRun(spec: ScheduleSpec, from: Date = new Date()): Date | null {
  if (spec.triggerType === 'interval') {
    const secs = Number(spec.intervalSeconds ?? 0);
    if (!(secs > 0)) return null;
    return new Date(from.getTime() + secs * 1000);
  }
  if (spec.triggerType === 'cron' && spec.cronExpr) {
    return nextCron(spec.cronExpr, from);
  }
  if (spec.triggerType === 'time' && spec.scheduleTime) {
    return nextDaily(spec.scheduleTime, from);
  }
  return null;
}