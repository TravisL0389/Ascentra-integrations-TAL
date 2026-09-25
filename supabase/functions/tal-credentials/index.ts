// tal-credentials: server-side credential vault (client never sees secrets).
//   GET    /                     list caller's org credentials (masked)
//   POST   /                     { organizationId, name, provider, secret(any), isSecret }
//   DELETE /:id
// Member JWT required. Secrets are AES-256-GCM encrypted with TAL_CREDENTIALS_KEY.

import { json, getSupabase, errorResponse, verifyMemberJwt } from '../_shared/edge.ts';
import { encryptSecret } from '../_shared/crypto.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok');

  const userId = await verifyMemberJwt(request);
  if (!userId) return errorResponse('Unauthorized', 401);

  const supabase = getSupabase();

  // Build the set of orgs this user belongs to.
  const { data: orgRows } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', userId);
  const orgIds = (orgRows ?? []).map((r) => r.organization_id);

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const method = request.method;

  if (method === 'GET') {
    const { data, error } = await supabase
      .from('credentials')
      .select('id, name, provider, hint, is_secret, created_at, organization_id')
      .in('organization_id', orgIds);
    if (error) return errorResponse(error.message, 500);
    return json({ credentials: data ?? [] });
  }

  if (method === 'DELETE') {
    const id = pathParts[pathParts.length - 1];
    if (!id || id === 'tal-credentials') return errorResponse('credential id required', 400);
    const { data: cred, error: cerr } = await supabase
      .from('credentials')
      .select('id, organization_id')
      .eq('id', id)
      .maybeSingle();
    if (cerr || !cred) return errorResponse('Credential not found', 404);
    if (!orgIds.includes(cred.organization_id)) return errorResponse('Not a member of this workspace', 403);
    const { error } = await supabase.from('credentials').delete().eq('id', id);
    if (error) return errorResponse(error.message, 500);
    return json({ ok: true, id });
  }

  if (method !== 'POST') return errorResponse('Method not allowed', 405);

  let body: { organizationId?: string; name?: string; provider?: string; secret?: unknown; isSecret?: boolean };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }
  if (!body.organizationId || !body.name || !body.provider) {
    return errorResponse('organizationId, name and provider are required');
  }
  if (!orgIds.includes(body.organizationId)) {
    return errorResponse('Not a member of this workspace', 403);
  }

  let encrypted: string;
  try {
    encrypted = await encryptSecret(JSON.stringify(body.secret ?? {}));
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Encryption failed - is TAL_CREDENTIALS_KEY configured?', 500);
  }

  const { data, error } = await supabase
    .from('credentials')
    .insert({
      organization_id: body.organizationId,
      name: body.name,
      provider: body.provider,
      encrypted_data: encrypted,
      hint: { hasSecret: body.secret !== undefined && body.secret !== null, environment: 'encrypted' },
      is_secret: body.isSecret ?? true,
      created_by: userId,
    })
    .select('id, name, provider, created_at')
    .single();
  if (error) return errorResponse(error.message, 400);
  return json({ credential: data }, 201);
});