# Kak Fit

A mobile-first workout tracker and social fitness app — Hevy-style, at a lower price.

## Stack

- **Mobile:** React Native + Expo + TypeScript
- **Backend:** Next.js + tRPC + TypeScript
- **Database:** PostgreSQL + Prisma
- **Auth:** Better Auth
- **Storage:** Supabase Storage
- **Exercise data:** [Wger API](https://wger.readthedocs.io/en/latest/api/api.html)

## Docs

See [docs/PROJECT_ROADMAP.md](./docs/PROJECT_ROADMAP.md) for competitive research, feature spec, and phase-wise roadmap.

## Monorepo

```
apps/
  web/      → Next.js API server
  mobile/   → Expo React Native app
packages/
  db/       → Prisma schema
  api/      → Shared tRPC routers
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Copy env and set DATABASE_URL
cp .env.example .env

# Start Next.js API (port 3000)
pnpm --filter @kak-fit/web dev

# Start Expo mobile app (separate terminal)
pnpm --filter @kak-fit/mobile start
```
