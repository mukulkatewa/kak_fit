# Kak Fit vs Hevy — Feature Comparison

> Legend: ✅ done · 🟡 partial · 🔲 not started · ➕ beyond Hevy
>
> _Last updated: June 23, 2026_

---

## Summary

| Pillar | Hevy | Kak Fit today | Gap |
|--------|------|---------------|-----|
| Workout logging | Best-in-class | Live logger, prev values, RPE, supersets, edit history | ✅ Strong parity |
| Routine builder | Folders, reorder, programs | CRUD + folders + share link + static programs | 🟡 No Hevy-style 26 curated programs |
| Exercise library | 400+, custom | 858 (Wger) + custom | ✅ Parity |
| Progress tracking | Charts, PRs, muscle map | Volume charts, PRs, muscle heatmap, calendar | 🟡 No monthly/year-in-review |
| **Developer API (Pro)** | REST + API key | **REST `/api/v1` + API key** | ✅ Parity (see §9) |
| Body measurements | 14+ fields | 5 fields + trends | 🟡 Fewer measurement types |
| Nutrition | ❌ none | USDA + meal log + macros | ➕ Beyond Hevy |
| Social | Feed, follow, like | DB only | 🔲 Phase 5 |
| Offline | Full offline sync | Scaffold only | 🔲 |
| Watch apps | Apple Watch / Wear OS | — | 🔲 |

---

## 9. Developer API (Hevy Pro)

Hevy exposes a [public REST API](https://api.hevyapp.com/docs/) for **Pro subscribers** — API key in `api-key` header, access to workouts, routines, exercise templates, history, and body measurements.

| Capability | Hevy Pro API | Kak Fit Developer API |
|------------|--------------|------------------------|
| Pro-gated access | ✅ | ✅ (`DEVELOPER_API_REQUIRE_PRO=true` in production; open in beta) |
| API key management UI | Web settings | ✅ Mobile **Settings → Developer API** |
| `GET /user/info` | ✅ | ✅ `/api/v1/user/info` |
| Workouts list / get / create / update | ✅ | ✅ |
| Workout count | ✅ | ✅ |
| Workout sync events | ✅ | ✅ (created/updated/deleted since `since`) |
| Routines CRUD | ✅ | ✅ (no DELETE yet — 🟡) |
| Routine folders | ✅ | ✅ (no folder update/delete — 🟡) |
| Exercise templates / catalog | ✅ | ✅ |
| Custom exercise create | ✅ | ✅ |
| Exercise history per exercise | ✅ | ✅ |
| Personal records | In history/charts | ✅ dedicated `/personal_records` |
| Body measurements CRUD | ✅ by date | ✅ |
| OpenAPI / Swagger | ✅ | 🟡 HTML docs at `/api/v1/docs` |
| Official SDKs | Community only | 🔲 |

**Auth:** `api-key: kak_…` · **Base URL:** `https://web-eight-khaki-87.vercel.app/api/v1`

---

## 8. Hevy Pro features (app + API)

| Pro feature | Hevy | Kak Fit |
|-------------|------|---------|
| Unlimited routines | Pro | ✅ Free (demo) |
| Unlimited custom exercises | Pro | ✅ Free |
| All-time chart history | Pro | ✅ Free |
| **Public Developer API** | **Pro** | **✅ Implemented** |
| Hevy Trainer (AI programming) | Pro | 🔲 |
| Warm-up / plate calculator | Pro | ✅ |
| CSV export | Pro | 🔲 |
| Advanced analytics / reports | Pro | 🟡 Charts yes, monthly report 🔲 |
| Apple Watch / Wear OS | Pro ecosystem | 🔲 |
| Strength-level benchmarks | Pro charts | 🔲 |
| Offline logging | ✅ | 🔲 |

---

## Remaining Pro / parity backlog

**High value (Hevy Pro gaps):**
1. Routine DELETE via API + app
2. CSV export (workouts + measurements)
3. OpenAPI JSON spec + Postman collection
4. Monthly / year-in-review reports
5. Offline logging + sync
6. Enforce `DEVELOPER_API_REQUIRE_PRO=true` when billing ships

**Larger:**
7. Hevy Trainer equivalent (AI programming)
8. Social feed
9. Apple Watch / Wear OS
10. Extra body measurement fields (hips, thighs, etc.)
11. Strength-level benchmarks per exercise

**Kak Fit advantages (not in Hevy):**
- Nutrition tracking (USDA, macros, meal log)
- Dedicated progress photo compare screen
- Lower target pricing

---

## Quick reference — app features

| Area | Status |
|------|--------|
| Workout logging | ✅ |
| Edit past workouts | ✅ |
| Routines + folders + share | ✅ |
| PRs + 1RM | ✅ |
| Progress charts + muscle heatmap | ✅ |
| Body measurements | ✅ |
| Progress photos | ✅ |
| Settings (units, rest, theme) | ✅ |
| Developer API | ✅ **new** |
| Social | 🔲 |
| Offline | 🔲 |
| Watch | 🔲 |
