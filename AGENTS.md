# AGENTS.md

## Architecture

Two runtimes in one repo:

- **Frontend**: React (`.jsx`) app under `src/`, built with Vite. Entrypoint `src/main.jsx` → `src/App.jsx`. Big component files (`AutomationAtomBuilder.jsx`, `App.jsx`, `AscentraPlatformExpanded.jsx`) are the workspace shell and Atom Builder.
- **Edge functions**: Deno runtime under `supabase/functions/**`. The native execution engine lives in `supabase/functions/_shared/**` (atoms, engine, graph, expressions). The frontend does NOT import `_shared`; it talks to backend only via `supabase.functions.invoke` (`src/lib/automationBackend.js` — both the legacy `execute-automation` path and the native `create-execution` path).

## Language split (important)

- Edge function / engine code is **TypeScript** (`supabase/functions/**`).
- Frontend is **plain JSX** (`src/**`) — do not add TS types there.
- `_shared` uses explicit `.ts`-suffixed imports (`from './types.ts'`). Required by Deno; vitest/vite resolve them natively. Keep the `.ts` suffix in all new `_shared`/function imports.

## Commands

```bash
npm run dev              # Vite dev server on 127.0.0.1:5173 (port from config.toml site_url)
npm run build            # production build
npm run test             # vitest run (engine, atoms, expressions)
npm run test:watch       # vitest watch
npm run typecheck        # tsc --noEmit — ONLY covers _shared + tests, NOT the JSX frontend
npm run validate:navigation  # custom nav/button/route lint script — run before finishing UI changes
```

- No linter or prettier is configured.
- Only `npm run typecheck` + `npm run test` verify the engine; the `.jsx` frontend has no static checks beyond `validate:navigation`.

## Tests

- Vitest runs in **Node** env over `tests/**/*.test.ts` (`vitest.config.ts`), even though the code under test is Deno edge functions.
- `tests/setup.ts` stubs a global `Deno` (only `Deno.env.get('TAL_CREDENTIALS_KEY')`) so `_shared` modules load in Node. If you touch code that reads other env keys in module scope, extend this stub.
- Some tests are **source-scanning** (`tests/migration-order.test.ts`, `tests/worker-order.test.ts`) — they read migration/worker files and assert ordering/guard constants. If you rename a table, reorder a migration, or change `MAX_JOBS_PER_INVOCATION` / `WORKER_BUDGET_MS` / `MAX_GRAPH_NODES`, update these tests.

## Supabase backend

- Full setup in `SUPABASE_SETUP.md`; apply migrations in order (`supabase/migrations/`).
- Migrations are namespace/timestamp prefixed. Order matters and is asserted by `tests/migration-order.test.ts`.
- Edge functions enforce auth in code (member JWT / `TAL_WORKER_KEY`); local dev falls back to open when `TAL_WORKER_KEY` is unset.
- Do not ship server-side secrets to the browser: `SUPABASE_SERVICE_ROLE_KEY`, `TAL_WORKER_KEY`, `TAL_CREDENTIALS_KEY` are function secrets, not `VITE_*` vars.

## Config / gotchas

- Node `>=20.19.0` (`.nvmrc`); `nvm use` before npm.
- `.env.local` is gitignored; copy from `.env.example`. Frontend-only browsing works without Supabase; saves/runs need the env keys + Supabase project.
- Vercel SPA fallback is in `vercel.json`; deploy is Vite.
