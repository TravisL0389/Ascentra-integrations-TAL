# Ascentra Integrations

Ascentra Integrations is a Vite + React application with a dedicated Atom Builder workspace and a Supabase-backed automation layer.

## Requirements

- Node.js `20.19.0` or newer
- npm
- A Supabase project if you want backend saves, run history, and live automation execution

## Local development

```bash
nvm use
npm install
cp .env.example .env.local
npm run dev
```

Frontend-only browsing works without Supabase, but backend-connected builder behavior requires environment variables.

## Environment variables

Create `.env.local` for local work, or set these in your deployment provider:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Deployment

This repo is prepared for Vercel deployment:

- `vite.config.js` explicitly configures the Vite React app
- `vercel.json` adds the SPA rewrite fallback to `index.html`
- `.nvmrc` pins a Vite 7 compatible Node version

### Vercel steps

1. Import the GitHub repo into Vercel.
2. Set the framework to `Vite` if Vercel does not detect it automatically.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project environment settings.
4. Deploy.

## Supabase backend

The frontend host is only one half of deployment. For the Atom Builder backend to be fully live, also complete the steps in [SUPABASE_SETUP.md](./SUPABASE_SETUP.md):

- run the database migration
- deploy `supabase/functions/execute-automation`
- set Supabase function secrets

Without that backend setup, the app still deploys, but the builder stays in frontend/local preview mode for save and execution features.
