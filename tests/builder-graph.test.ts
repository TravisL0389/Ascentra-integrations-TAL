import { describe, expect, it } from 'vitest';
import { buildConnection, nextBranchLabel, validateWorkflow, wouldCreateCycle } from '../src/atom-builder/graph.js';
import { readFileSync } from 'node:fs';

const trigger = { id: 'start', type: 'trigger', title: 'Manual Trigger', config: { kind: 'manual' } };
const http = { id: 'request', type: 'integration', title: 'HTTP Request', config: { kind: 'http', url: 'https://example.com' } };

describe('builder graph validation', () => {
  it('accepts a configured trigger-to-action workflow', () => {
    const result = validateWorkflow([trigger, http], [{ from: 'start', to: 'request' }]);
    expect(result.valid).toBe(true);
    expect(result.errors).toBe(0);
  });

  it('explains missing setup and disconnected atoms', () => {
    const result = validateWorkflow([trigger, { ...http, config: { kind: 'http', url: '' } }], []);
    expect(result.valid).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toEqual(expect.arrayContaining(['disconnected_atom', 'http_url_missing']));
  });

  it('detects connections that create a cycle', () => {
    expect(wouldCreateCycle([trigger, http], [{ from: 'start', to: 'request' }], 'request', 'start')).toBe(true);
    expect(wouldCreateCycle([trigger, http], [], 'start', 'request')).toBe(false);
  });

  it('assigns true and false branch routes progressively', () => {
    const branch = { id: 'condition', type: 'logic', title: 'Condition', config: { kind: 'branch' } };
    expect(nextBranchLabel([branch], [], branch.id)).toBe('true');
    expect(nextBranchLabel([branch], [{ from: branch.id, to: 'a', label: 'true' }], branch.id)).toBe('false');
  });

  it('creates a complete typed edge and rejects duplicate or cyclic connections', () => {
    const result = buildConnection([trigger, http], [], 'start', 'request');
    expect(result.ok).toBe(true);
    if (!result.ok || !result.edge) throw new Error('Expected a valid connection');
    expect(result.edge).toMatchObject({ from: 'start', to: 'request', sourcePortId: 'payload', targetPortId: 'input', label: null, sortOrder: 0 });
    expect(buildConnection([trigger, http], [result.edge], 'start', 'request').code).toBe('duplicate_connection');
    expect(buildConnection([trigger, http], [result.edge], 'request', 'start').code).toBe('connection_port_missing');
  });

  it('persists branch labels through the frontend adapter', () => {
    const source = readFileSync(new URL('../src/lib/automationBackend.js', import.meta.url), 'utf8');
    expect(source).toContain('label: edge.label ?? null');
  });

  it('keeps the custom client header aligned with edge-function CORS', () => {
    const shared = readFileSync(new URL('../supabase/functions/_shared/edge.ts', import.meta.url), 'utf8');
    const legacy = readFileSync(new URL('../supabase/functions/execute-automation/index.ts', import.meta.url), 'utf8');
    expect(shared).toContain('x-ascentra-client');
    expect(legacy).toContain('x-ascentra-client');
  });

  it('authenticates and authorizes legacy edge execution', () => {
    const source = readFileSync(new URL('../supabase/functions/execute-automation/index.ts', import.meta.url), 'utf8');
    expect(source).toContain('supabase.auth.getUser(token)');
    expect(source).toContain(".from('organization_memberships')");
    expect(source).toContain(".eq('user_id', authData.user.id)");
  });
});
