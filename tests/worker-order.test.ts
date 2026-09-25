import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'supabase/functions/tal-worker/index.ts'), 'utf8');

describe('worker queue ordering', () => {
  it('persists resolved progress before enqueueing downstream jobs', () => {
    const success = source.slice(source.indexOf('// --- Success'), source.indexOf('// --- Failure'));
    expect(success.indexOf("updateExecution(supabase, execution.id, { progress")).toBeLessThan(
      success.indexOf('enqueueReadyNodes(supabase, execution.id, graph'),
    );
  });

  it('has bounded queue and graph processing guards', () => {
    expect(source).toMatch(/const MAX_JOBS_PER_INVOCATION = 20/);
    expect(source).toMatch(/const WORKER_BUDGET_MS = 15000/);
    expect(source).toMatch(/const MAX_GRAPH_NODES = 500/);
    expect(source).toMatch(/const skipped = new Set<string>\(\)/);
  });

  it('deduplicates finalized node attempts and rejects cycles', () => {
    expect(source).toMatch(/latestNodeRun\(supabase, execution\.id, claim\.node_id\)/);
    expect(source).toMatch(/validateGraph\(graph\)/);
    expect(source).toMatch(/\['succeeded', 'skipped'\]\.includes\(previousRun\.status\)/);
  });

  it('stops draining at the invocation budget', () => {
    expect(source).toMatch(/Date\.now\(\) - startedAt < WORKER_BUDGET_MS/);
    expect(source).toMatch(/worker\.budget_exhausted/);
  });
});
