# Hevy Exercise Import

One-off **import scripts** (not part of the Kak Fit app) that pull exercise catalog data from the [Hevy Pro API](https://api.hevyapp.com/docs/) into your database.

## What gets imported

| From Hevy API | Into Kak Fit |
|---------------|--------------|
| `GET /v1/exercise_templates` | `Exercise` rows (`hevyId`, `name`) |
| `primary_muscle_group` + `secondary_muscle_groups` | `Muscle` + `ExerciseMuscle` |
| `equipment` enum | `Equipment` + `ExerciseEquipment` |
| `type` enum | `Category` (prefixed `Hevy: Weight Reps`, etc.) |

## What Hevy does **not** provide (important)

The Hevy public API has **no** endpoints for:

- `/exercises`, `/muscles`, `/equipment`, `/categories` (separate)
- Exercise **images**, **videos**, or **instructions**

For images/instructions, keep using Wger: `pnpm db:import`

## Prerequisites

1. **Hevy Pro** subscription
2. API key from [hevy.com/settings?developer](https://hevy.com/settings?developer)
3. Add to `.env` (never commit):

```env
HEVY_API_KEY="your-uuid-api-key"
```

4. Apply schema (adds `Exercise.hevyId`, `Exercise.hevyUpdatedAt`):

```bash
pnpm db:push
```

## Scripts

All scripts live in `packages/db/scripts/hevy/` and use `DIRECT_URL` for DB writes.

| Command | Description |
|---------|-------------|
| `pnpm import:hevy:test` | Test auth, fetch samples, save to `hevy-api-samples/` |
| `pnpm analyze:hevy` | Regenerate `docs/HEVY_API_MAPPING.md` |
| `pnpm import:hevy` | Full catalog import (~500 global exercises) |
| `pnpm import:hevy -- --dry-run` | Fetch only, no DB writes |
| `pnpm import:hevy -- --include-custom` | Include your custom Hevy exercises |
| `pnpm import:hevy -- --resume` | Resume from last checkpoint |
| `pnpm update:hevy` | Incremental sync (skips items synced &lt; 30 days ago) |
| `pnpm verify:hevy` | Validate import + write `hevy-import-report.html` |
| `pnpm merge:hevy` | Link Hevy rows onto matching Wger exercises (run after import) |

See **[HEVY_CATALOG_MAPPING.md](./HEVY_CATALOG_MAPPING.md)** for how merged data appears in the app.

## First-time setup

```bash
# 1. Test API
pnpm import:hevy:test

# 2. Review mapping doc
pnpm analyze:hevy
cat docs/HEVY_API_MAPPING.md

# 3. Dry run
pnpm import:hevy -- --dry-run

# 4. Full import
pnpm import:hevy

# 5. Verify
pnpm verify:hevy
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| `HEVY_API_KEY is not set` | Add key to `.env` |
| `Hevy auth failed (401)` | Regenerate key in Hevy settings; Pro required |
| `Hevy rate limited (429)` | Wait and retry; client defaults to 30 req/min |
| Pool errors during import | Uses `DIRECT_URL` like Wger import |
| No images after import | Expected — Hevy API has no image URLs |

## Logs & state

| File | Purpose |
|------|---------|
| `packages/db/scripts/hevy/hevy-import-errors.log` | Per-exercise failures |
| `packages/db/scripts/hevy/.hevy-sync-state.json` | Last sync timestamps (gitignored) |
| `packages/db/scripts/hevy/.hevy-import-checkpoint.json` | Resume checkpoint |
| `hevy-import-report.html` | Verification report (repo root) |

## Maintenance

- **Full re-import:** monthly or when Hevy adds exercises
- **Incremental:** `pnpm update:hevy` weekly (re-fetches catalog, skips fresh rows)
- Hevy has no `updated_since` on exercise templates — incremental is best-effort

## Architecture note

These scripts are **ephemeral tooling** — they are not imported by the web/mobile app. The only permanent schema change is `hevyId` / `hevyUpdatedAt` on `Exercise` for deduplication during import.
