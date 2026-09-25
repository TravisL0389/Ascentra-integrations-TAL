-- =============================================================================
-- TAL Native Execution Engine
-- Multi-tenant isolation (RLS), execution database model, persistent job queue,
-- credential vault, webhook endpoints, schedules, variables, approvals, audit.
-- Safe to run on an existing project. No destructive drops of user data.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 0. Membership helpers (security definer => no RLS recursion)
-- ---------------------------------------------------------------------------
create or replace function public.current_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select om.organization_id
  from public.organization_memberships om
  where om.user_id = auth.uid();
$$;

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(p_organization_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.role = p_role
  );
$$;

create or replace function public.workflow_org_id(p_workflow_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.automation_flows where id = p_workflow_id;
$$;

create or replace function public.is_workflow_accessible(p_workflow_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.automation_flows f
    join public.organization_memberships om on om.organization_id = f.organization_id
    where f.id = p_workflow_id and om.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 1. Profiles / organizations RLS (fix open policies)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
drop policy if exists "profiles select own or org members" on public.profiles;
create policy "profiles select own or org members"
on public.profiles for select
using (
  id = auth.uid()
  or id in (
    select om.user_id
    from public.organization_memberships om
    where om.organization_id in (select public.current_org_ids())
  )
);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
on public.profiles for insert
with check (id = auth.uid());

alter table public.organizations enable row level security;
drop policy if exists "orgs select member" on public.organizations;
create policy "orgs select member"
on public.organizations for select
using (id in (select public.current_org_ids()));

drop policy if exists "orgs insert authenticated" on public.organizations;
create policy "orgs insert authenticated"
on public.organizations for insert
with check (auth.uid() is not null);

drop policy if exists "orgs update owner" on public.organizations;
create policy "orgs update owner"
on public.organizations for update
using (public.has_org_role(id, 'owner'))
with check (public.has_org_role(id, 'owner'));

drop policy if exists "orgs delete owner" on public.organizations;
create policy "orgs delete owner"
on public.organizations for delete
using (public.has_org_role(id, 'owner'));

alter table public.organization_memberships enable row level security;
drop policy if exists "memberships select" on public.organization_memberships;
create policy "memberships select"
on public.organization_memberships for select
using (user_id = auth.uid() or organization_id in (select public.current_org_ids()));

drop policy if exists "memberships insert" on public.organization_memberships;
create policy "memberships insert"
on public.organization_memberships for insert
with check (
  public.has_org_role(organization_id, 'admin')
  or not exists (
    select 1 from public.organization_memberships om
    where om.organization_id = organization_id
  )
);

drop policy if exists "memberships update admin" on public.organization_memberships;
create policy "memberships update admin"
on public.organization_memberships for update
using (public.has_org_role(organization_id, 'admin'))
with check (public.has_org_role(organization_id, 'admin'));

drop policy if exists "memberships delete admin" on public.organization_memberships;
create policy "memberships delete admin"
on public.organization_memberships for delete
using (public.has_org_role(organization_id, 'admin')
  or (not exists (
    select 1 from public.organization_memberships om
    where om.organization_id = organization_id
  )));

alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions select member" on public.subscriptions;
create policy "subscriptions select member"
on public.subscriptions for select
using (organization_id in (select public.current_org_ids()));

drop policy if exists "subscriptions insert member" on public.subscriptions;
create policy "subscriptions insert member"
on public.subscriptions for insert
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "subscriptions update owner" on public.subscriptions;
create policy "subscriptions update owner"
on public.subscriptions for update
using (public.has_org_role(organization_id, 'owner'))
with check (public.has_org_role(organization_id, 'owner'));

alter table public.usage_counters enable row level security;
drop policy if exists "usage select member" on public.usage_counters;
create policy "usage select member"
on public.usage_counters for select
using (organization_id in (select public.current_org_ids()));

drop policy if exists "usage insert member" on public.usage_counters;
create policy "usage insert member"
on public.usage_counters for insert
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "usage update member" on public.usage_counters;
create policy "usage update member"
on public.usage_counters for update
using (organization_id in (select public.current_org_ids()))
with check (organization_id in (select public.current_org_ids()));

-- ---------------------------------------------------------------------------
-- 2. Automation schema: fix open RLS, keep existing columns for compatibility
-- ---------------------------------------------------------------------------
alter table public.automation_flows enable row level security;
drop policy if exists "public flow access" on public.automation_flows;
drop policy if exists "flows select member" on public.automation_flows;
create policy "flows select member"
on public.automation_flows for select
using (organization_id in (select public.current_org_ids()) or created_by = auth.uid());

drop policy if exists "flows insert member" on public.automation_flows;
create policy "flows insert member"
on public.automation_flows for insert
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "flows update member" on public.automation_flows;
create policy "flows update member"
on public.automation_flows for update
using (organization_id in (select public.current_org_ids()))
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "flows delete member" on public.automation_flows;
create policy "flows delete member"
on public.automation_flows for delete
using (organization_id in (select public.current_org_ids()));

alter table public.automation_nodes enable row level security;
drop policy if exists "public node access" on public.automation_nodes;
create policy "nodes select member"
on public.automation_nodes for select
using (public.workflow_org_id(flow_id) is not null and public.is_org_member(public.workflow_org_id(flow_id)));

create policy "nodes insert member"
on public.automation_nodes for insert
with check (public.is_org_member(public.workflow_org_id(flow_id)));

create policy "nodes update member"
on public.automation_nodes for update
using (public.is_org_member(public.workflow_org_id(flow_id)))
with check (public.is_org_member(public.workflow_org_id(flow_id)));

create policy "nodes delete member"
on public.automation_nodes for delete
using (public.is_org_member(public.workflow_org_id(flow_id)));

alter table public.automation_edges enable row level security;
drop policy if exists "public edge access" on public.automation_edges;
create policy "edges select member"
on public.automation_edges for select
using (public.is_org_member(public.workflow_org_id(flow_id)));

create policy "edges insert member"
on public.automation_edges for insert
with check (public.is_org_member(public.workflow_org_id(flow_id)));

create policy "edges update member"
on public.automation_edges for update
using (public.is_org_member(public.workflow_org_id(flow_id)))
with check (public.is_org_member(public.workflow_org_id(flow_id)));

create policy "edges delete member"
on public.automation_edges for delete
using (public.is_org_member(public.workflow_org_id(flow_id)));

alter table public.automation_runs enable row level security;
drop policy if exists "public run access" on public.automation_runs;
create policy "runs select member"
on public.automation_runs for select
using (organization_id in (select public.current_org_ids()));

drop policy if exists "runs insert member" on public.automation_runs;
create policy "runs insert member"
on public.automation_runs for insert
with check (organization_id in (select public.current_org_ids()));

alter table public.automation_run_steps enable row level security;
drop policy if exists "public run step access" on public.automation_run_steps;
create policy "run steps select member"
on public.automation_run_steps for select
using (run_id in (
  select r.id from public.automation_runs r
  where r.organization_id in (select public.current_org_ids())
));

-- ---------------------------------------------------------------------------
-- 3. Integration connections: widen provider model (keep legacy 'kind')
-- ---------------------------------------------------------------------------
alter table public.integration_connections add column if not exists provider text;
alter table public.integration_connections add column if not exists name text;
alter table public.integration_connections add column if not exists owner_id uuid references public.profiles(id) on delete set null;
alter table public.integration_connections add column if not exists scopes jsonb not null default '[]'::jsonb;
alter table public.integration_connections add column if not exists credential_id uuid;
alter table public.integration_connections add column if not exists expires_at timestamptz;
alter table public.integration_connections add column if not exists oauth_metadata jsonb not null default '{}'::jsonb;
alter table public.integration_connections add column if not exists last_used_at timestamptz;
alter table public.integration_connections add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.integration_connections set provider = kind where provider is null;
update public.integration_connections set name = provider where name is null;

alter table public.integration_connections drop constraint if exists integration_connections_kind_check;
alter table public.integration_connections add constraint integration_connections_provider_check
check (provider in ('stripe','make','resend','slack','google','gmail','hubspot','notion','discord','supabase','postgres','openai','gemini','anthropic','http','generic'));

alter table public.integration_connections enable row level security;
drop policy if exists "connections select member" on public.integration_connections;
create policy "connections select member"
on public.integration_connections for select
using (organization_id in (select public.current_org_ids()));

drop policy if exists "connections insert member" on public.integration_connections;
create policy "connections insert member"
on public.integration_connections for insert
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "connections update member" on public.integration_connections;
create policy "connections update member"
on public.integration_connections for update
using (organization_id in (select public.current_org_ids()))
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "connections delete member" on public.integration_connections;
create policy "connections delete member"
on public.integration_connections for delete
using (organization_id in (select public.current_org_ids()));

-- ---------------------------------------------------------------------------
-- 4. Credential vault (encrypted server-side; ciphertext is all the client sees)
-- ---------------------------------------------------------------------------
create table if not exists public.credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  provider text not null,
  encrypted_data text not null,
  hint jsonb not null default '{}'::jsonb,
  is_secret boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists credentials_org_idx on public.credentials (organization_id, name);

alter table public.credentials enable row level security;
drop policy if exists "credentials select member" on public.credentials;
create policy "credentials select member"
on public.credentials for select
using (organization_id in (select public.current_org_ids()));

drop policy if exists "credentials insert member" on public.credentials;
create policy "credentials insert member"
on public.credentials for insert
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "credentials update member" on public.credentials;
create policy "credentials update member"
on public.credentials for update
using (organization_id in (select public.current_org_ids()))
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "credentials delete member" on public.credentials;
create policy "credentials delete member"
on public.credentials for delete
using (organization_id in (select public.current_org_ids()));

-- integration_connections.credential_id FK depends on public.credentials (above).
alter table public.integration_connections drop constraint if exists integration_connections_credential_id_fkey;
alter table public.integration_connections add constraint integration_connections_credential_id_fkey
foreign key (credential_id) references public.credentials(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 5. Workflow versions (immutable published snapshots)
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.automation_flows(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  version integer not null default 1,
  status text not null check (status in ('draft', 'published', 'archived')),
  name text not null default '',
  summary text not null default '',
  graph jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  published_at timestamptz,
  unique (workflow_id, version)
);
create index if not exists workflow_versions_workflow_idx on public.workflow_versions (workflow_id, version desc);
create index if not exists workflow_versions_org_idx on public.workflow_versions (organization_id);

alter table public.automation_flows add column if not exists version_id uuid references public.workflow_versions(id) on delete set null;
alter table public.automation_flows add column if not exists published_version_id uuid references public.workflow_versions(id) on delete set null;

alter table public.workflow_versions enable row level security;
drop policy if exists "workflow_versions select member" on public.workflow_versions;
create policy "workflow_versions select member"
on public.workflow_versions for select
using (organization_id in (select public.current_org_ids()));

drop policy if exists "workflow_versions insert member" on public.workflow_versions;
create policy "workflow_versions insert member"
on public.workflow_versions for insert
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "workflow_versions update member" on public.workflow_versions;
create policy "workflow_versions update member"
on public.workflow_versions for update
using (organization_id in (select public.current_org_ids()))
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "workflow_versions delete member" on public.workflow_versions;
create policy "workflow_versions delete member"
on public.workflow_versions for delete
using (organization_id in (select public.current_org_ids()));

-- ---------------------------------------------------------------------------
-- 6. Executions (a run of an immutable graph snapshot)
-- ---------------------------------------------------------------------------
create table if not exists public.executions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references public.automation_flows(id) on delete set null,
  workflow_version_id uuid references public.workflow_versions(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  trigger_type text not null default 'manual'
    check (trigger_type in ('manual', 'webhook', 'schedule', 'api', 'resume')),
  trigger_config jsonb not null default '{}'::jsonb,
  payload jsonb,
  graph jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued','running','waiting','awaiting_approval','retry_scheduled','completed','failed','canceled','timed_out')),
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  duration_ms integer,
  error jsonb,
  progress jsonb not null default '{"resolvedEdges":[]}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  resume_token uuid default gen_random_uuid()
);

create index if not exists executions_org_started_idx on public.executions (organization_id, started_at desc);
create index if not exists executions_workflow_started_idx on public.executions (workflow_id, started_at desc);
create index if not exists executions_status_idx on public.executions (status, started_at desc);

create or replace function public.executions_set_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end; $$;

drop trigger if exists executions_set_timestamp on public.executions;
create trigger executions_set_timestamp before update on public.executions
for each row execute function public.executions_set_timestamp();

alter table public.executions enable row level security;
drop policy if exists "executions select member" on public.executions;
create policy "executions select member"
on public.executions for select
using (organization_id in (select public.current_org_ids()));

drop policy if exists "executions insert member" on public.executions;
create policy "executions insert member"
on public.executions for insert
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "executions cancel member" on public.executions;
create policy "executions cancel member"
on public.executions for update
using (organization_id in (select public.current_org_ids()) and status in ('queued','running','retry_scheduled','waiting'))
with check (organization_id in (select public.current_org_ids()));

-- ---------------------------------------------------------------------------
-- 6b. Execution-scoped helpers (depend on public.executions)
-- ---------------------------------------------------------------------------
create or replace function public.execution_org_id(p_execution_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.executions where id = p_execution_id;
$$;

create or replace function public.is_execution_accessible(p_execution_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.executions e
    join public.organization_memberships om on om.organization_id = e.organization_id
    where e.id = p_execution_id and om.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 7. Execution node runs (per-node records, retries persisted)
-- ---------------------------------------------------------------------------
create table if not exists public.execution_node_runs (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.executions(id) on delete cascade,
  node_id text not null,
  node_type text not null,
  attempt integer not null default 1,
  status text not null default 'queued'
    check (status in ('pending','queued','running','waiting','succeeded','failed','skipped','canceled','retrying')),
  input jsonb,
  output jsonb,
  error jsonb,
  branch text,
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  http_status integer,
  retry_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (execution_id, node_id, attempt)
);
create index if not exists exec_node_runs_execution_idx on public.execution_node_runs (execution_id, created_at);
create index if not exists exec_node_runs_node_idx on public.execution_node_runs (execution_id, node_id);

alter table public.execution_node_runs enable row level security;
drop policy if exists "node_runs select member" on public.execution_node_runs;
create policy "node_runs select member"
on public.execution_node_runs for select
using (public.is_execution_accessible(execution_id));

drop policy if exists "node_runs insert member" on public.execution_node_runs;
create policy "node_runs insert member"
on public.execution_node_runs for insert
with check (public.is_execution_accessible(execution_id));

drop policy if exists "node_runs update member" on public.execution_node_runs;
create policy "node_runs update member"
on public.execution_node_runs for update
using (public.is_execution_accessible(execution_id))
with check (public.is_execution_accessible(execution_id));

-- ---------------------------------------------------------------------------
-- 8. Execution jobs (persistent queue; claimable atomically)
-- ---------------------------------------------------------------------------
create table if not exists public.execution_jobs (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.executions(id) on delete cascade,
  node_id text not null,
  node_type text,
  attempt integer not null default 1,
  max_attempts integer not null default 3,
  status text not null default 'queued'
    check (status in ('queued','running','completed','failed','canceled','released')),
  available_at timestamptz not null default timezone('utc', now()),
  locked_at timestamptz,
  worker_id text,
  job_key text,
  error jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists execution_jobs_key_idx on public.execution_jobs (job_key);
create index if not exists execution_jobs_pending_idx on public.execution_jobs (status, available_at) where status = 'queued';
create index if not exists execution_jobs_execution_idx on public.execution_jobs (execution_id);

alter table public.execution_jobs enable row level security;
drop policy if exists "jobs select member" on public.execution_jobs;
create policy "jobs select member"
on public.execution_jobs for select
using (public.is_execution_accessible(execution_id));

-- Atomic claim: skip locked rows, mark running. One worker wins per job.
create or replace function public.claim_available_jobs(p_limit integer default 5, p_worker_id text default 'worker')
returns table (job_id uuid, execution_id uuid, node_id text, node_type text, attempt integer, max_attempts integer, available_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select j.id, j.execution_id, j.node_id, coalesce(j.node_type, 'manual'), j.attempt, j.max_attempts, j.available_at
    from public.execution_jobs j
    where j.status = 'queued'
      and j.available_at <= timezone('utc', now())
    order by j.available_at asc, j.created_at asc
    limit p_limit
    for update of j skip locked
  loop
    update public.execution_jobs
    set status = 'running', locked_at = timezone('utc', now()), worker_id = p_worker_id, updated_at = timezone('utc', now())
    where id = r.id;
    return query
      select r.id, r.execution_id, r.node_id, r.node_type, r.attempt, r.max_attempts, r.available_at;
  end loop;
end;
$$;

-- Reap stale 'running' jobs when the server restarts (workers die mid-atom).
create or replace function public.reap_stale_jobs(p_stale_after interval default interval '10 minutes')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer := 0;
begin
  update public.execution_jobs
  set status = 'queued', locked_at = null, worker_id = null, updated_at = timezone('utc', now())
  where status = 'running'
    and locked_at < timezone('utc', now()) - p_stale_after;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Enqueue a job idempotently (server side). job_key dedupes the same node+attempt.
create or replace function public.enqueue_execution_job(
  p_execution_id uuid,
  p_node_id text,
  p_node_type text default 'manual',
  p_attempt integer default 1,
  p_max_attempts integer default 3,
  p_available_at timestamptz default timezone('utc', now()),
  p_job_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_job_key is null then
    p_job_key := p_execution_id::text || ':' || p_node_id || ':' || p_attempt;
  end if;

  insert into public.execution_jobs (execution_id, node_id, node_type, attempt, max_attempts, available_at, job_key)
  values (p_execution_id, p_node_id, p_node_type, p_attempt, p_max_attempts, p_available_at, p_job_key)
  on conflict (job_key) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Execution events (audit trail of what happened)
-- ---------------------------------------------------------------------------
create table if not exists public.execution_events (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.executions(id) on delete cascade,
  node_id text,
  event text not null,
  level text not null default 'info',
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists exec_events_execution_idx on public.execution_events (execution_id, created_at);

alter table public.execution_events enable row level security;
drop policy if exists "events select member" on public.execution_events;
create policy "events select member"
on public.execution_events for select
using (public.is_execution_accessible(execution_id));

-- ---------------------------------------------------------------------------
-- 10. Webhook endpoints (TAL-owned trigger URLs)
-- ---------------------------------------------------------------------------
create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.automation_flows(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  name text not null default '',
  method text not null default 'POST',
  enabled boolean not null default true,
  payload_filter jsonb not null default '{}'::jsonb,
  secret_set bool not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_request_at timestamptz,
  last_status text
);
create index if not exists webhook_endpoints_token_idx on public.webhook_endpoints (token);
create index if not exists webhook_endpoints_org_idx on public.webhook_endpoints (organization_id, workflow_id);

alter table public.webhook_endpoints enable row level security;
drop policy if exists "webhooks select member" on public.webhook_endpoints;
create policy "webhooks select member"
on public.webhook_endpoints for select
using (organization_id in (select public.current_org_ids()));

drop policy if exists "webhooks insert member" on public.webhook_endpoints;
create policy "webhooks insert member"
on public.webhook_endpoints for insert
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "webhooks update member" on public.webhook_endpoints;
create policy "webhooks update member"
on public.webhook_endpoints for update
using (organization_id in (select public.current_org_ids()))
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "webhooks delete member" on public.webhook_endpoints;
create policy "webhooks delete member"
on public.webhook_endpoints for delete
using (organization_id in (select public.current_org_ids()));

-- ---------------------------------------------------------------------------
-- 11. Workflow schedules
-- ---------------------------------------------------------------------------
create table if not exists public.workflow_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.automation_flows(id) on delete cascade,
  name text not null default '',
  trigger_type text not null check (trigger_type in ('interval','cron','time')),
  interval_seconds integer,
  cron_expr text,
  schedule_time text,
  timezone text not null default 'UTC',
  next_run_at timestamptz not null default timezone('utc', now()),
  enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists workflow_schedules_due_idx on public.workflow_schedules (enabled, next_run_at);
create index if not exists workflow_schedules_org_idx on public.workflow_schedules (organization_id);

alter table public.workflow_schedules enable row level security;
drop policy if exists "schedules select member" on public.workflow_schedules;
create policy "schedules select member"
on public.workflow_schedules for select
using (organization_id in (select public.current_org_ids()));

drop policy if exists "schedules insert member" on public.workflow_schedules;
create policy "schedules insert member"
on public.workflow_schedules for insert
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "schedules update member" on public.workflow_schedules;
create policy "schedules update member"
on public.workflow_schedules for update
using (organization_id in (select public.current_org_ids()))
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "schedules delete member" on public.workflow_schedules;
create policy "schedules delete member"
on public.workflow_schedules for delete
using (organization_id in (select public.current_org_ids()));

-- ---------------------------------------------------------------------------
-- 12. Organization variables
-- ---------------------------------------------------------------------------
create table if not exists public.organization_variables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  value jsonb not null default 'null'::jsonb,
  value_type text not null default 'string',
  is_secret boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, key)
);
create index if not exists org_variables_org_idx on public.organization_variables (organization_id);

alter table public.organization_variables enable row level security;
drop policy if exists "org_variables select member" on public.organization_variables;
create policy "org_variables select member"
on public.organization_variables for select
using (organization_id in (select public.current_org_ids()));

drop policy if exists "org_variables insert member" on public.organization_variables;
create policy "org_variables insert member"
on public.organization_variables for insert
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "org_variables update member" on public.organization_variables;
create policy "org_variables update member"
on public.organization_variables for update
using (organization_id in (select public.current_org_ids()))
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "org_variables delete member" on public.organization_variables;
create policy "org_variables delete member"
on public.organization_variables for delete
using (organization_id in (select public.current_org_ids()));

-- ---------------------------------------------------------------------------
-- 13. Approvals
-- ---------------------------------------------------------------------------
create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  execution_id uuid not null references public.executions(id) on delete cascade,
  node_id text not null,
  title text not null default '',
  message text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decision jsonb,
  approver_id uuid references public.profiles(id) on delete set null,
  comment text,
  decided_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists approvals_org_status_idx on public.approvals (organization_id, status);
create index if not exists approvals_execution_idx on public.approvals (execution_id);

alter table public.approvals enable row level security;
drop policy if exists "approvals select member" on public.approvals;
create policy "approvals select member"
on public.approvals for select
using (organization_id in (select public.current_org_ids()));

drop policy if exists "approvals insert member" on public.approvals;
create policy "approvals insert member"
on public.approvals for insert
with check (organization_id in (select public.current_org_ids()));

drop policy if exists "approvals decide member" on public.approvals;
create policy "approvals decide member"
on public.approvals for update
using (organization_id in (select public.current_org_ids()) and status = 'pending')
with check (organization_id in (select public.current_org_ids()));

-- ---------------------------------------------------------------------------
-- 14. Audit logs
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists audit_logs_org_idx on public.audit_logs (organization_id, created_at desc);

alter table public.audit_logs enable row level security;
drop policy if exists "audit_logs select member" on public.audit_logs;
create policy "audit_logs select member"
on public.audit_logs for select
using (organization_id in (select public.current_org_ids()));

-- Server-side write helper (edge functions use this to write audit rows).
create or replace function public.insert_audit_log(
  p_organization_id uuid, p_actor_id uuid, p_action text,
  p_resource_type text, p_resource_id text, p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.audit_logs (organization_id, actor_id, action, resource_type, resource_id, metadata)
  values (p_organization_id, p_actor_id, p_action, p_resource_type, p_resource_id, p_metadata)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 15. Initialization: backfill a published workflow version for any existing
--     flow without one, so history maps onto a real immutable version.
-- ---------------------------------------------------------------------------
insert into public.workflow_versions (workflow_id, organization_id, version, status, name, summary, graph, created_at, published_at)
select
  f.id,
  f.organization_id,
  1,
  'published',
  f.name,
  f.summary,
  jsonb_build_object(
    'nodes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'title', n.title, 'subtitle', n.subtitle, 'type', n.type,
        'lane', n.lane, 'column_index', n.column_index, 'color', n.color,
        'agent_id', n.agent_id, 'mode', n.mode, 'approval', n.approval,
        'retries', n.retries, 'notes', n.notes, 'make_config', n.make_config
      ) order by n.column_index, n.lane) from public.automation_nodes n where n.flow_id = f.id
    ), '[]'::jsonb),
    'edges', coalesce((
      select jsonb_agg(jsonb_build_object('from', e.from_node_id, 'to', e.to_node_id, 'sort_order', e.sort_order) order by e.sort_order)
      from public.automation_edges e where e.flow_id = f.id
    ), '[]'::jsonb)
  ),
  timezone('utc', now()),
  timezone('utc', now())
from public.automation_flows f
where not exists (
  select 1 from public.workflow_versions wv where wv.workflow_id = f.id and wv.status = 'published'
);

update public.automation_flows f
set published_version_id = wv.id
from public.workflow_versions wv
where wv.workflow_id = f.id
  and wv.status = 'published'
  and wv.version = (select max(wv2.version) from public.workflow_versions wv2 where wv2.workflow_id = f.id and wv2.status = 'published')
  and f.published_version_id is null;

-- Also ensure every org's flows have an owner membership baseline untouched.
-- Final sanity: the legacy edge function no longer needs Make-only tables.