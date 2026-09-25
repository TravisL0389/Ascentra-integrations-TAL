// Edge-function utilities: CORS, JSON responses, env, service client, worker poke.
// Worker-auth shared helpers live here so every function enforces the same policy.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-ascentra-client, x-tal-worker-key, x-tal-approval-token',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return json({ error: message, ...extra }, status);
}

export type SupabaseLike = ReturnType<typeof createClient>;

export function getSupabase(): SupabaseClient<any> {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceRole) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceRole, {
    global: { headers: { 'x-tal-client': 'edge-function' } },
  });
}

export function getWorkerUrl(): string {
  const base = Deno.env.get('SUPABASE_URL') ?? '';
  return `${base}/functions/v1/tal-worker`;
}

// Wake the worker asynchronously when new jobs land. Failures are safe: any
// worker invocation drains the queue, and jobs stay claimable.
export async function pokeWorker(opts?: { immediate?: boolean }): Promise<void> {
  const workerSecret = Deno.env.get('TAL_WORKER_KEY');
  try {
    await fetch(`${getWorkerUrl()}/poke`, {
      method: 'POST',
      headers: {
        'x-tal-worker-key': workerSecret ?? '',
      },
    });
  } catch {
    // ignore: queue remains claimable
  }
}

// Same fetch impl used by the http atom so tests never need the network.
export function buildDnsResolver(): (host: string) => Promise<string[]> {
  return async (host) => {
    try {
      const res = await Deno.resolveDns(host, 'A') as unknown;
      const addresses = Array.isArray(res) ? res : (res as { addresses?: string[] }).addresses ?? [];
      if (addresses.length) return addresses;
    } catch {
      // fall through to AAAA
    }
    try {
      const res = await Deno.resolveDns(host, 'AAAA') as unknown;
      return Array.isArray(res) ? res : (res as { addresses?: string[] }).addresses ?? [];
    } catch {
      return [];
    }
  };
}

export function readAuthHeader(request: Request): string | null {
  return request.headers.get('authorization') ?? request.headers.get('Authorization');
}

export async function verifyMemberJwt(request: Request): Promise<string | null> {
  const header = readAuthHeader(request);
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}
