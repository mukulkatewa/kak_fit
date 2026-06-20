# Kak Fit

A mobile-first workout tracker — Hevy-style, at a lower price. **Core focus: logging + progress. Social comes later.**

## Stack

- **Mobile:** React Native + Expo Router + TypeScript
- **Backend:** Next.js + tRPC + TypeScript
- **Database:** PostgreSQL + Prisma
- **Auth:** Better Auth (email + bearer tokens for mobile)
- **Exercise data:** [Wger API](https://wger.readthedocs.io/en/latest/api/api.html) (855 exercises imported)

## Docs

See [docs/PROJECT_ROADMAP.md](./docs/PROJECT_ROADMAP.md) for competitive research and phased roadmap.

## Quick Start

```bash
# 1. Install
pnpm install

# 2. Start Postgres
pnpm docker:up

# 3. Setup env
cp .env.example .env
cp .env apps/web/.env.local

# 4. Database
pnpm db:generate
pnpm db:push
pnpm db:import      # Import 855 exercises from Wger
pnpm db:seed        # Create demo user

# 5. Run API (terminal 1)
pnpm --filter @kak-fit/web dev

# 6. Run mobile (terminal 2)
pnpm --filter @kak-fit/mobile start
# Or web preview: pnpm --filter @kak-fit/mobile start --web
```

## Demo Login

| Field | Value |
|-------|-------|
| Email | `demo@kakfit.app` |
| Password | `password123` |

## Phase 1 Features (Live)

- Email auth (sign up / sign in)
- Exercise library (855 Wger exercises, searchable)
- Routine builder (create, duplicate, delete)
- Workout logger (start empty / from routine, log sets, finish)
- Personal records (auto-detected on workout finish)
- Workout history + PR list

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `http://localhost:3000` | API status page |
| `/api/auth/*` | Better Auth routes |
| `/api/trpc` | tRPC API (used by mobile) |

## Monorepo

```
apps/
  web/      → Next.js API server
  mobile/   → Expo React Native app
packages/
  db/       → Prisma schema + import scripts
  api/      → Shared tRPC routers
```
