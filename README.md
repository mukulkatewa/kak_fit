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
pnpm install
pnpm dev
```
