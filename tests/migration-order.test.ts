import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = join(root, 'supabase/migrations/20260829_tal_native_execution_engine.sql');
const lines = readFileSync(migrationPath, 'utf8').split('\n');

describe('native engine migration is safely orderable', () => {
  it('never references a table before it is created within the same file', () => {
    const creates = new Map<string, number>();
    lines.forEach((l, i) => {
      const m = l.match(/create table if not exists public\.([a-z_]+)/);
      if (m) creates.set(m[1], i + 1);
    });

    const problems: string[] = [];
    lines.forEach((l, i) => {
      const re = /(?:from|join|into|on|references) public\.([a-z_]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(l)) !== null) {
        const createLine = creates.get(m[1]);
        if (createLine !== undefined && i + 1 < createLine) {
          problems.push(`line ${i + 1}: uses public.${m[1]} before its create at line ${createLine}`);
        }
      }
    });

    expect(problems).toEqual([]);
  });

  it('only uses core-PG randomness in defaults (no pgcrypto-only helpers)', () => {
    const text = lines.join('\n');
    expect(text).not.toMatch(/gen_random_bytes/);
    const tokenDefault = lines.find((l) => l.includes('token text not null unique default'));
    expect(tokenDefault).toBeTruthy();
    expect(tokenDefault).toContain('gen_random_uuid');
  });

  it('defines execution-scoped helpers only after the executions table', () => {
    const execTable = lines.findIndex((l) => l.startsWith('create table if not exists public.executions '));
    const orgFn = lines.findIndex((l) => l.startsWith('create or replace function public.execution_org_id'));
    const accFn = lines.findIndex((l) => l.startsWith('create or replace function public.is_execution_accessible'));
    expect(execTable).toBeGreaterThan(-1);
    expect(orgFn).toBeGreaterThan(execTable);
    expect(accFn).toBeGreaterThan(execTable);
  });

  it('drops the old public policies and installs member-gated policies', () => {
    const text = lines.join('\n');
    expect(text).toMatch(/drop policy if exists "public flow access"/);
    expect(text).toMatch(/drop policy if exists "executions select member"/);
    expect(text).toMatch(/security definer/);
  });

  it('aliases the worker claim record fields', () => {
    const claim = readFileSync(join(root, 'supabase/migrations/202608290001_fix_claim_available_jobs.sql'), 'utf8');
    expect(claim).toMatch(/j\.id as job_id/);
    expect(claim).toMatch(/coalesce\(j\.node_type, 'manual'\) as node_type/);
    expect(claim).toMatch(/where id = r\.job_id/);
  });

  it('keeps saved node configuration available to the graph loader', () => {
    const configMigration = readFileSync(join(root, 'supabase/migrations/202608290002_add_automation_node_config.sql'), 'utf8');
    expect(configMigration).toMatch(/alter table public\.automation_nodes/);
    expect(configMigration).toMatch(/add column if not exists config jsonb/);
  });
});
