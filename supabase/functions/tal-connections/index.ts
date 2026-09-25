// tal-connections: manage integration connections + the credential vault.
//   GET                  list caller's org connections + credentials (masked)
//   POST { action:"list" }        same as GET
//   POST { action:"createConnection", organizationId, name, provider, credentialId?, scopes? }
//   POST { action:"updateConnection", id, ...patch }
//   POST { action:"deleteConnection", id }
//   POST { action:"createCredential", organizationId, name, provider, secret, isSecret? }
//   POST { action:"deleteCredential", id }
// Member JWT required. Secrets are handled server-side only (encryptSecret).

import { json, getSupabase, errorResponse, verifyMemberJwt } from '../_shared/edge.ts';
import { encryptSecret } from '../_shared/crypto.ts';

const KNOWN_PROVIDERS = new Set([
  'stripe', 'make', 'resend', 'slack', 'google', 'gmail', 'hubspot', 'notion',
  'discord', 'supabase', 'postgres', 'openai', 'gemini', 'anthropic', 'http', 'generic',
]);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok');
  const userId = await verifyMemberJwt(request);
  if (!userId) return errorResponse('Unauthorized', 401);

  const supabase = getSupabase();
  const { data: orgRows } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', userId);
  const orgIds = (orgRows ?? []).map((r) => r.organization_id);

  let body: Record<string, unknown> = {};
  if (request.method === 'POST') {
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body');
    }
  } else if (request.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  // Determine the action from body (primary) or URL path (fallback for curl).
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter((p) => p && p !== 'tal-connections');
  const pathResource = parts[0];
  const pathId = parts[1];
  const action =
    (body.action as string) ||
    (pathResource === 'connections' ? (request.method === 'DELETE' ? 'deleteConnection' : request.method === 'PATCH' ? 'updateConnection' : 'createConnection') : null) ||
    (pathResource === 'credentials' ? (request.method === 'DELETE' ? 'deleteCredential' : 'createCredential') : null) ||
    'list';
  const id = (body.id as string) ?? pathId ?? null;

  // List.
  if (action === 'list') {
    const [connRes, credRes] = await Promise.all([
      supabase.from('integration_connections').select('*').in('organization_id', orgIds),
      supabase.from('credentials').select('id, name, provider, hint, is_secret, organization_id, created_at').in('organization_id', orgIds),
    ]);
    if (connRes.error) return errorResponse(connRes.error.message, 500);
    if (credRes.error) return errorResponse(credRes.error.message, 500);
    return json({ connections: connRes.data ?? [], credentials: credRes.data ?? [] });
  }

  // Create connection.
  if (action === 'createConnection') {
    const orgId = String(body.organizationId ?? '');
    if (!orgIds.includes(orgId)) return errorResponse('Not a member of this workspace', 403);
    const name = String(body.name ?? '').trim();
    const provider = String(body.provider ?? '').toLowerCase();
    if (!name || !provider) return errorResponse('name and provider are required');
    if (!KNOWN_PROVIDERS.has(provider)) return errorResponse(`Unknown provider "${provider}"`, 400);
    const { data, error } = await supabase
      .from('integration_connections')
      .insert({
        organization_id: orgId,
        name,
        provider,
        kind: provider,
        credential_id: body.credentialId ? String(body.credentialId) : null,
        scopes: body.scopes ?? [],
        oauth_metadata: body.oauthMetadata ?? {},
        owner_id: userId,
        created_by: userId,
        updated_at: new Date().toISOString(),
      })
      .select('id, name, provider, credential_id, scopes, created_at')
      .single();
    if (error) return errorResponse(error.message, 400);
    return json({ connection: data }, 201);
  }

  // Update connection.
  if (action === 'updateConnection' && id) {
    const { data: existing } = await supabase
      .from('integration_connections')
      .select('organization_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing) return errorResponse('Connection not found', 404);
    if (!orgIds.includes(existing.organization_id)) return errorResponse('Not a member of this workspace', 403);
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) patch.name = String(body.name);
    if (body.credentialId !== undefined) patch.credential_id = body.credentialId ? String(body.credentialId) : null;
    if (body.scopes !== undefined) patch.scopes = body.scopes;
    if (body.oauthMetadata !== undefined) patch.oauth_metadata = body.oauthMetadata;
    if (body.enabled !== undefined) patch.enabled = !!body.enabled;
    const { data, error } = await supabase
      .from('integration_connections')
      .update(patch)
      .eq('id', id)
      .select('id, name, provider, credential_id, scopes, enabled, updated_at')
      .single();
    if (error) return errorResponse(error.message, 400);
    return json({ connection: data });
  }

  // Delete connection.
  if (action === 'deleteConnection' && id) {
    const { data: existing } = await supabase
      .from('integration_connections')
      .select('organization_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing) return errorResponse('Connection not found', 404);
    if (!orgIds.includes(existing.organization_id)) return errorResponse('Not a member of this workspace', 403);
    const { error } = await supabase.from('integration_connections').delete().eq('id', id);
    if (error) return errorResponse(error.message, 500);
    return json({ ok: true, id });
  }

  // Create credential.
  if (action === 'createCredential') {
    const orgId = String(body.organizationId ?? '');
    if (!orgIds.includes(orgId)) return errorResponse('Not a member of this workspace', 403);
    const name = String(body.name ?? '').trim();
    const provider = String(body.provider ?? '').toLowerCase();
    if (!name || !provider) return errorResponse('name and provider are required');
    let encrypted: string;
    try {
      encrypted = await encryptSecret(JSON.stringify(body.secret ?? {}));
    } catch (e) {
      return errorResponse(e instanceof Error ? e.message : 'Encryption failed - is TAL_CREDENTIALS_KEY configured?', 500);
    }
    const { data, error } = await supabase
      .from('credentials')
      .insert({
        organization_id: orgId,
        name,
        provider,
        encrypted_data: encrypted,
        hint: { hasSecret: body.secret !== undefined && body.secret !== null, environment: 'encrypted' },
        is_secret: body.isSecret ?? true,
        created_by: userId,
      })
      .select('id, name, provider, created_at')
      .single();
    if (error) return errorResponse(error.message, 400);
    return json({ credential: data }, 201);
  }

  // Delete credential.
  if (action === 'deleteCredential' && id) {
    const { data: existing } = await supabase
      .from('credentials')
      .select('organization_id')
      .eq('id', id)
      .maybeSingle();
    if (!existing) return errorResponse('Credential not found', 404);
    if (!orgIds.includes(existing.organization_id)) return errorResponse('Not a member of this workspace', 403);
    const { error } = await supabase.from('credentials').delete().eq('id', id);
    if (error) return errorResponse(error.message, 500);
    return json({ ok: true, id });
  }

  return errorResponse('Not found', 404);
});
