create extension if not exists pgcrypto;

create table if not exists public.automation_flows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  summary text default '',
  plan_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.automation_nodes (
  id text not null,
  flow_id uuid not null references public.automation_flows(id) on delete cascade,
  title text not null,
  subtitle text default '',
  type text not null,
  lane integer not null default 0,
  column_index integer not null default 0,
  x numeric,
  y numeric,
  color text,
  agent_id text,
  mode text,
  approval text,
  retries integer not null default 0,
  notes text default '',
  make_config jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (flow_id, id)
);

create table if not exists public.automation_edges (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.automation_flows(id) on delete cascade,
  from_node_id text not null,
  to_node_id text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid references public.automation_flows(id) on delete set null,
  mode text not null,
  plan_name text,
  flow_name text,
  status text not null default 'queued',
  summary text default '',
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz
);

create table if not exists public.automation_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.automation_runs(id) on delete cascade,
  node_id text not null,
  node_title text not null,
  status text not null,
  response_preview text default '',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists automation_nodes_flow_id_idx on public.automation_nodes(flow_id);
create index if not exists automation_nodes_flow_position_idx on public.automation_nodes(flow_id, column_index, lane);
create index if not exists automation_edges_flow_id_idx on public.automation_edges(flow_id, sort_order);
create index if not exists automation_runs_flow_id_idx on public.automation_runs(flow_id, started_at desc);
create index if not exists automation_run_steps_run_id_idx on public.automation_run_steps(run_id, created_at desc);

create or replace function public.set_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists automation_flows_set_timestamp on public.automation_flows;
create trigger automation_flows_set_timestamp
before update on public.automation_flows
for each row
execute function public.set_timestamp();

drop trigger if exists automation_nodes_set_timestamp on public.automation_nodes;
create trigger automation_nodes_set_timestamp
before update on public.automation_nodes
for each row
execute function public.set_timestamp();

alter table public.automation_flows enable row level security;
alter table public.automation_nodes enable row level security;
alter table public.automation_edges enable row level security;
alter table public.automation_runs enable row level security;
alter table public.automation_run_steps enable row level security;

drop policy if exists "public flow access" on public.automation_flows;
create policy "public flow access"
on public.automation_flows
for all
using (true)
with check (true);

drop policy if exists "public node access" on public.automation_nodes;
create policy "public node access"
on public.automation_nodes
for all
using (true)
with check (true);

drop policy if exists "public edge access" on public.automation_edges;
create policy "public edge access"
on public.automation_edges
for all
using (true)
with check (true);

drop policy if exists "public run access" on public.automation_runs;
create policy "public run access"
on public.automation_runs
for all
using (true)
with check (true);

drop policy if exists "public run step access" on public.automation_run_steps;
create policy "public run step access"
on public.automation_run_steps
for all
using (true)
with check (true);
