// Core atoms: manual, transform, branch, delay, and the passthrough/skip logic
// for entry nodes (webhook/schedule). Each is pure and sync where possible.

import { TALError } from '../errors.ts';
import { deepInterpolate } from '../expression.ts';
import { evaluateConditionGroup, type ConditionGroup } from '../conditions.ts';
import type { AtomContext, AtomResult } from '../types.ts';

export const manualAtom = {
  type: 'manual',
  label: 'Manual Trigger',
  isTrigger: true,
  run(ctx: AtomContext): AtomResult {
    return {
      output: ctx.trigger ?? {},
      status: 'succeeded',
      routes: ['true'],
    };
  },
};

export const transformAtom = {
  type: 'transform',
  label: 'Transform',
  run(ctx: AtomContext): AtomResult {
    const config = (ctx.node.config ?? {}) as { mapping?: Record<string, unknown> };
    if (!config.mapping || typeof config.mapping !== 'object') {
      throw new TALError({ code: 'invalid_config', message: 'Transform requires a mapping object', node_id: ctx.node.id });
    }
    const output = deepInterpolate(config.mapping, {
      roots: ctx.scope,
      helpers: ctx.helpers,
    });
    return { output, status: 'succeeded', routes: ['true'] };
  },
};

export const branchAtom = {
  type: 'branch',
  label: 'Branch',
  run(ctx: AtomContext): AtomResult {
    const config = (ctx.node.config ?? {}) as { groups?: ConditionGroup[]; conditions?: ConditionGroup };
    if (config.conditions && !config.groups) {
      config.groups = [config.conditions];
    }
    const groups = config.groups ?? [];
    if (!Array.isArray(groups) || groups.length === 0) {
      throw new TALError({ code: 'invalid_config', message: 'Branch requires at least one condition group', node_id: ctx.node.id });
    }
    const matchedFlag = groups.some((g) => {
      if (!g || !Array.isArray(g.conditions)) return false;
      return evaluateConditionGroup(g, ctx.scope as Record<string, unknown>);
    });
    const groupMatches = groups.map((g) => ({ matched: evaluateConditionGroup(g, ctx.scope as Record<string, unknown>) }));
    // n8n-style: pass the incoming data through so downstream `previous.output`
    // keeps working after a route split. Branch metadata rides alongside.
    const passthrough = ctx.scope.input ?? ctx.scope.previous?.output ?? null;
    let output: unknown;
    if (passthrough !== null && passthrough !== undefined && typeof passthrough === 'object' && !Array.isArray(passthrough)) {
      output = { ...(passthrough as Record<string, unknown>), _talBranch: { matched: matchedFlag, groups: groupMatches } };
    } else {
      output = { _talBranch: { matched: matchedFlag, groups: groupMatches }, input: passthrough };
    }
    const route = matchedFlag ? 'true' : 'false';
    return {
      output,
      status: 'succeeded',
      routes: [route],
    };
  },
};

export const delayAtom = {
  type: 'delay',
  label: 'Delay',
  isAsync: true,
  run(ctx: AtomContext): AtomResult {
    const config = (ctx.node.config ?? {}) as {
      milliseconds?: unknown;
      seconds?: unknown;
      minutes?: unknown;
    };
    const millis =
      typeof config.milliseconds === 'number'
        ? config.milliseconds
        : typeof config.milliseconds === 'string'
          ? Number(config.milliseconds)
          : config.seconds !== undefined && config.seconds !== null
            ? Number(config.seconds) * 1000
            : config.minutes !== undefined && config.minutes !== null
              ? Number(config.minutes) * 60000
              : undefined;
    const interpolated = deepInterpolate(millis ?? 0, { roots: ctx.scope, helpers: ctx.helpers });
    const value = typeof interpolated === 'number' ? interpolated : typeof interpolated === 'string' ? Number(interpolated) : NaN;
    if (!Number.isFinite(value) || value < 0) {
      throw new TALError({ code: 'invalid_config', message: 'Delay requires a positive number of milliseconds', node_id: ctx.node.id });
    }
    return {
      output: { delayedUntil: new Date(Date.now() + value).toISOString(), delayMs: value },
      status: 'waiting',
      delayMs: value,
      routes: ['true'],
    };
  },
};

export const passthroughAtom = {
  type: 'passthrough',
  label: 'Pass Through',
  isTrigger: true,
  run(ctx: AtomContext): AtomResult {
    // Entry triggers (webhook/schedule) and legacy 'logic' nodes are pass-throughs.
    return { output: ctx.trigger ?? null, status: 'succeeded', routes: ['true'] };
  },
};

export const skipAtom = {
  type: 'skip',
  label: 'Skip',
  run(): AtomResult {
    return { output: null, status: 'skipped', routes: [] };
  },
};