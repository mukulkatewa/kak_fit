# CLAUDE.md

Kak Fit (working name; rename in progress) — an **India-first, mobile-first
coaching platform** being pivoted from a Hevy-style solo workout tracker. It lets
an Instagram fitness coach run their whole 1:1 coaching business from their phone,
on top of a genuinely good consumer client app (logging, nutrition, progress).

## Read first
- **`docs/START_HERE.md`** — the map to every product decision. Read before any
  product work.
- **`.claude/context/`** — the studio's working context:
  - `product.md` — what we're building and why · `design.md` — the visual language
    (source of truth: `apps/mobile/src/lib/theme.ts`) · `brand.md` — name + voice ·
    `conventions.md` — stack, structure, checks · `deploy.md` — `/ship` pipeline.
- Older `docs/` (PROJECT_ROADMAP, FEATURES, HEVY_COMPARISON, DESIGN_SYSTEM) are
  **solo-tracker-era background — partly stale**.

## Stack (short)
pnpm + Turborepo monorepo. Mobile: React Native + Expo Router (`apps/mobile`).
Backend: Next.js + tRPC v11 + Better Auth (`apps/web`). Shared routers
(`packages/api`). Prisma + Postgres/Supabase (`packages/db`). TypeScript strict.

## Checks (repo root)
> ⚠️ Always `pnpm db:generate` before typecheck — otherwise ~244 phantom errors.
```
pnpm db:generate
pnpm typecheck
pnpm lint             # web only
pnpm test             # or: pnpm verify  (typecheck + test)
pnpm test:integration # needs a test Postgres (pnpm test:setup)
pnpm build
```
Dev: `pnpm dev:web` (API) + `pnpm dev:web-app` (app web preview), or
`pnpm --filter @kak-fit/mobile start`. Local DB: `pnpm docker:up`.

## Guardrails
- Never hard-code colors — read theme tokens via `useTheme()`; support light+dark.
- Money is integer **paise** in a ledger — never floats.
- No medical/diagnostic advice (`docs/legal.md`).

## Build flow
Feature branch → PR → `main`. CI (typecheck + unit + API integration) runs on all
PRs. Deploy via `/ship` (see `.claude/context/deploy.md`). `/spec` and `/build`
are tuned to this repo.
