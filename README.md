# Pennywise

Pennywise is a personal finance tracking web app for recording income and expenses, categorizing transactions, reviewing transaction history, and monitoring the current balance.

This repository is a `pnpm` monorepo with a React frontend, an Express backend, and a shared contracts package. The current completion artifacts for the supported delivery path live under `specs/001-core-v1-completion/`.

## Tech Stack

- React 19 with Vite in `apps/web`
- Express 5 in `apps/api`
- Shared Zod contracts in `packages/contracts`
- PostgreSQL for application and session data
- TypeScript, Vitest, Playwright, and Biome across the workspace

## Repository Layout

```text
apps/
  api/         Express API workspace
  web/         React + Vite frontend workspace
packages/
  contracts/   Shared Zod schemas, types, and validation helpers
docker/
  postgres/    Local database init scripts
specs/
  001-core-v1-completion/
```

## Prerequisites

- Node.js `24.x`
- `pnpm@10.33.0`
- Docker or another compatible container runtime

## Environment

Create a local `.env` file from `.env.example`.

```bash
cp .env.example .env
```

Default local values:

```env
DATABASE_URL=postgresql://pennywise:pennywise@localhost:5432/pennywise
TEST_DATABASE_URL=postgresql://pennywise:pennywise@localhost:5432/pennywise_test
SESSION_SECRET=change-me
DEMO_USERNAME=demo
DEMO_PASSWORD=demo-password
PORT=3000
```

`DATABASE_URL` is used by the application runtime and migration/seed commands. `TEST_DATABASE_URL` is used by the DB-backed API suites. The local Docker Compose setup initializes both databases automatically.

## Local Setup

Install dependencies:

```bash
pnpm install
```

Start the local PostgreSQL container:

```bash
pnpm db:up
```

This starts the `postgres` service from `docker-compose.yml` on host port `5432`. The init script in `docker/postgres/init/` creates the `pennywise_test` database alongside the main `pennywise` database, so both app and test commands can use the default `.env` values.

Apply migrations and seed the demo data:

```bash
pnpm db:migrate
pnpm db:seed
```

Useful database commands:

```bash
pnpm db:down
pnpm db:logs
```

## Local Development

Run the API and web workspaces together:

```bash
pnpm dev
```

Expected local behavior:

- Vite serves the web app on `http://localhost:5173`
- Express serves the API on `http://localhost:3000`
- The Vite dev server proxies `/api` requests to the backend

Demo login defaults come from `.env.example`:

- username: `demo`
- password: `demo-password`

## Verification Commands

Repo-wide verification commands:

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm test:e2e
```

Command scope:

- `pnpm typecheck` checks all workspaces
- `pnpm build` builds contracts, API, and web assets
- `pnpm test` runs workspace tests, then Playwright via the root script
- `pnpm test:e2e` runs the browser suite directly

DB-backed API tests require a reachable PostgreSQL instance at `TEST_DATABASE_URL`. If Docker is not running or port `5432` is unavailable, the API suites fail fast with a `TEST_DATABASE_URL` connection error.

## Production-Style Local Smoke Test

Use the integrated single-service path:

```bash
pnpm smoke:prod
```

Equivalent low-level commands:

```bash
pnpm build
pnpm start
```

Expected smoke checks:

- `GET /api/me` returns `401` when unauthenticated
- `GET /login` returns the built frontend shell
- direct browser navigation to `/dashboard` or `/transactions/:id/edit` returns the SPA shell instead of `404`
- static assets are served by the same Express process as `/api/*`

The production entrypoint serves built frontend assets only when `NODE_ENV=production`. If `apps/web/dist/index.html` is missing, startup fails with an actionable build error.

## Useful Commands

```bash
pnpm dev
pnpm start
pnpm build
pnpm typecheck
pnpm lint
pnpm format
pnpm test
pnpm test:e2e
pnpm smoke:prod
pnpm db:up
pnpm db:down
pnpm db:logs
pnpm db:migrate
pnpm db:seed
```
