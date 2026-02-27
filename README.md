# Pennywise

Pennywise is a personal finance tracking web app for recording income and expenses, categorizing transactions, reviewing transaction history, and monitoring the current balance.

This repository is a `pnpm` monorepo with a React frontend, an Express backend, and a shared contracts package. The product requirements and technical rules currently live in `SPEC.md`. The HTML prototype folders in `dashboard_page/`, `transaction_page/`, `budget_page/`, and `analytics_page/` are visual references only.

## Tech Stack

- React 19 with Vite in `apps/web`
- Express 5 in `apps/api`
- Shared Zod contracts in `packages/contracts`
- PostgreSQL for application and test databases
- TypeScript, Vitest, and Biome across the workspace

## Repository Layout

```text
apps/
  api/         Express API workspace
  web/         React + Vite frontend workspace
packages/
  contracts/   Shared Zod schemas, types, and validation helpers
docker/
  ...          Local database support files
```

## Local Setup

### Prerequisites

- Node.js `24.x`
- `pnpm@10.6.0`
- Docker or another compatible container runtime

### Environment

Create a local `.env` file based on `.env.example`.

```bash
cp .env.example .env
```

Current environment variables:

```env
DATABASE_URL=postgresql://pennywise:pennywise@localhost:5432/pennywise
TEST_DATABASE_URL=postgresql://pennywise:pennywise@localhost:5432/pennywise_test
SESSION_SECRET=change-me
DEMO_USERNAME=demo
DEMO_PASSWORD=demo-password
PORT=3000
```

### Install Dependencies

```bash
pnpm install
```

### Start Local Database

```bash
pnpm db:up
```

This starts the PostgreSQL container defined in `docker-compose.yml`.
Make sure Docker is running before starting the database, and make sure host port `5432` is free.

To stop the database:

```bash
pnpm db:down
```

To view database logs:

```bash
pnpm db:logs
```

### Start Development Servers

```bash
pnpm dev
```

This runs the API and web workspaces in parallel.

## Useful Commands

```bash
pnpm dev
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm format
pnpm db:up
pnpm db:down
pnpm db:logs
pnpm db:migrate
pnpm db:seed
```

`pnpm db:migrate` applies the committed SQL migrations to `DATABASE_URL`.
`pnpm db:seed` creates or updates the demo user and the fixed system category set.

## Current Progress

- The monorepo workspace is set up with `apps/web`, `apps/api`, and `packages/contracts`.
- The shared contracts package is implemented and exports Zod schemas, TypeScript types, and pure validation helpers for auth, categories, transactions, summary data, and structured API errors.
- The backend persistence layer is implemented with:
  - Drizzle schema definitions for `users`, `categories`, `transactions`, and `session`
  - committed SQL migrations
  - repeatable seed logic for the demo user and fixed categories
  - integration tests covering migration state, repeatable seeding, `external_ref` uniqueness, and persisted summary calculations
- Unit tests exist for:
  - positive amount validation
  - remarks length limits
  - valid date-only parsing
  - category/type compatibility
  - summary calculation
- The API entrypoint is still a placeholder, but the database layer behind it now exists.
- The web workspace currently contains a placeholder app shell only.
- PostgreSQL connection settings and Docker Compose support are present for local development.
- Authenticated routes, transaction CRUD, summary endpoints, and real frontend screens are still pending.

## Verified Status

The following checks are known to pass in the current repository state:

- `packages/contracts` unit tests
- TypeScript typecheck for `packages/contracts`
- TypeScript typecheck for `apps/api`
- TypeScript typecheck for `apps/web`
- `apps/api` integration tests for migrations, seeds, and persisted summary behavior

## Notes That Still Need Documentation

- Demo account login flow and session behavior once authentication is implemented
- API endpoint reference after backend routes exist
- Frontend route map and screen behavior after the app shell is replaced with real pages
- Local development troubleshooting guidance for PostgreSQL connectivity, Docker startup, port `5432` conflicts, and environment variables
- Deployment instructions for Render and Neon after production setup exists
- Integration, component, and end-to-end testing workflow after those suites are added
- Optional mock transaction import behavior only if that feature is implemented

## Current Limitations

- No production-ready backend routes are implemented yet.
- No real frontend user flows are implemented yet.
- No deployment configuration is documented yet.
