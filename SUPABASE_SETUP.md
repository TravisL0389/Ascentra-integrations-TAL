# Ascentra Supabase Backend Setup

This project runs its own native automation engine (no Make.com dependency for
core runs). Setup covers the database schema, edge functions, and secrets.

## 1. Frontend environment

Create `.env.local` in the project root (see `.env.example`):

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Restart `npm run dev` after adding keys.

## 2. Database

Apply the migrations in order:

- `supabase/migrations/20260426_ascentra_automation_backend.sql`
- `supabase/migrations/20260429_ascentra_shared_saas_core.sql`
- `supabase/migrations/20260829_tal_native_execution_engine.sql`

The last migration creates the execution engine schema with RLS locked down:

- `executions` (status: queued → running → completed/failed/canceled/timed_out), payload + immutable graph snapshot
- `execution_jobs` (claimable queue, `FOR UPDATE SKIP LOCKED`, stale-running reclaim via `claim_available_jobs`)
- `execution_node_runs` and `execution_events` (per-node traces)
- `workflow_versions` (run snapshots)
- `webhooks`, `schedules`, `approvals`, `credentials`, `organization_variables`, `audit_logs`
- RLS: organizations can only see their own data; select-for-members on execution reads so the browser can load execution details

## 3. Edge functions

Deploy all functions in `supabase/functions/`:

- `create-execution` — snapshot + enqueue a manual run (called by the builder)
- `tal-worker` — drains the job queue and executes atoms server-side (`/poke` for instant wake)
- `tal-hooks` — webhook-triggered runs
- `tal-scheduler` — scheduled runs (hourly Deno cron)
- `tal-approval` — approval gate handling
- `tal-credentials` — encrypted credential vault
- `tal-connections` — integration-connection + credential management (provider framework)
- `tal-executions` — execution controls (cancel / retry / detail)
- `execute-automation` — legacy Make webhook proxy (kept for backward compatibility)

```bash
supabase functions deploy create-execution
supabase functions deploy tal-worker
supabase functions deploy tal-hooks
supabase functions deploy tal-scheduler
supabase functions deploy tal-approval
supabase functions deploy tal-credentials
supabase functions deploy tal-connections
supabase functions deploy tal-executions
supabase functions deploy execute-automation
```

## 4. Function secrets

Set in the Supabase project (Level 2 secrets so `create-execution` can also read them):

- `SUPABASE_URL` (injected by Supabase automatically for level 1/2)
- `SUPABASE_SERVICE_ROLE_KEY`
- `TAL_WORKER_KEY` — shared secret the worker expects on `/poke` and `/claim` calls (`x-tal-worker-key`)
- `TAL_CREDENTIALS_KEY` — AES key (32 bytes) used to encrypt stored credentials; must be set before `tal-credentials` writes any secrets

## 5. Auth / memberships

Manual runs require a signed-in user who is a member of the flow's organization
(`create-execution` verifies the Bearer JWT and the membership row). Members can
read execution data via RLS. No sign‑in is required for browsing, saving drafts,
or the legacy Make path.

## 6. Builder behavior

Once configured:

- `Save backend` persists flows, nodes (incl. native `config`), and edges
- `Run path` serializes the current graph, saves it, and starts a native execution through `create-execution`
- `Execution history` lists native `executions`; clicking a run loads its node runs + events into the `Execution log`
- The inspector's `Native config` panel edits atom config (HTTP URL/method/headers/body, transform mapping, branch conditions, delay seconds, approval copy)
- `Backend status` in the admin QA lab confirms env, edge reachability, and credentials
- `Connections & credentials` panel manages named connections + encrypted credentials; provider-typed nodes resolve them at run time via the provider framework one level up from the AI/HTTP atoms
- `Execution history` rows expose `Cancel` (running/queued) and `Retry` (failed/canceled/timed_out) actions through `tal-executions`
- Without Supabase keys the builder falls back to a browser-only preview bridge

## 7. Testing / validation

```bash
npm run typecheck
npm run test    # vitest — engine, atoms, expressions, graph, retry, ssrf, schedule, crypto
npm run build
```

## 8. Local dev with the Supabase CLI

- `supabase/config.toml` already declares the functions and local ports
- `supabase start` (Docker) brings up Postgres + the edge runtime
- `supabase functions serve` runs functions locally with the function secrets from your environment