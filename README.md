# Kak Fit

A mobile-first workout tracker — Hevy-style. **Core focus: logging + progress. Social comes later.**

> **Demo build: everything is free.** No paywall or subscription limits — all
> routines, custom exercises, and full history are unlocked.

## Stack

- **Mobile:** React Native + Expo Router + TypeScript (light + dark theme)
- **Backend:** Next.js + tRPC + TypeScript
- **Database:** PostgreSQL + Prisma (Supabase)
- **Auth:** Better Auth (email + bearer tokens for mobile)
- **Exercise data:** [Wger API](https://wger.readthedocs.io/en/latest/api/api.html) (855 exercises imported)
- **Nutrition:** USDA FoodData Central (food search + macro tracking)

## Docs

- [docs/PROJECT_ROADMAP.md](./docs/PROJECT_ROADMAP.md) — competitive research and phased roadmap
- [docs/HEVY_COMPARISON.md](./docs/HEVY_COMPARISON.md) — current end-to-end feature comparison vs Hevy + gap backlog
- [docs/ENV_SETUP.md](./docs/ENV_SETUP.md) — environment variables and database setup

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

## Features (Live)

- Email auth (sign up / sign in), persistent mobile sessions
- Exercise library (855 Wger exercises, searchable) + per-exercise detail & charts
- Routine builder (create, duplicate, delete) + program/category templates
- Workout logger (empty / from routine, set types, rest timer, previous values, copy set)
- Personal records (auto-detected on finish) + workout history & read-only detail view
- Progress: volume / duration / reps charts, streak, muscle heatmap, PRs
- Nutrition: USDA food search, meal logging, daily calorie + macro rings
- Body measurements (log + weight trend)
- Light + dark theme (system default, manual toggle in Settings)

See [docs/HEVY_COMPARISON.md](./docs/HEVY_COMPARISON.md) for the full feature matrix and what's next.

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
