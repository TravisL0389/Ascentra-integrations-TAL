import { useCallback, useEffect, useState } from 'react';
import { hasSupabaseConfig, supabase } from './supabaseClient.js';
import { buildSeedWorkspaceSnapshot, getPlanDefinition } from './workspaceSeed.js';

const DEFAULT_WORKSPACE_NAME = 'Ascentra Integrations';
const DEFAULT_WORKSPACE_SLUG = 'ascentra';

function slugify(value) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || DEFAULT_WORKSPACE_SLUG
  );
}

function mapSetupStatus(value, fallbackConnected) {
  if (value === 'connected') return 'ready';
  if (value === 'pending') return 'pending';
  return fallbackConnected ? 'pending' : 'missing';
}

async function fetchWorkspaceSnapshot(workspaceSlug = DEFAULT_WORKSPACE_SLUG) {
  if (!hasSupabaseConfig || !supabase) {
    return buildSeedWorkspaceSnapshot();
  }

  const seed = buildSeedWorkspaceSnapshot();

  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', workspaceSlug)
    .maybeSingle();

  if (!organization) {
    return {
      ...seed,
      warnings: ['Supabase is connected, but the Ascentra workspace has not been bootstrapped yet.'],
    };
  }

  const [membershipResult, operatorResult, subscriptionResult, usageResult, integrationsResult, flowsResult, runsResult] = await Promise.all([
    supabase.from('organization_memberships').select('id, role', { count: 'exact' }).eq('organization_id', organization.id),
    supabase
      .from('organization_memberships')
      .select('role, profiles(full_name, email)')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('subscriptions')
      .select('plan, status, seats_included, task_limit, atom_limit, renews_at, mrr_cents')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('usage_counters')
      .select('tasks_used, automations_saved, runs_logged')
      .eq('organization_id', organization.id)
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('integration_connections').select('kind, status').eq('organization_id', organization.id),
    supabase.from('automation_flows').select('id', { count: 'exact', head: true }).eq('organization_id', organization.id),
    supabase.from('automation_runs').select('id', { count: 'exact', head: true }).eq('organization_id', organization.id),
  ]);

  const subscription = subscriptionResult.data;
  const usage = usageResult.data;
  const plan = getPlanDefinition(subscription?.plan);
  const integrationMap = new Map((integrationsResult.data || []).map((item) => [item.kind, item.status]));
  const operatorProfile = operatorResult.data?.profiles;

  return {
    workspace: {
      organizationId: organization.id,
      workspaceName: organization.name,
      workspaceSlug: organization.slug,
      operatorName:
        operatorProfile?.full_name ||
        operatorProfile?.email ||
        seed.workspace.operatorName,
      operatorRole: operatorResult.data?.role || seed.workspace.operatorRole,
      plan: {
        ...plan,
        seatsIncluded: subscription?.seats_included || plan.seatsIncluded,
        taskLimit: subscription?.task_limit || plan.taskLimit,
        atomLimit: subscription?.atom_limit || plan.atomLimit,
      },
      seats: {
        used: membershipResult.count || 1,
        included: subscription?.seats_included || plan.seatsIncluded,
      },
      billing: {
        status: subscription?.status || 'trialing',
        renewalDate: subscription?.renews_at
          ? new Date(subscription.renews_at).toISOString().split('T')[0]
          : 'Trialing',
        monthlyRecurringRevenue: subscription?.mrr_cents
          ? Math.round(subscription.mrr_cents / 100)
          : 0,
      },
      usage: {
        tasksUsed: usage?.tasks_used || 0,
        tasksLimit: subscription?.task_limit || plan.taskLimit,
        automationsSaved: usage?.automations_saved ?? flowsResult.count ?? 0,
        runsLogged: usage?.runs_logged ?? runsResult.count ?? 0,
      },
      setup: {
        auth: 'ready',
        database: 'ready',
        billing: mapSetupStatus(integrationMap.get('stripe'), false),
        automations:
          flowsResult.count || runsResult.count || usage?.automations_saved
            ? 'ready'
            : 'pending',
        make: mapSetupStatus(integrationMap.get('make'), true),
      },
    },
    mode: 'supabase',
    warnings: [],
    timestamp: new Date().toISOString(),
  };
}

async function bootstrapWorkspace({ workspaceName, workspaceSlug, user }) {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase is not configured yet. Add the project keys to connect a live backend.');
  }

  if (!user) {
    throw new Error('Sign in before bootstrapping the workspace.');
  }

  const slug = slugify(workspaceSlug || DEFAULT_WORKSPACE_SLUG);
  const name = workspaceName?.trim() || DEFAULT_WORKSPACE_NAME;

  await supabase.from('profiles').upsert({
    id: user.id,
    full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Workspace owner',
    email: user.email || null,
  });

  let organizationId = null;

  const { data: existingOrganization } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existingOrganization?.id) {
    organizationId = existingOrganization.id;
  } else {
    const { data: createdOrganization, error: organizationError } = await supabase
      .from('organizations')
      .insert({ name, slug })
      .select('id')
      .single();

    if (organizationError || !createdOrganization) {
      throw new Error(organizationError?.message || 'Failed to create the Ascentra workspace.');
    }

    organizationId = createdOrganization.id;
  }

  await supabase.from('organization_memberships').upsert(
    {
      organization_id: organizationId,
      user_id: user.id,
      role: 'owner',
    },
    { onConflict: 'organization_id,user_id' }
  );

  const { data: existingSubscription } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existingSubscription?.id) {
    await supabase.from('subscriptions').insert({
      organization_id: organizationId,
      plan: 'Starter',
      status: 'trialing',
      seats_included: 1,
      task_limit: 50,
      atom_limit: 0,
      renews_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      mrr_cents: 0,
    });
  }

  const { data: existingUsage } = await supabase
    .from('usage_counters')
    .select('id')
    .eq('organization_id', organizationId)
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existingUsage?.id) {
    await supabase.from('usage_counters').insert({
      organization_id: organizationId,
      period_start: new Date().toISOString().split('T')[0],
      tasks_used: 0,
      automations_saved: 0,
      runs_logged: 0,
    });
  }

  const integrations = [
    { kind: 'stripe', status: 'pending' },
    { kind: 'make', status: 'connected' },
    { kind: 'resend', status: 'pending' },
  ];

  for (const integration of integrations) {
    await supabase.from('integration_connections').upsert(
      {
        organization_id: organizationId,
        kind: integration.kind,
        status: integration.status,
      },
      { onConflict: 'organization_id,kind' }
    );
  }

  return fetchWorkspaceSnapshot(slug);
}

export function useWorkspaceAccount() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(buildSeedWorkspaceSnapshot());
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setSnapshotLoading(true);
    try {
      if (hasSupabaseConfig && !user) {
        const seed = buildSeedWorkspaceSnapshot();
        setSnapshot(seed);
        setError(null);
        return seed;
      }
      const nextSnapshot = await fetchWorkspaceSnapshot();
      setSnapshot(nextSnapshot);
      setError(null);
      return nextSnapshot;
    } catch (nextError) {
      setError(nextError.message || 'Failed to load workspace state.');
      const seed = buildSeedWorkspaceSnapshot();
      setSnapshot(seed);
      return seed;
    } finally {
      setSnapshotLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const signIn = useCallback(async ({ email, password }) => {
    if (!supabase) {
      throw new Error('Supabase is not configured yet.');
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      throw signInError;
    }

    await reload();
  }, [reload]);

  const signUp = useCallback(async ({ email, password }) => {
    if (!supabase) {
      throw new Error('Supabase is not configured yet.');
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      throw signUpError;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    await reload();
  }, [reload]);

  const bootstrap = useCallback(
    async ({ workspaceName, workspaceSlug }) => {
      const nextSnapshot = await bootstrapWorkspace({
        workspaceName,
        workspaceSlug,
        user,
      });
      setSnapshot(nextSnapshot);
      return nextSnapshot;
    },
    [user]
  );

  return {
    hasSupabaseConfig,
    supabase,
    session,
    user,
    authLoading,
    snapshot,
    snapshotLoading,
    error,
    reload,
    signIn,
    signUp,
    signOut,
    bootstrap,
  };
}
