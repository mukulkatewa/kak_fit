# Hevy → Kak Fit Catalog Mapping

How imported Hevy data maps into the app database and API.

## Data sources

| Source | Rows | Provides |
|--------|------|----------|
| **Wger** (`pnpm db:import`) | ~858 | Names, instructions, images, body-part categories |
| **Hevy** (`pnpm import:hevy`) | 433 global | Names, muscles, equipment, logging type |
| **Merged** (`pnpm merge:hevy`) | — | Links both on one row when names match |

## Field mapping (Hevy API → Prisma)

| Hevy `exercise_templates` | Prisma / app | Notes |
|---------------------------|--------------|-------|
| `id` | `Exercise.hevyId` | e.g. `3BC06AD3` |
| `title` | `Exercise.name` | |
| `type` | `Category` (`Hevy: Weight Reps`) | Logging modality, not body part |
| `primary_muscle_group` | `ExerciseMuscle` (`isPrimary: true`) | |
| `secondary_muscle_groups[]` | `ExerciseMuscle` (`isPrimary: false`) | |
| `equipment` | `ExerciseEquipment` | |
| `is_custom` | skipped | Only `false` imported globally |
| _(none)_ | `Exercise.instructions` | From Wger when merged |
| _(none)_ | `Exercise.imageUrl` | From Wger when merged |

## Merge strategy (`pnpm merge:hevy`)

After import, Wger and Hevy rows coexist (~1291 total). Merge:

1. Normalizes names (`"Bench Press (Barbell)"` → `"bench press"`)
2. **Links** Hevy `hevyId` onto matching Wger row (keeps Wger image + instructions)
3. Copies muscles/equipment from Hevy onto Wger row
4. **Deletes** duplicate standalone Hevy row
5. **Keeps** Hevy-only exercises (~345) with no Wger match (e.g. `21s Bicep Curl`)

**Canonical catalog after merge:** ~770 Wger-linked + ~345 Hevy-only ≈ **1115** exercises (not 1291).

## App behavior

### Exercise picker (`exercise.list`)

- Deduplicates by normalized name
- Prefers: image + instructions (Wger) > Hevy metadata
- Returns muscles, equipment, category

### Categories filter

- `exercise.categories` — Wger body-part categories (excludes `Hevy:*`)
- `exercise.hevyTypes` — Hevy logging types for Hevy-only exercises

### Developer API (`/api/v1/exercise_templates`)

Serialized fields now include:

```json
{
  "id": "cuid",
  "title": "Bench Press",
  "hevy_id": "3BC06AD3",
  "wger_id": 123,
  "exercise_type": "Weight Reps",
  "equipment": ["Barbell"],
  "primary_muscles": ["Chest"],
  "image_url": "https://..."
}
```

## Recommended workflow

```bash
pnpm db:import          # 1. Wger base catalog (images + instructions)
pnpm import:hevy        # 2. Hevy metadata
pnpm merge:hevy         # 3. Link duplicates, keep Hevy-only additions
pnpm verify:hevy        # 4. Validate
```

## Prisma Accelerate (production)

- `DATABASE_URL` → Prisma Accelerate (`prisma://…`)
- `DIRECT_URL` → Supabase pooler (migrations + import scripts)
- Set `PRISMA_ACCELERATE_URL` in `.env`; run `pnpm sync:ip` to apply

Import/merge scripts always use `DATABASE_URL="$DIRECT_URL"` so they bypass Accelerate and write directly to Postgres.
