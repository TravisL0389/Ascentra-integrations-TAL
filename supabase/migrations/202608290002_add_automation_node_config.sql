alter table public.automation_nodes
  add column if not exists config jsonb;
