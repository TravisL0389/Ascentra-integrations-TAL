-- Preserve the builder's graph contract when drafts are persisted.
alter table public.automation_nodes
  add column if not exists kind text,
  add column if not exists definition_version integer,
  add column if not exists disabled boolean not null default false;

alter table public.automation_edges
  add column if not exists source_port_id text,
  add column if not exists target_port_id text,
  add column if not exists label text;
