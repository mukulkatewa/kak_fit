# Kak Fit vs Hevy — End-to-End Feature Comparison

> **Demo: everything is free.** No paywall, no subscription limits enforced.
>
> Legend: ✅ done · 🟡 partial · 🔲 not started · ➕ beyond Hevy
>
> _Last updated: June 22, 2026_

---

## Summary

| Pillar | Hevy | Kak Fit today | Gap |
|--------|------|---------------|-----|
| Workout logging | Best-in-class | Live logger, prev values, copy set, set types, rest timer, supersets | ✅ Strong parity |
| Routine builder | Folders, reorder, programs | Create / edit / duplicate / delete + folders + reorder + supersets + templates | ✅ Strong parity |
| Exercise library | 400+, custom, detail | 858 exercises, filters, custom create, detail + charts | ✅ Parity |
| Progress tracking | Charts, streak, muscle map, calendar | Volume/duration/reps charts, streak, muscle heatmap, PRs, calendar | ✅ Strong parity |
| Body measurements | Weight + 14 fields + photos | Log all fields + per-metric trend + history | 🟡 Photos separate screen |
| Progress photos | Attached to workouts | Dedicated Photos screen + per-workout attachment | ✅ Parity |
| Nutrition | ❌ none | USDA food search + macro rings + meal log + editable goals | ➕ Beyond Hevy |
| Social | Feed, follow, like, comment | DB models only, no UI | 🔲 Phase 5 |
| Theming | Light + dark | Light (green/white) + dark (black/blue, system auto) | ✅ Parity |
| Platforms | iOS/Android/Web/Watch | iOS/Android/Web (Expo) | 🟡 No Watch yet |

---

## 1. Workout Logging

| Feature | Hevy | Kak Fit |
|---------|------|---------|
| Live session (volume, timer) | ✅ | ✅ |
| Empty / from-routine start | ✅ | ✅ |
| Weight / reps / duration per set | ✅ | ✅ |
| Set types (normal/warmup/drop/failure) | ✅ | ✅ |
| Previous workout values | ✅ | ✅ |
| Copy previous set | ✅ | ✅ |
| Add / delete sets | ✅ | ✅ |
| Rest timer | ✅ | ✅ |
| Supersets | ✅ | ✅ |
| Live PR notification | ✅ | ✅ |
| Workout detail view (read-only) | ✅ | ✅ |
| Rename / delete past workouts | ✅ | ✅ |
| Edit past workouts (modify sets) | ✅ | ✅ |
| RPE per set | ✅ | 🟡 DB field only |
| Copy workout → new session | ✅ | ✅ |
| Create routine from workout | ✅ | 🔲 |
| Offline logging | ✅ | 🔲 |
| Plate / warm-up calculator | ✅ Pro | 🔲 |

## 2. Routine Builder

| Feature | Hevy | Kak Fit |
|---------|------|---------|
| Create / edit / duplicate / delete | ✅ | ✅ |
| Folders + reorder | ✅ | ✅ |
| Exercise reorder (up/down) | ✅ | ✅ |
| Supersets | ✅ | ✅ |
| Unlimited routines | Pro only | ✅ free |
| Pre-made programs (26) | ✅ | 🟡 Static templates |
| Share routine link | ✅ | 🔲 |
| Drag-to-reorder (gesture) | ✅ | 🔲 (Reanimated removed) |

## 3. Exercise Library

| Feature | Hevy | Kak Fit |
|---------|------|---------|
| Built-in exercises | 400+ | ✅ 858 (Wger) |
| Search + muscle/category filter | ✅ | ✅ |
| Custom exercises (create) | ✅ | ✅ |
| Exercise detail + history + 1RM | ✅ | ✅ |
| Exercise GIFs/images | ✅ | ✅ (Wger demo images) |
| Strength-level benchmarks | ✅ | 🔲 |

## 4. Progress Tracking

| Feature | Hevy | Kak Fit |
|---------|------|---------|
| Volume / duration / reps charts | ✅ | ✅ |
| Weight chart per exercise | ✅ | ✅ |
| PR history | ✅ | ✅ |
| Estimated 1RM | ✅ | ✅ |
| Muscle heatmap | ✅ | ✅ |
| Active streak | ✅ | ✅ |
| Workout calendar | ✅ | ✅ |
| Monthly report | ✅ | 🔲 |
| Year-in-review | ✅ | 🔲 |

## 5. Body & Photos

| Feature | Hevy | Kak Fit |
|---------|------|---------|
| Body weight + measurements | ✅ | ✅ |
| Per-metric trend charts | ✅ | ✅ |
| Progress photos (dedicated screen) | ✅ | ✅ |
| Photos attached to workouts | ✅ | ✅ |
| Side-by-side photo compare | ✅ | 🔲 |

## 6. Nutrition (Kak Fit advantage ➕)

| Feature | Hevy | Kak Fit |
|---------|------|---------|
| Food search (USDA) | ❌ | ✅ |
| Meal logging | ❌ | ✅ |
| Daily calorie + macro rings | ❌ | ✅ |
| Editable macro targets per user | ❌ | ✅ |
| Custom food management | ❌ | 🔲 |

## 7. Profile & Social

| Feature | Hevy | Kak Fit |
|---------|------|---------|
| Edit profile (name + bio) | ✅ | ✅ |
| Profile completion prompt | ✅ | ✅ |
| Light/dark/system theme | ✅ | ✅ |
| Follow / unfollow | ✅ | 🔲 Phase 5 |
| Home feed (workouts from following) | ✅ | 🔲 |
| Like workouts | ✅ | 🔲 |
| Comment | ✅ | 🔲 |
| User profiles | ✅ | 🔲 |
| Leaderboards | ✅ | 🔲 |

## 8. Hevy Pro features (they charge for, we offer free)

| Pro Feature | Hevy cost | Kak Fit |
|-------------|-----------|---------|
| Unlimited routines | Pro | ✅ Free |
| Unlimited custom exercises | Pro | ✅ Free |
| All-time chart history | Pro | ✅ Free |
| Hevy Trainer (AI programming) | Pro | 🔲 (Phase 5+) |
| Warm-up / plate calculator | Pro | 🔲 |
| CSV export | Pro | 🔲 |
| Advanced analytics | Pro | 🔲 |

---

## Remaining backlog (priority order)

**Medium effort — connect what's in the DB:**
1. Copy workout → new session
2. Edit past workout sets (not just rename)
3. Exercise GIFs (Wger provides URLs, just display them)
4. Drag-to-reorder exercises (needs Reanimated + device build)
5. Custom food management screen

**Larger:**
6. Social feed (follow/like/comment) — Phase 5
7. Side-by-side photo comparison
8. Monthly / year-in-review reports
9. CSV export
10. Offline logging (SQLite + sync)
11. AI programming (Hevy Trainer equivalent)
12. Apple Watch / Wear OS

**DB region note:** Database is now on **ap-south-1 (Mumbai)** — warm requests
run at ~300–500ms vs the former ~1.7s on Tokyo.
