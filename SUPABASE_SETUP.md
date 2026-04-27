# Ascentra Supabase Backend Setup

This project is ready for a Supabase-backed automation layer.

## 1. Frontend environment

Create `.env.local` in the project root:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 2. Database

Run the SQL in:

`supabase/migrations/20260426_ascentra_automation_backend.sql`

That creates:

- `automation_flows`
- `automation_nodes`
- `automation_edges`
- `automation_runs`
- `automation_run_steps`

## 3. Edge function

Deploy the function in:

`supabase/functions/execute-automation/index.ts`

It receives builder requests and safely calls Make webhooks server-side.

## 4. Supabase secrets

Set these in your Supabase project for the edge function runtime:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 5. Builder behavior

Once configured:

- `Save backend` stores the current flow, nodes, and edges in Supabase
- `Send test` can route through the backend
- `Activate path` can execute the full graph through the Supabase edge function
- `Backend status` in the admin QA lab confirms the frontend env, edge function reachability, and server credential health

## 6. Execution behavior

- Frontend local tests and backend path runs now stop on the first failed live node so QA matches production expectations
- Logic nodes are recorded as routing steps
- Network failures and invalid webhook targets are captured as run errors instead of leaving runs hanging
- Backend run history should reflect the same success or failure outcome you see in the UI

## 7. Make connection

For each node:

- enable `Make sync`
- paste the Make webhook URL
- set the payload you want to send

The edge function will POST that payload to the webhook during tests and path runs.
