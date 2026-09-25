create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, user_id)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan text not null check (plan in ('Starter', 'Pro', 'Enterprise')),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled')),
  stripe_customer_id text,
  stripe_subscription_id text,
  seats_included integer not null default 1,
  task_limit integer not null default 50,
  atom_limit integer not null default 0,
  renews_at timestamptz,
  mrr_cents integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_start date not null default current_date,
  tasks_used integer not null default 0,
  automations_saved integer not null default 0,
  runs_logged integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('stripe', 'make', 'resend', 'slack')),
  status text not null default 'pending' check (status in ('pending', 'connected', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, kind)
);

alter table public.automation_flows add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table public.automation_flows add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.automation_runs add column if not exists organization_id uuid references public.organizations(id) on delete set null;

create index if not exists idx_ascentra_memberships_org on public.organization_memberships (organization_id);
create index if not exists idx_ascentra_subscriptions_org on public.subscriptions (organization_id, created_at desc);
create index if not exists idx_ascentra_usage_org on public.usage_counters (organization_id, period_start desc);
create index if not exists idx_ascentra_flows_org on public.automation_flows (organization_id, updated_at desc);
create index if not exists idx_ascentra_runs_org on public.automation_runs (organization_id, started_at desc);
