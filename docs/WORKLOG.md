# Kak Fit — Work Log

> **Chronological journal of what we built, when, and why.**
> This is the "where were we" file. Every session gets a dated entry at the
> **top of the Session Log**. Decisions get an entry in the Decision Log with
> the date they were made.
>
> Companion docs:
> [PROJECT_ROADMAP.md](./PROJECT_ROADMAP.md) (phases + competitive research) ·
> [FEATURES.md](./FEATURES.md) (feature inventory + bug list) ·
> [HEVY_COMPARISON.md](./HEVY_COMPARISON.md) (parity matrix)
>
> _Log created: 2026-07-28 · Covers 2026-06-20 → present_

---

## How to maintain this file

At the end of every working session, append an entry under **Session Log** in
this shape:

```markdown
### YYYY-MM-DD (HH:MM–HH:MM) — <one-line theme>
**Shipped:** what landed (commit hashes if committed)
**Decided:** any decision + the reason
**Left open:** what's unfinished and the next concrete step
```

Keep it terse. If a decision reverses an earlier one, add a new Decision Log row
rather than editing the old one — the history is the point.

---

## 1. Status snapshot — 2026-07-28

| Dimension | State |
|---|---|
| Branch | `main`, clean vs `origin/main`, no stashes, no open branches |
| Last commit | `3aad62f` — 2026-07-05 03:06 — *fix(widget,auth): home-screen widget load and first-time OAuth sign-in* |
| Commits to date | 189, spanning 2026-06-20 → 2026-07-05 |
| Uncommitted work | **Meal Reminder feature — complete, typechecks, never committed** (built 2026-07-07) |
| Typecheck | ✅ **0 errors** (`pnpm --filter @kak-fit/mobile typecheck`) after `pnpm db:generate` |
| Gap since last work | ~3 weeks (2026-07-07 → 2026-07-28) |
| Phase | Phase 2 complete; **Phase 3 (monetization) not started** |

### ⚠️ Environment gotcha (hit on 2026-07-28)

A cold checkout typechecks with **244 errors** that are *not real* — they are a
stale/ungenerated Prisma client (`Prisma.sql` missing, `User` and
`PersonalRecordType` not exported from `@kak-fit/db`). **Always run
`pnpm db:generate` first.** After that: 0 errors. Do not chase these.

---

## 2. Where we left off — the actual open item

**Feature: in-app Meal Reminder screen** (spec in `CURSOR_PROMPT.md`, visual
source `apps/mobile/design-reference/meal_reminder.html`).

Built 2026-07-07 16:56–17:51, **fully wired, typechecks clean, still uncommitted.**

| File | LOC | Status |
|---|---|---|
| `apps/mobile/app/meal-reminder.tsx` | 520 | ✅ new — modal route, timer bar, item rows, 3 actions |
| `apps/mobile/src/components/vessel-icon.tsx` | 150 | ✅ new — SVG glass/mug/bowl/apple/chapati/egg, fill = amount |
| `apps/mobile/src/lib/meal-reminder-items.ts` | 293 | ✅ new — row model, defaults, unit/step semantics |
| `apps/mobile/src/hooks/use-usual-meal-items.ts` | — | ✅ new — plan → history → static fallback |
| `apps/mobile/src/components/meal-reminder-notification-bridge.tsx` | 30 | ✅ new — routes notification taps + cold-launch tap |
| `packages/api/src/routers/nutrition.ts` | +140 | ✅ new `usualMealItems` procedure |
| `apps/mobile/src/lib/meal-plan-notifications.ts` | +101 | ✅ deep-link payload + `snoozeMealReminder` |
| `apps/mobile/src/lib/theme.ts` | +59 | ✅ meal accent gradient tokens |
| `apps/mobile/app/_layout.tsx` | +3 | ✅ modal route + bridge mounted |
| `apps/mobile/app/(tabs)/nutrition.tsx` | +11 | ✅ `__DEV__`-only "Preview reminder" button |

All three actions are wired to real backends: **Log** → `nutrition.logMeal`,
**Not eating** → `nutrition.skipPlanMeal`, **Snooze 30m** / auto-snooze at
countdown zero → `snoozeMealReminder`.

**What has NOT happened:** it has never been run on a device, never committed,
and `usualMealItems` has never been exercised against real data.

### Next concrete steps, in order

1. **Verify on a device** — `pnpm --filter @kak-fit/mobile start`, sign in,
   Nutrition tab → "Preview reminder" (dev-only button). Check light + dark,
   safe areas, and reduce-motion.
2. **Test the notification path** — schedule a plan, tap the notification, and
   confirm it deep-links to `/meal-reminder?meal=…` both warm and cold-start.
3. **Exercise `usualMealItems` with real logs** — the history branch needs ≥1
   logged meal of that type in the last 14 days; the AI-name regex
   (`^\[AI:…\]`) stripping is untested against live rows.
4. **Commit it.** Suggested: `feat(nutrition): in-app meal reminder screen with
   notification deep-link`.
5. Then pick up the backlog in §5.

---

## 3. Session log (newest first)

### 2026-07-28 — Re-orientation after 3-week break
**Shipped:** nothing new; audited repo state, regenerated Prisma client,
confirmed the meal-reminder branch of work typechecks at 0 errors, created this
file.
**Decided:** maintain a dated work log (this file) as the single "where were we"
source; roadmap/features docs stay as reference, not as history.
**Left open:** meal reminder unverified + uncommitted (see §2).

---

### 2026-07-07 (16:56–17:51) — Meal Reminder feature *(uncommitted)*
**Shipped:** full in-app meal reminder — modal screen, SVG vessel icons, "usual
items" derivation (`usualMealItems` tRPC procedure), notification deep-link
payload + response bridge, 30-min snooze rescheduling, theme gradient tokens,
dev preview entry point.
**Decided:** derive reminder rows from *real* data with a 3-tier fallback —
today's meal plan → 14-day frequency of that meal type (modal quantity, top 6)
→ small static default. No new dependencies; everything on
`react-native-svg` / `expo-linear-gradient` / `reanimated` / `expo-notifications`
already installed.
**Left open:** everything in §2 — untested on device, uncommitted.

---

### 2026-07-04 → 2026-07-05 — Android widget + lockscreen war (32 commits)
The single largest push in the project. Two full days on the native Android
active-workout surface.

**Shipped (chronological arc):**
- `01:16` native active workout widget overlay → `08:39` fixed for modern Expo
- `11:30–13:09` overlay redesign: rep ticks, rest timer, lockscreen controls,
  backgrounded-only visibility, bottom workout bar with rep/set/skip-rest
- `14:11` **pivot** — replaced the floating overlay with a MediaStyle notification
- `14:48` 12-bug sweep (data correctness, safe areas, UX)
- `15:22` nutrition meal-plan UX polish
- `15:59` EAS project migrated to the `kakfits-organization` account
- `16:27–23:14` sustained native hardening: FGS crash, service type, widget
  inflation, lifecycle APIs, notification permission, compact layout, pending
  sync flush
- `00:05` (07-05) MediaSession lockscreen, crash-safe background, auth grace
- `01:51` 12 production bugs across auth/widget/workout/API — incl. cold-start
  auth 4s → ~100ms, `STATE_PLAYING` so Android animates the rest countdown,
  10MB + MIME validation on image upload, chart/streak query caps
- `02:19` widget 3.5, offline sync indicators, routine pagination, share
  revocation, rate limiting, session revocation, failed-mutation retry
- `03:06` final: home-screen widget load + first-time OAuth sign-in

**Decided:**
- **2026-07-04:** abandon the floating-overlay approach for the workout widget
  in favor of a **MediaStyle notification + MediaSession** — the overlay kept
  crashing across Android versions and needed intrusive permissions; MediaSession
  gets lockscreen controls and an animated rest countdown for free.
- **2026-07-04:** migrate EAS to an organization account for build ownership.

---

### 2026-07-03 — AI meal planner, notifications, iOS-style typography (11 commits)
**Shipped:** active workout notification controls; **AI meal planning coach**;
daily exercise reminder emails; iOS-style system typography across the app;
removed the legacy meals logger UI; New Architecture enabled for Reanimated 4 on
Android; fixed web startup crash from `expo-notifications` and nutrition macro
ring clipping.
**Decided:** enable **New Architecture** on Android (required by Reanimated 4);
retire the old meals logger in favor of the plan-driven nutrition tab.

---

### 2026-07-02 — Design-system normalization pass (33 commits, the biggest single day)
**Shipped:** a systematic sweep converting the whole mobile app to theme tokens
— spacing normalized per tab (login, home, routines, exercises, nutrition,
progress, profile), typography migrated to the theme scale, button/touch-target
sizing standardized for accessibility, card shadows on a theme elevation system,
responsive utilities, safe-area/viewport clipping fixes. Plus: exercise detail
data mapping + "How to" tab redesign, unified exercise-detail navigation, and
API hardening (ownership checks, hot-path perf).
**Also:** merged PR #1 (`refine/login-and-active-workout-ui`) — the only PR in
the project's history.
**Decided:** **no ad-hoc spacing/typography/shadow values anywhere** — everything
routes through `theme.ts`. This is the rule the meal-reminder work later followed.
**Notable incident:** `20:15` hotfix — switching tRPC batches to POST broke all
web queries; reverted to GET.

---

### 2026-06-30 → 2026-07-01 — Google OAuth + performance overhaul (23 commits)
**Shipped:** replaced email auth with **Google OAuth via Better Auth**, fixed
redirect URI to a stable Vercel alias, fixed post-OAuth session persistence.
Then a broad perf pass: sequential mutation queue for set updates, cursor
pagination + lightweight queries on workout history, composite indexes, LRU
eviction on the tRPC session cache, proactive bearer refresh (prevents
mid-workout logout), Prisma connection pooling with graceful shutdown,
incremental PR calculation, request batching/dedup. Imported and merged the
**Hevy exercise catalog** with Wger dedup. UI revamp + unified screen spacing.
**Decided:**
- **2026-06-30:** drop email/password entirely — **Google OAuth only**. Fewer
  auth surfaces to harden for a mobile-first app.
- **2026-06-30:** PRs are computed **incrementally on write**, not on read.

---

### 2026-06-24 → 2026-06-27 — Developer REST API + production hardening (23 commits)
**Shipped:** the **Developer REST API** (`/api/v1`, `api-key: kak_…` header),
Expo web export, API key management UI, workout-start race fix, active-workout
overlay positioning, staleTime tuning, Vercel cold-start work, Prisma Accelerate
+ Mumbai region pinning, Android startup fixes, routine import dedup, and a
sweep replacing `Alert.alert` with in-app `ThemedDialog` everywhere.
**Decided:**
- **2026-06-24:** ship a Hevy-parity **public REST API** as the power-user hook,
  plus `/api/v1/llm-tools` (JSON tool definitions + system prompt) — a
  deliberate step *beyond* Hevy, aimed at LLM-driven program editing.
- **2026-06-25:** no OS alert dialogs — in-app themed dialogs only.
- **2026-06-26:** pin infra to **Mumbai** region + Prisma Accelerate for latency.

---

### 2026-06-22 → 2026-06-23 — Feature breadth + theme system (32 commits)
**Shipped:** light/dark theme system; workout detail screen; custom exercise
creation + filtering; edit routine; measurement history & multi-metric charts;
editable nutrition goals; workout rename/delete + calendar; routine folders;
exercise reorder + supersets; progress photos on Supabase Storage; RPE; share
links; gym tools; offline workout queue foundation (expo-sqlite); themed save
dialogs. Plus Metro/pnpm monorepo resolution fixes and the first Vercel deploy config.
**Decided:**
- **2026-06-22:** **free-tier limits disabled for the demo** — every feature is
  free, no paywall. (Still true; unwinding this is a Phase 3 task.)
- **2026-06-22:** dark mode keeps large headings white; blue reserved strictly
  for interactive accents.
- **2026-06-23:** drag-to-reorder replaced with up/down controls (Expo Go crash);
  drag was reinstated later once builds moved off Expo Go.

---

### 2026-06-20 → 2026-06-21 — Foundation + Phase 1 + first redesign (23 commits)
**Shipped:** roadmap with Hevy competitive research; Turborepo monorepo
(Next.js + Expo + Prisma + tRPC); **Phase 1 core workout engine**; design system;
nutrition schema + USDA FoodData Central router; Meals tab; auth hardening
(CORS, bearer fallback, LAN origins); Wger import; Hevy Explore UI. Then on
06-21, a **full green & white redesign** of the mobile app.
**Decided:**
- **2026-06-20:** Expo + Next.js + tRPC + Prisma/Postgres + **Better Auth**
  (chosen over NextAuth for the mobile/Expo session story).
- **2026-06-20:** **Wger** for exercises + **USDA FoodData Central** for
  nutrition — both free, keeping platform API cost at $0.
- **2026-06-20:** social feed **deferred out of MVP** to Phase 5; ship the best
  logger + progress tracker first.
- **2026-06-21:** pin **Expo SDK 54** for Play Store Go compatibility.

---

## 4. Decision log (dated, most recent first)

| Date | Decision | Why |
|---|---|---|
| 2026-07-07 | Meal-reminder rows come from plan → 14-day history → static default | Reminder must show *your* usual items, not a generic list |
| 2026-07-04 | Workout widget = MediaStyle notification + MediaSession, **not** a floating overlay | Overlay crashed across Android versions and needed intrusive permissions; MediaSession gives lockscreen controls + animated rest countdown natively |
| 2026-07-04 | EAS project moved to `kakfits-organization` | Build/ownership hygiene before store submission |
| 2026-07-03 | New Architecture ON for Android | Required by Reanimated 4 |
| 2026-07-03 | Legacy meals logger removed | Superseded by the plan-driven nutrition tab |
| 2026-07-02 | All spacing / typography / shadows must come from `theme.ts` | Ad-hoc values were causing light-theme and safe-area regressions |
| 2026-07-02 | tRPC batches stay on **GET** for web | POST broke every web query (same-day hotfix) |
| 2026-06-30 | Google OAuth only — email/password removed | One auth surface to harden; mobile-first |
| 2026-06-30 | PRs computed incrementally on write | Avoids O(n) recalc on every read |
| 2026-06-26 | Mumbai region + Prisma Accelerate | Latency for the primary user base |
| 2026-06-25 | In-app `ThemedDialog` everywhere, no `Alert.alert` | OS alerts break theming and don't work on web |
| 2026-06-24 | Ship a public REST API + `/api/v1/llm-tools` | Hevy's Pro differentiator; the LLM tools endpoint goes beyond it |
| 2026-06-22 | Free-tier limits **disabled** for the demo build | Everything free until billing ships |
| 2026-06-20 | Better Auth over NextAuth | Better Expo/bearer session story |
| 2026-06-20 | Wger + USDA (both free) | $0 platform API cost — users pay, we don't |
| 2026-06-20 | Social deferred to Phase 5 | Logger + progress first; social is not the launch wedge |

---

## 5. Remaining work

### Immediate (this session)
- [ ] Verify meal reminder on device (light/dark, safe areas, reduce-motion)
- [ ] Verify notification tap → deep link, warm **and** cold start
- [ ] Verify `usualMealItems` history branch against real logged meals
- [ ] **Commit the meal reminder feature**

### Quick wins (1–2 days each) — from FEATURES.md
- [ ] `placeholderTextColor="#6b7280"` hardcoded in `developer-api.tsx` — breaks light theme
- [ ] Developer API screen "copy" uses `Share.share` instead of clipboard (needs `expo-clipboard`)
- [ ] `docsUrl` tRPC proc reads `BETTER_AUTH_URL`; wrong when unset
- [ ] Version string `v0.2.0 · Free` hardcoded in `settings.tsx`
- [ ] Dashboard shows hardcoded Followers/Following `0` — hide until social exists
- [ ] `/api/v1/llm-tools` lists only 8 of 20+ endpoints
- [ ] Add `claude_system_prompt` + `openai_system_prompt` (currently Gemini-only)
- [ ] Add `/api/v1/openapi.json` (currently HTML docs only)
- [ ] Progress photo upload fails silently when storage env vars are absent

### Medium (about a week each)
- [ ] **Full offline logging** — `offline-workouts.ts` only queues `updateSet`,
      `updateExerciseNotes`, `finishWorkout`. No queue for start / add exercise /
      delete set. **Network drop mid-workout still loses data.** Highest-value gap.
- [ ] CSV export (workouts + measurements)
- [ ] Monthly / year-in-review report
- [ ] In-app AI assistant screen (LLM over the `/api/v1` tools)
- [ ] More body measurement fields (hips, thighs — currently 5 vs Hevy's 14)

### Phase 3 — Monetization (not started, blocks public launch)
- [ ] Billing (Stripe or RevenueCat): monthly / yearly / lifetime
- [ ] Enforce free tier: 4 routines, 7 custom exercises, 3-month history —
      **currently unenforced in every router**
- [ ] Upgrade prompt + Pro unlock flow
- [ ] Flip `DEVELOPER_API_REQUIRE_PRO=true` in production

### Larger
- [ ] Social feed (schema exists, zero UI) — Phase 5
- [ ] Strength-level benchmarks
- [ ] Apple Watch / Wear OS

---

## 6. Repo quick reference

```bash
pnpm install
pnpm db:generate        # ← run first, or typecheck lies to you (244 phantom errors)
pnpm docker:up          # local Postgres
pnpm db:push
pnpm db:import          # 855 Wger exercises

pnpm --filter @kak-fit/web dev        # API (terminal 1)
pnpm --filter @kak-fit/mobile start   # Expo (terminal 2)
pnpm --filter @kak-fit/mobile typecheck
```

```
apps/web/      Next.js API server (tRPC + /api/v1 REST + Better Auth)
apps/mobile/   Expo Router app (iOS / Android / web)
packages/api/  shared tRPC routers + services
packages/db/   Prisma schema + Wger/Hevy import scripts
```
