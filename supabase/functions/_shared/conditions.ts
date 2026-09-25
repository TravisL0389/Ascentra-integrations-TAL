// Branch atom condition evaluation. Pure and unit-testable; no eval().

import { resolvePath } from './expression.ts';
import type { Condition, ConditionOperator } from './types.ts';

export interface ConditionGroup {
  conditions: Condition[];
  groupOperator: 'and' | 'or';
}

function toString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const an = Number(a);
  const bn = Number(b);
  if (!Number.isNaN(an) && !Number.isNaN(bn) && a !== '' && b !== '') return an - bn;
  return toString(a).localeCompare(toString(b));
}

export function evaluateCondition(cond: Condition, scope: Record<string, unknown>): boolean {
  const target = resolvePath(scope, cond.path.split('.'));
  const expected = cond.value;
  const str = toString(target);
  const expectedStr = toString(expected);

  switch (cond.operator) {
    case 'equals':
      return target === expected || (hasValue(target) && str === expectedStr);
    case 'not_equals':
      return !evaluateCondition({ ...cond, operator: 'equals' }, scope);
    case 'exists':
      return target !== null && target !== undefined;
    case 'not_exists':
      return target === null || target === undefined;
    case 'empty':
      return str === '';
    case 'not_empty':
      return str !== '';
    case 'contains':
      return str.includes(expectedStr);
    case 'not_contains':
      return !str.includes(expectedStr);
    case 'starts_with':
      return str.startsWith(expectedStr);
    case 'ends_with':
      return str.endsWith(expectedStr);
    case 'greater_than':
      return compare(target, expected) > 0;
    case 'less_than':
      return compare(target, expected) < 0;
    case 'greater_than_or_equal':
      return compare(target, expected) >= 0;
    case 'less_than_or_equal':
      return compare(target, expected) <= 0;
    case 'matches':
      try {
        return new RegExp(expectedStr).test(str);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

export function evaluateConditionGroup(group: ConditionGroup, scope: Record<string, unknown>): boolean {
  const results = group.conditions.map((c) => evaluateCondition(c, scope));
  return group.groupOperator === 'and' ? results.every(Boolean) : results.some(Boolean);
}

export function hasValue(v: unknown): boolean {
  return v !== null && v !== undefined;
}

export function buildGroupScope(
  scopeRoot: Record<string, unknown>,
  conditionPathBase?: (path: string) => string,
): Record<string, unknown> {
  return scopeRoot;
}

export function pathScopePartial(scopeRoot: Record<string, unknown>): (path: string) => unknown {
  return (path: string) => resolvePath(scopeRoot, path.split('.'));
}