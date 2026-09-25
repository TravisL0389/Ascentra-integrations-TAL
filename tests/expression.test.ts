import { describe, it, expect } from 'vitest';
import { interpolate, evaluateExpression, deepInterpolate, DEFAULT_HELPERS, resolvePath } from '../supabase/functions/_shared/expression.ts';
import { TALError } from '../supabase/functions/_shared/errors.ts';

describe('expression engine', () => {
  it('interpolates dotted paths from scope', () => {
    const scope = { trigger: { body: { email: 'a@b.com', amount: 12.5 } } };
    expect(interpolate('to {{ trigger.body.email }}', { scope })).toBe('to a@b.com');
    expect(interpolate('amount {{ trigger.body.amount }}', { scope })).toBe('amount 12.5');
  });

  it('preserves the raw type for a whole-field expression', () => {
    const scope = { trigger: { body: { amount: 12.5 } } };
    expect(interpolate('{{ trigger.body.amount }}', { scope })).toBe(12.5);
    expect(interpolate('{{ uppercase(trigger.body.name) }}', { scope: { ...scope, trigger: { body: { name: 'hi' } } } })).toBe('HI');
  });

  it('misses return empty string in template mode', () => {
    expect(interpolate('x={{ missing.path }}', { scope: {} })).toBe('x=');
  });

  it('evaluates helper calls with args', () => {
    expect(evaluateExpression("uppercase(coalesce('', 'fallback'))", {}, DEFAULT_HELPERS)).toBe('FALLBACK');
    expect(evaluateExpression('length([1,2,3])', {}, DEFAULT_HELPERS)).toBe(3);
    expect(evaluateExpression('now()', {}, DEFAULT_HELPERS)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(evaluateExpression("formatDate('2026-08-29T12:00:00Z','date')", {}, DEFAULT_HELPERS)).toBe('2026-08-29');
    expect(evaluateExpression("jsonparse('{\"a\":1}')", {}, DEFAULT_HELPERS)).toEqual({ a: 1 });
    expect(evaluateExpression('jsonstringify(payload)', { payload: { b: 2 } }, DEFAULT_HELPERS)).toBe('{"b":2}');
    expect(() => evaluateExpression('concatenate(1,2)', {}, DEFAULT_HELPERS)).toThrow(TALError);
  });

  it('resolves array index paths', () => {
    expect(resolvePath({ items: [{ id: 7 }] }, ['items', 0, 'id'])).toBe(7);
    expect(resolvePath({ items: [{ id: 7 }] }, ['items', '0', 'id'])).toBe(7);
  });

  it('supports bracket-quoted keys', () => {
    const scope = { data: { 'a-b': 1 } };
    expect(evaluateExpression("data['a-b']", scope, DEFAULT_HELPERS)).toBe(1);
  });

  it('throws a typed error on bad syntax', () => {
    expect(() => evaluateExpression('trigger.body.', {})).toThrow(TALError);
    expect(() => evaluateExpression('nope(', {})).toThrow(TALError);
  });

  it('deep-interpolates config objects', () => {
    const cfg = { url: 'https://x.com/{{ trigger.body.id }}', headers: { 'X-Token': '{{ variables.token }}' }, count: 3 };
    const out = deepInterpolate(cfg, { scope: { trigger: { body: { id: 9 } }, variables: { token: 'abc' } }, helpers: DEFAULT_HELPERS });
    expect(out).toEqual({ url: 'https://x.com/9', headers: { 'X-Token': 'abc' }, count: 3 });
  });
});