# Conventions — stack, structure, and the real checks

Build flow: pr
PR base: main

## Stack
- **Monorepo:** pnpm workspaces + Turborepo. Package manager **pnpm@9.15.4**
  (pinned in `packageManager`). Node 20 in CI.
- **Mobile:** React Native + **Expo Router** + TypeScript (`apps/mobile`,
  `@kak-fit/mobile`). iOS · Android · web from one codebase.
- **Backend:** **Next.js** app that hosts **tRPC v11** + Better Auth
  (`apps/web`, `@kak-fit/web`). The mobile app talks to it over tRPC with bearer
  tokens.
- **Shared API:** tRPC routers live in **`packages/api`** (`@kak-fit/api`),
  imported by both web and mobile.
- **Database:** PostgreSQL + **Prisma** (`packages/db`, `@kak-fit/db`), Supabase
  today (AWS RDS proposed later). Schema in `packages/db/prisma`.
- **Other:** TanStack Query, superjson, AWS Bedrock (AI meal planner), Resend/SES
  (email), Supabase Storage (→ S3), EAS (mobile builds). TypeScript strict
  everywhere.

## Layout
```
apps/
  web/      → Next.js server: tRPC endpoint + Better Auth + status page
  mobile/   → Expo React Native app
    src/
      components/  → shared UI primitives (ui.tsx, hevy-ui.tsx, charts.tsx, …)
      lib/         → theme.ts, api-client, auth, query-client, domain helpers
      hooks/
    app/           → Expo Router routes (file-based)
packages/
  api/      → tRPC routers (one file per domain in src/routers/), services, emails
  db/       → Prisma schema + import/seed scripts
scripts/    → dev + deploy shell scripts (start-expo, deploy-vercel, …)
docs/       → product + engineering docs (START_HERE.md is the map)
```

## Naming & code patterns
- **Files:** kebab-case (`body-measurement.ts`, `meal-reminder.tsx`,
  `use-preferences.ts`). React components in `.tsx`.
- **Packages/scopes:** `@kak-fit/<name>`. Cross-package imports use
  `workspace:*`.
- **tRPC:** one router file per domain in `packages/api/src/routers/`, composed in
  `packages/api/src/index.ts` (`appRouter`). Export types
  (`RouterOutputs`) — the mobile app consumes them.
- **Theming:** never hard-code colors; read from `useTheme()` /
  `useThemedStyles()` (see `.claude/context/design.md`).
- **Money:** integer **paise** in a ledger — never floats or a mutable balance.
- **Style:** ESLint `next/core-web-vitals` + `next/typescript` on the web app;
  Expo TS base on mobile. Match surrounding code — 2-space indent, double quotes,
  semicolons.

## The real checks (run from repo root)
> ⚠️ **Always `pnpm db:generate` before typecheck** — a missing Prisma client
> produces ~244 phantom errors unrelated to your change. CI does this too.

| Check | Command |
|-------|---------|
| Install | `pnpm install --frozen-lockfile` |
| Generate Prisma client | `pnpm db:generate` |
| Typecheck | `pnpm typecheck`  *(turbo; runs after db:generate)* |
| Lint | `pnpm lint`  *(turbo; web app only)* |
| Unit tests | `pnpm test`  *(turbo → tsx --test on `*.test.ts`)* |
| Verify (fast gate) | `pnpm verify`  *(= typecheck + test)* |
| API integration tests | `pnpm test:integration`  *(needs a test Postgres; see `pnpm test:setup`)* |
| Build | `pnpm build`  *(turbo)* |
| Dev — API/web | `pnpm dev:web` |
| Dev — app (web preview) | `pnpm dev:web-app` |
| Dev — mobile | `pnpm --filter @kak-fit/mobile start` |
| Postgres (local) | `pnpm docker:up` |

CI (`.github/workflows/ci.yml`) runs on `main` + all PRs: **typecheck + unit
tests** (with `db:generate`) and a separate **API integration** job against a
Postgres service.
