const PLAN_CATALOG = {
  Starter: {
    code: 'Starter',
    label: 'Starter',
    seatsIncluded: 1,
    taskLimit: 50,
    atomLimit: 0,
  },
  Pro: {
    code: 'Pro',
    label: 'Pro',
    seatsIncluded: 5,
    taskLimit: 2000,
    atomLimit: 3,
  },
  Enterprise: {
    code: 'Enterprise',
    label: 'Enterprise',
    seatsIncluded: 20,
    taskLimit: 10000,
    atomLimit: 10,
  },
};

export function getPlanDefinition(planCode) {
  return PLAN_CATALOG[planCode] || PLAN_CATALOG.Starter;
}

export function buildSeedWorkspaceSnapshot() {
  return {
    workspace: {
      organizationId: 'seed-ascentra',
      workspaceName: 'Ascentra Preview Workspace',
      workspaceSlug: 'ascentra',
      operatorName: 'Langolf Operator',
      operatorRole: 'owner',
      plan: getPlanDefinition('Starter'),
      seats: {
        used: 1,
        included: 1,
      },
      billing: {
        status: 'unconfigured',
        renewalDate: 'Not connected',
        monthlyRecurringRevenue: 0,
      },
      usage: {
        tasksUsed: 12,
        tasksLimit: 50,
        automationsSaved: 0,
        runsLogged: 0,
      },
      setup: {
        auth: 'pending',
        database: 'pending',
        billing: 'missing',
        automations: 'preview',
        make: 'pending',
      },
    },
    mode: 'seed',
    warnings: ['Ascentra is running in preview mode until the Supabase workspace is connected.'],
    timestamp: new Date().toISOString(),
  };
}
