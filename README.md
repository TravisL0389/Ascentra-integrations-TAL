# Ascentra Integrations

Ascentra Integrations is a Vite + React app hosting Ascentra's cross-app
automation builder ("Atom Builder") and a native, Supabase-owned execution
engine. Every atom run is real: flows snapshot into versioned graphs, a worker
drains them from a persistent job queue, and node traces land in the database.

## Requirements

- Node.js `20.19.0` or newer (see `.nvmrc`)
- npm
- A Supabase project for saves, run history, and native execution

## Local development

```bash
nvm use
npm install
cp .env.example .env.local
npm run dev
```

Frontend-only browsing works without Supabase; saves, exec history, and native
runs require the environment keys and the Supabase setup below.

## Environment variables

See `.env.example`. The app needs:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — browser client
- `TAL_WORKER_KEY`, `TAL_CREDENTIALS_KEY` — edge-function secrets (never shipped to the browser)

## Native execution engine

The core run loop is fully TAL-owned and does not depend on Make.com:

- **Manual Trigger → Transform → Branch → HTTP Request** runs through
  `create-execution` → `tal-worker` without any external automation tool
- Atoms: `trigger`, `transform`, `branch` (n8n-style passthrough with
  `_talBranch` metadata), `delay`, `approval`, `http` (SSRF-protected), `make`
- Expressions (e.g. `{{ previous.output.field }}`) including array literals and
  `coalesce`; no `eval()`
- Retries, per-node attempts, branch routes, and captured output/errors are
  recorded in `execution_node_runs` + `execution_events`

## Commands

| Command              | Purpose                                  |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Vite dev server                          |
| `npm run build`      | Production build                         |
| `npm run test`       | Vitest suite (engine, atoms, expressions) |
| `npm run typecheck`  | `tsc --noEmit` over the shared engine    |

## Supabase backend

Follow [SUPABASE_SETUP.md](./SUPABASE_SETUP.md):

1. Apply the three migrations (automation backend, shared SaaS core, native execution engine)
2. Deploy the edge functions (`create-execution`, `tal-worker`, `tal-hooks`, `tal-scheduler`, `tal-approval`, `tal-credentials`, `execute-automation`)
3. Set function secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TAL_WORKER_KEY`, `TAL_CREDENTIALS_KEY`)

## Deployment

Prepared for Vercel:

- `vite.config.js` configures the React app
- `vercel.json` adds the SPA rewrite fallback
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel environment

## Shared SaaS core

The workspace shell includes auth, organizations, memberships, subscriptions,
usage counters, and integration connections. Saves and executions are scoped to
the user's organization, with RLS enforcing tenant isolation.