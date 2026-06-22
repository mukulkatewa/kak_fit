# Kak Fit vs Hevy — End-to-End Feature Comparison

> Snapshot of what Kak Fit actually ships **today** versus Hevy, to drive the
> next build phase. Legend: ✅ done · 🟡 partial · 🔲 not started · ➕ beyond Hevy
>
> Demo positioning: **everything is free** — no paywall, no subscription tier
> enforcement. (Hevy gates routines/history behind Pro.)

_Last updated: June 22, 2026_

---

## Summary

| Pillar | Hevy | Kak Fit today | Verdict |
|--------|------|---------------|---------|
| Workout logging | Best-in-class | Live logger, prev values, copy set, set types, rest timer | ✅ Strong parity |
| Routine builder | Folders, reorder, programs | Create / edit / duplicate / delete + templates | 🟡 Missing folders, drag-reorder |
| Exercise library | 400+, custom, detail page | 855 exercises, search, filters, custom create, detail, charts | ✅ Strong parity |
| Progress tracking | Charts, streak, muscle map, calendar | Volume/duration/reps charts, streak, muscle heatmap, PRs, calendar | ✅ Strong parity |
| Body measurements | Weight + 14 fields + photos | Log all fields + per-metric charts + history | 🟡 No photos |
| Nutrition | ❌ none | USDA food search + macro rings + meal log + editable goals | ➕ Beyond Hevy |
| Social | Feed, follow, like, comment | DB models exist, no UI | 🔲 Deferred (Phase 5) |
| Theming | Light + dark | Light (green/white) + dark (black/blue, system/manual) | ✅ Parity |
| Platforms | iOS/Android/Web/Watch | iOS/Android/Web (Expo) | 🟡 No Watch |

---

## 1. Workout Logging

| Feature | Hevy | Kak Fit | Notes |
|---------|------|---------|-------|
| Live session (volume, set complete) | ✅ | ✅ | `workout/active.tsx` |
| Empty workout | ✅ | ✅ | `workout.startEmpty` |
| Start from routine | ✅ | ✅ | `workout.startFromRoutine` |
| Weight / reps / duration per set | ✅ | ✅ | |
| Set types (normal/warmup/drop/failure) | ✅ | ✅ | |
| Previous workout values | ✅ | ✅ | `workout.previousSets` (batched) |
| Copy previous set | ✅ | ✅ | |
| Add / delete sets | ✅ | ✅ | |
| Rest timer on set complete | ✅ | ✅ | |
| Live PR notification | ✅ | ✅ | PRs synced on finish |
| Finish summary (name/notes) | ✅ | ✅ | |
| **Read-only workout detail view** | ✅ | ✅ | `workout/[id].tsx` (new) |
| RPE per set | ✅ (setting) | 🟡 | field in DB, not surfaced |
| Supersets | ✅ | 🔲 | Phase 2 |
| Edit/delete past workouts | ✅ | 🔲 | detail view is read-only for now |
| Create routine from workout | ✅ | 🔲 | |
| Offline logging | ✅ | 🔲 | needs local SQLite |
| Plate / warm-up calculator | ✅ Pro | 🔲 | |

## 2. Routine Builder

| Feature | Hevy | Kak Fit | Notes |
|---------|------|---------|-------|
| Create routine | ✅ | ✅ | `routine/create.tsx` |
| Duplicate / delete | ✅ | ✅ | `my-routines.tsx` |
| **Unlimited routines** | Pro only | ✅ free | gating removed |
| Pre-made programs | ✅ 26 | 🟡 | static `explore-data.ts`, import-on-save |
| Folders | ✅ | 🔲 | `routine.folders` API exists, no UI |
| Edit existing routine | ✅ | 🔲 | only create/duplicate |
| Drag-to-reorder exercises | ✅ | 🔲 | fixed order |
| Share routine link | ✅ | 🔲 | |

## 3. Exercise Library

| Feature | Hevy | Kak Fit | Notes |
|---------|------|---------|-------|
| Built-in exercises | 400+ | ✅ 855 (Wger) | |
| Search | ✅ | ✅ | now indexed + faster |
| Filter by muscle/category | ✅ | 🟡 | API supports it, UI is search-only |
| Exercise detail + history + 1RM | ✅ | ✅ | `exercise/[id].tsx` |
| Custom exercises | ✅ | 🔲 | `exercise.createCustom` exists, no UI |
| Strength-level benchmark | ✅ | 🔲 | |

## 4. Progress Tracking

| Feature | Hevy | Kak Fit | Notes |
|---------|------|---------|-------|
| Volume chart | ✅ | ✅ | |
| Duration / reps charts | ✅ | ✅ | now backed by real data |
| Weight progression per exercise | ✅ | ✅ | |
| PR history | ✅ | ✅ | |
| Estimated 1RM | ✅ | ✅ | |
| Muscle distribution / heatmap | ✅ | ✅ | body silhouette heatmap |
| Active streak | ✅ | ✅ | |
| Workout calendar | ✅ | 🔲 | |
| Monthly / year-in-review | ✅ | 🔲 | |

## 5. Body Measurements

| Feature | Hevy | Kak Fit | Notes |
|---------|------|---------|-------|
| Weight logging + trend | ✅ | ✅ | |
| Body fat / circumferences | ✅ 14 | 🟡 | fields in DB, only weight charted |
| Progress photos | ✅ | 🔲 | needs media storage |

## 6. Nutrition (Kak Fit advantage ➕)

| Feature | Hevy | Kak Fit | Notes |
|---------|------|---------|-------|
| Food search (USDA) | ❌ | ✅ | `nutrition.searchFoods` |
| Meal logging | ❌ | ✅ | breakfast/lunch/dinner/snacks |
| Daily calorie + macro rings | ❌ | ✅ | |
| Custom food management | ❌ | 🔲 | created inline only |
| Editable macro targets | ❌ | 🔲 | server default 2500 kcal |

## 7. Social (deferred — Phase 5)

DB models exist (`Follow`, `Like`, `Comment`, `Media`), but there is **no UI**.
Profile shows hardcoded `0` followers/following. Intentionally out of scope until
the core logger + progress experience is polished.

## 8. Platform & Theming

| Feature | Hevy | Kak Fit | Notes |
|---------|------|---------|-------|
| iOS + Android | ✅ | ✅ | Expo |
| Web | ✅ | ✅ | Expo web |
| Dark / light theme | ✅ | ✅ | system + manual toggle in Settings |
| Cloud sync | ✅ | ✅ | Supabase Postgres |
| Apple Watch / Wear OS | ✅ | 🔲 | |
| CSV export | Pro | 🔲 | |

---

## Prioritized gap backlog (next features to build)

**Done (June 22, 2026):**
- ✅ Custom exercise creation screen → `exercise.createCustom`
- ✅ Edit existing routine → `routine.update` + builder edit mode
- ✅ Body-measurement history list + per-metric charts → `bodyMeasurement.list/chart`
- ✅ Muscle filter UI on the exercise list
- ✅ Editable nutrition targets (per-user goals) → `nutrition.getTargets/setTargets`
- ✅ Edit / delete past workouts → `workout.update` / `workout.delete`
- ✅ Workout calendar → `progress.calendar`
- ✅ Hevy-style black + blue dark theme

**Still open — medium effort:**
1. Routine folders UI → `routine.folders` / `routine.createFolder`
2. Drag-to-reorder exercises in routine builder
3. Supersets
4. Progress photos (needs S3/Supabase storage wiring)
5. Category filter UI on the exercise list (muscle filter shipped)

**Larger / later:**
6. Social feed (follow / like / comment / profiles) — Phase 5
7. Offline logging with local SQLite + sync
8. Apple Watch / Wear OS companions
9. CSV export, monthly report, year-in-review

---

## Known infra note (performance)

The Supabase database is in **ap-northeast-1 (Tokyo)**. Latency is dominated by
distance, not query cost. Mitigations already shipped: session-pooler runtime
connection, single cached auth lookup per request, hot-path indexes, batched
exercise-name resolution, and a slimmed dashboard query. For the lowest latency,
move the Supabase project to the nearest region (e.g. **ap-south-1 / Mumbai**)
or run local Docker Postgres for development.
