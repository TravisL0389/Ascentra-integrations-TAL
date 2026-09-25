-- The worker reads the selected record by field name. Explicit aliases are
-- required for expressions such as coalesce(j.node_type, 'manual').
create or replace function public.claim_available_jobs(
  p_limit integer default 5,
  p_worker_id text default 'worker'
)
returns table (
  job_id uuid,
  execution_id uuid,
  node_id text,
  node_type text,
  attempt integer,
  max_attempts integer,
  available_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select
      j.id as job_id,
      j.execution_id as execution_id,
      j.node_id as node_id,
      coalesce(j.node_type, 'manual') as node_type,
      j.attempt as attempt,
      j.max_attempts as max_attempts,
      j.available_at as available_at
    from public.execution_jobs j
    where j.status = 'queued'
      and j.available_at <= timezone('utc', now())
    order by j.available_at asc, j.created_at asc
    limit p_limit
    for update of j skip locked
  loop
    update public.execution_jobs
    set status = 'running', locked_at = timezone('utc', now()), worker_id = p_worker_id, updated_at = timezone('utc', now())
    where id = r.job_id;
    return query
      select r.job_id, r.execution_id, r.node_id, r.node_type, r.attempt, r.max_attempts, r.available_at;
  end loop;
end;
$$;
