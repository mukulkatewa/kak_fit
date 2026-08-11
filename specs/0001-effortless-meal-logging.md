# 0001 — Effortless meal logging (the moat)

## Goal
Rebuild the mobile meal-logging experience so that logging is **verifying, not
constructing**: a calm daily nutrition home led by one "Remaining" calorie ring, a
bottom-sheet log surface with a Recent · Usual · Quick-add segmented control that
lands on **Usual** for one-tap re-logging, a plan-driven "mark as had it" variant,
and a notification deep-link that opens pre-scoped to a one-tap confirm — all on the
tRPC API that **already exists**, and consuming colours **only** via `useTheme()` /
`useThemedStyles()` so the pending "quiet wealth" re-skin lands later without
touching this feature.

## Context (hints, not orders)
- Current meal-log UI is a full-screen `Modal`, search-first, no segments:
  `apps/mobile/app/(tabs)/nutrition.tsx` (log Modal at ~`:1231`; day view + hero
  ring render at `~:239`; screen root `NutritionScreen` at `~:1376`; mutation +
  invalidation patterns at `~:546–575`, `utils = trpc.useUtils()` at `~:416`).
- Signature ring to reuse as the hero: `ProgressRing` in
  `apps/mobile/src/components/charts.tsx:159` (props: `size, progress (0–1),
  color, track, ticks, children`).
- Existing API (all present — **do not add or change API**), in
  `packages/api/src/routers/nutrition.ts`:
  - `todayPlan` (`:627`), `previousPlan` (`:637`), `reusePreviousPlan` (`:648`)
  - `markPlanMealAte` (`:823`, input `{ planId, mealType }`),
    `skipPlanMeal` (`:755`, `{ planId, mealType, hunger? }`),
    `swapPlanMeal` (`:776`, `{ planId, mealType }`)
  - `searchFoods` (`:957`, `{ query }`), `logMeal` (`:961`, `{ mealType,
    timezoneOffsetMinutes?, dateMs?, items: [{ foodId?, fdcId?, name, calories,
    protein, carbs, fat, quantity }] }`)
  - `usualMealItems` (`:1065`) → `{ source: "plan"|"history"|"default", planId,
    title, time, protein, items: [...] }` (plan items carry `amountLabel`; history
    items carry `foodId, quantity, servingSize, servingUnit, amountLabel` + macros)
  - `dailySummary` (`:888`) → `{ calories, protein, carbs, fat, mealCount, targets:
    { calories, protein, carbs, fat } }`
  - `todayMeals` (`:1053`), `updateMeal` (`:1237`, `{ mealItemId, quantity }`),
    `deleteMealItem` (`:1205`)
- Hook to drive Usual: `useUsualMealItems(mealType)` in
  `apps/mobile/src/hooks/use-usual-meal-items.ts` (returns `rows, title, window,
  planId, protein, mealLabel, dayInput`); `parseMealParam` in the same file maps a
  route param / clock to a `MealTypeKey`.
- Reminder deep-link plumbing (leave the bridge + path **untouched**):
  `apps/mobile/src/components/meal-reminder-notification-bridge.tsx` pushes
  `mealReminderPath(mealType)` = `/meal-reminder?meal=<TYPE>`
  (`apps/mobile/src/lib/meal-plan-notifications.ts:171`). The route it lands on is
  `apps/mobile/app/meal-reminder.tsx` (this spec rebuilds that route's body only).
- Reusable primitives (confirmed exports): `Screen, ListGroup, ListRow, Button,
  EmptyState, useToast` in `apps/mobile/src/components/ui.tsx`;
  `HevySegmentedControl<T>` (`{ options: {key,label}[], value, onChange }`) in
  `apps/mobile/src/components/hevy-ui.tsx`; `ProgressRing` in `charts.tsx`.
  There is **no** Sheet primitive today — create one (see Changes).
- Tokens/scales + `MealTypeKey` in `apps/mobile/src/lib/theme.ts`
  (`proteinColor, carbsColor, fatColor, accent, gold, danger, surfaceHover`;
  spacing/radius/typography scales).

### Reality check the founder must hear (tech-lead call)
There is **no coach entity in the schema** — `grep` for coach/trainer in
`packages/db/prisma` returns nothing. So "coached vs solo" cannot be detected from a
coach relationship today. Both the coached client and the AI/solo user share the
**same signal: a `todayPlan` exists with items for the slot.** Therefore this spec
implements a single **plan-driven variant** keyed off `todayPlan`, which serves both
audiences. The "Today's plan from Coach Rhea" attribution line is left as a **seam**
(rendered only if a coach field is ever present; omitted otherwise) — we do **not**
invent a coach name. Wiring a real coach model is a separate future spec.

## Scope (exclusive)
This spec alone may create/edit these paths:
- `apps/mobile/app/(tabs)/nutrition.tsx` — rebuild daily home + open the sheet.
- `apps/mobile/app/meal-reminder.tsx` — rebuild body to render the shared sheet
  pre-scoped.
- `apps/mobile/src/components/meal-log-sheet.tsx` — **NEW** shared log surface.
- `apps/mobile/src/components/sheet.tsx` — **NEW** bottom-sheet primitive.
- `apps/mobile/src/components/macro-bars.tsx` — **NEW** three thin P/C/F bars.
- `specs/0001-effortless-meal-logging.md` — this file.

Everything else is out of scope (see final section). **No changes to
`packages/api`, `packages/db`, `theme.ts`, or the notification bridge/path.**

## Design constraints (verbatim from the guideline §4)
- **Daily home leads with ONE hero, not a dashboard.** A single **"Remaining"
  calorie ring** (reuse the tick-mark `ProgressRing`); centre = big Remaining kcal
  (`typography.h1`) + small `caption` label. Under it, **three thin macro bars
  (P/C/F)** — not three cards. Below: meal sections (Breakfast/Lunch/Dinner/Snacks)
  as `ListGroup`s; each header = name + rolled-up "420 kcal · 22g P" + one quiet
  `+`. **No promo card, no points token, no streak banner on this screen.**
- **Meal-log is a bottom Sheet, not a new page** — opens over the dimmed day
  (keeps context). Persistent header inside: which meal + a **live "Daily intake"
  total that updates on every add.**
- **Top row: one search field + inline scan + camera icons** (right-aligned,
  quiet). Barcode/photo do **not** get their own big buttons.
- **Three segments — Recent · Usual · Quick add** (one real segmented control).
  **Default landing = Usual.** Search is the exception, not the default.
- **Result row = name · serving · kcal · one tap-to-add `+`.** Tapping the row body
  opens **inline quantity edit** (a small stepper, not a modal-in-a-modal).
- **One-tap re-log:** Usual rows add at last-used quantity → quiet toast + ring
  animates, **no confirm step.** Recent tab top row = the previous day's version of
  this meal as a single **"Repeat breakfast"** action.
- **Plan-driven variant:** meal rows pre-populated, styled "planned" — full-colour
  text with an **unfilled ring-dot** on the left (not a checkbox square). Tap →
  fills emerald with a soft haptic; confirmed items settle to dimmer `textMuted`.
  Keep **"mark the whole meal as had it"** at the meal header. **Swap, don't fail**
  (ate something else → opens the log sheet). **No guilt** — a missed/skipped meal
  rolls forward quietly; never red, never accusatory.
- **Ring depletion:** emerald fill on `surfaceHover` track; may shift emerald →
  `gold` as remaining depletes; crosses to `danger` only when meaningfully over.
- **Colour discipline (blocking):** every colour comes from `useTheme()` /
  `useThemedStyles()`. **Zero hardcoded hex** in any new/edited file — this is what
  lets the "quiet wealth" re-skin land later without reopening this feature.
- **Type discipline:** all-sans on the logging surface (use `typography` presets);
  no serif on a food row.
- Ring for the ONE hero; **bars for the three macros. Never two rings.** Flat
  `surface` rows in one `ListGroup`, not nested cards; no gradients/glass on content
  surfaces.

## Copy (verbatim from guideline §5 — British spelling)
Use these exact strings; do not paraphrase.
- Success toast: **`Logged.`** (accepted warm variants, use the plain one by
  default: `Logged — dinner's done for today.`, `Logged. Nice and easy.`)
- Segmented control labels: **`Recent`** · **`Usual`** · **`Quick add`**
- Plan mark-consumed: row action **`Had this`** → confirmed state **`Had it ✓`**;
  whole meal header action **`Mark today's meals as had`**; skipped copy
  **`Skipped this one? That's fine — it rolls to tomorrow.`**
- Buttons: **`Add a meal`** · **`Done`** · **`Save as usual`** ·
  **`Log with a photo`** · **`Type or say it`**
- NL search placeholder: **`2 roti, a katori dal, half a bowl of sabzi`**
  Helper: **`Type it like you'd say it. Separate items with a comma.`**
- Logged-item estimate line: **`Roughly 320 kcal · 14g protein`** (keep "Roughly").
- Empty — no meals yet: **`Nothing logged yet`** /
  **`Add your first meal — a line of text is enough.`** / button **`Add a meal`**
- Empty — per slot: **`Not logged yet`**
- Empty — no favourites (Usual tab, no items): **`No favourites yet`** /
  **`Log a meal you eat often, then save it here for one-tap next time.`**
- Live total header label: **`Daily intake`** (render as `Daily intake 1,240 / 2,700
  kcal`, driven by `dailySummary`).
- Vocabulary discipline: action name is constant end-to-end — `Add a meal` →
  `Logged.` (never "Success"); `Had this` → `Had it` (never "Consumed").

## Changes

### 1. `sheet.tsx` (NEW) — bottom-sheet primitive
- Export `Sheet({ visible, onClose, children })`. Implement with RN
  `Modal` (`transparent`, `animationType="slide"`, `onRequestClose={onClose}`) +
  a pressable dimmed backdrop + a bottom-anchored panel (`surface`, top
  `radius.xl`, `shadows.lg`, safe-area bottom inset). All colours from the theme.
- This is the "over the dimmed day" container for the log surface. Keep it
  presentational; no data logic.

### 2. `macro-bars.tsx` (NEW) — three thin P/C/F bars
- Export `MacroBars({ protein, carbs, fat, targets })` rendering three thin
  horizontal bars (Protein → `proteinColor`, Carbs → `carbsColor`, Fat →
  `fatColor`) with `current/target` fill and a tiny label. Reuse `ProgressBar` from
  `ui.tsx` if it fits; otherwise a local thin bar. No cards. Theme colours only.

### 3. `meal-log-sheet.tsx` (NEW) — the shared log surface (the heart of this spec)
Export `MealLogSheet({ mealType, planId, initialSegment = "USUAL", presentation }
)`. `presentation`: `"sheet"` (wrapped in `Sheet`, used by the nutrition tab) or
`"screen"` (bare, used by the deep-link route). Behaviour:
- **Header (persistent):** meal title (from `useUsualMealItems(mealType).title`) +
  live **`Daily intake N / T kcal`** from `nutrition.dailySummary` — must update on
  every add (rely on the mutation invalidations below; do not compute a stale
  local copy).
- **Top row:** one `SearchBar`/`Input` (placeholder = NL string above) + a **scan**
  icon + a **camera** icon, right-aligned and quiet. Wire the icon affordances but
  the parse is a **v2 stub**: pressing scan/camera shows an info toast (e.g. re-use
  `Log with a photo` / "Coming soon") — leave a `// TODO(v2): barcode/photo parse`
  marker. Do **not** build a real scanner/parser.
- **Segmented control:** `HevySegmentedControl` with options `Recent` / `Usual` /
  `Quick add`; controlled `value` defaults to `initialSegment` (**`USUAL`**).
- **Usual segment (the engine):** render `useUsualMealItems(mealType).rows` (top ~6)
  as full-width `ListRow`s with a big `+` on the right. One tap → **submit at
  last-used quantity, no confirm** → `Logged.` toast + ring animates. Tapping the
  row **body** opens an **inline quantity stepper** (small +/- on the row; on commit
  call `updateMeal` if already logged, else adjust the pending quantity before
  submit). Empty state = `No favourites yet` / helper copy above.
- **Recent segment:** top row is a single **`Repeat <meal>`** action (e.g. `Repeat
  breakfast`) that re-logs the whole previous-day meal in one tap; below it, the
  recent individual items. (Source recents from `usualMealItems` history rows +
  `todayMeals`/`previousPlan` as available — do not add new API.)
- **Quick add segment:** the search results path — `nutrition.searchFoods({ query })`
  single-item add via `logMeal`. Multi-item natural-language parsing is **v2**: keep
  the placeholder/helper copy but only do single-item search now; leave a
  `// TODO(v2): NL multi-item parse` seam.
- **Plan-driven variant (when `planId`/`todayPlan` has items for this slot):**
  render the plan items pre-filled, each with a left **unfilled ring-dot** and a
  **`Had this`** affordance → tap fills emerald + soft haptic, row settles to
  `textMuted`, label becomes **`Had it ✓`** (maps to `markPlanMealAte({ planId,
  mealType })`). Header shows **`Mark today's meals as had`** (whole-meal roll-up →
  same `markPlanMealAte`). Provide a "had something else" affordance that maps to
  `swapPlanMeal({ planId, mealType })` (**swap, don't fail**). A skip maps to
  `skipPlanMeal` and shows **`Skipped this one? That's fine — it rolls to
  tomorrow.`** — never red. Coach-attribution line: render only if a coach field
  exists on the plan, else omit (seam; see reality-check note).
- **Single log-submit seam:** all add paths funnel through **one** local
  `submitLog(items, { method })` function (solo items → `logMeal`; plan confirm →
  `markPlanMealAte`). Add `// TODO(v2 analytics): emit <event>` markers for the
  guideline §6 events (`meal_log_started`, `favorite_relogged`,
  `plan_item_marked_consumed`, `log_completed`) — **do not** wire an analytics lib.
- **Invalidations (match existing pattern at `nutrition.tsx:546–575`):** after any
  successful mutation, `utils.nutrition.dailySummary.invalidate(dayInput)`,
  `utils.nutrition.todayMeals.invalidate(dayInput)`, and for plan mutations
  `utils.nutrition.todayPlan.setData(dayInput, nextPlan)` +
  `utils.nutrition.usualMealItems.invalidate(...)`. Toast on success with the exact
  copy; toast `error.message` on error.

### 4. `nutrition.tsx` — rebuild the daily home (§4.1)
- Replace the current dashboard-y day view with: **one hero `ProgressRing`** showing
  **Remaining** kcal (`dailySummary.targets.calories − dailySummary.calories`,
  floored at 0) — big number `typography.h1` + `caption` label centred inside the
  ring; ring `color` shifts `accent → gold` as remaining depletes, `danger` only
  when meaningfully over target. Under it, **`MacroBars`** (P/C/F from
  `dailySummary`). Below, **meal sections** as `ListGroup`s: header = meal name +
  rolled-up "`420 kcal · 22g P`" + one quiet `+`. The `+` (and the per-slot empty
  `Not logged yet` / whole-screen `Nothing logged yet` states) opens
  `MealLogSheet` (presentation `"sheet"`) scoped to that `mealType` (+ `planId`
  when a plan exists).
- **Remove** promo cards, points/XP tokens, and streak banners from this screen
  (they live on the Progress tab). Delete the old search-first log `Modal`
  (`~:1231`) once `MealLogSheet` replaces it. Keep the plan setup Modal (`~:903`)
  as-is unless it directly blocks the rebuild.
- Detect the plan-driven variant via `todayPlan` presence and pass `planId` down.

### 5. `meal-reminder.tsx` — land the deep-link pre-scoped
- Keep `parseMealParam(useLocalSearchParams().meal)` → `mealType`. Replace the
  body with `<MealLogSheet mealType={mealType} planId={planId} initialSegment=
  "USUAL" presentation="screen" />` so the deep-link lands **on the right meal,
  Usual tab, previous/plan items pre-filled — a one-tap confirm.** Do **not** touch
  the notification bridge or `mealReminderPath`.

## Acceptance criteria
- [ ] The nutrition home shows exactly **one** `ProgressRing` (the Remaining hero);
      there is no second ring and no per-macro ring.
- [ ] Macros render as **three thin bars** (P/C/F), not three cards.
- [ ] Each meal section header shows name + rolled-up "`<kcal> kcal · <P>g P`" + one
      quiet `+`; no promo/points/streak elements remain on this screen.
- [ ] Tapping a meal `+` opens a **bottom sheet over a dimmed day** (not a
      full-screen route); the day is still visible behind the dim.
- [ ] The sheet header shows a live **`Daily intake N / T kcal`** that increases
      immediately after an add.
- [ ] The segmented control is **Recent · Usual · Quick add** and lands on
      **Usual** by default.
- [ ] A Usual row `+` logs at last-used quantity with **no confirm step**, shows the
      **`Logged.`** toast, and animates the hero ring.
- [ ] Tapping a Usual/Recent row **body** reveals an inline quantity **stepper**
      (no nested modal).
- [ ] Recent shows a single **`Repeat <meal>`** action that re-logs the whole prior
      meal in one tap.
- [ ] Search field placeholder is exactly `2 roti, a katori dal, half a bowl of
      sabzi` with helper `Type it like you'd say it. Separate items with a comma.`;
      scan/camera are quiet inline icons (no big buttons) and are v2 stubs.
- [ ] When a `todayPlan` exists for the slot: plan items render pre-filled with a
      left **unfilled ring-dot**, a **`Had this`** → **`Had it ✓`** tap
      (`markPlanMealAte`), a header **`Mark today's meals as had`**, a swap path
      (`swapPlanMeal`), and a skip that shows `Skipped this one? That's fine — it
      rolls to tomorrow.` — **no red/guilt states anywhere**.
- [ ] The `/meal-reminder?meal=<TYPE>` deep-link opens `MealLogSheet` pre-scoped to
      that meal on the Usual tab with items pre-filled; the notification bridge and
      `mealReminderPath` are unchanged (`git diff` shows no edits to
      `meal-reminder-notification-bridge.tsx` or `meal-plan-notifications.ts`).
- [ ] Empty states use the exact copy: `Nothing logged yet` / `Add your first meal
      — a line of text is enough.` (screen), `Not logged yet` (slot), `No favourites
      yet` / `Log a meal you eat often, then save it here for one-tap next time.`
      (Usual).
- [ ] **No hardcoded hex** anywhere in the changed files — every colour is read from
      `useTheme()` / `useThemedStyles()` (verify with a grep for `#` colour
      literals in the five scoped files).
- [ ] There is a **single** `submitLog(...)` funnel in `meal-log-sheet.tsx`, and
      `// TODO(v2 ...)` seam markers exist for barcode/photo, NL multi-item parse,
      and the §6 analytics events.
- [ ] No changes under `packages/api`, `packages/db`, or `theme.ts`.
- [ ] All Checks below pass.

## Checks (run from repo root, in this order)
> `db:generate` MUST run first — a missing Prisma client produces ~244 phantom
> typecheck errors unrelated to this change.
```
pnpm db:generate
pnpm typecheck
pnpm lint
pnpm test
```
(`pnpm verify` = typecheck + test as a fast gate.)

## Manual staging test checklist
Run on a device/simulator via `pnpm --filter @kak-fit/mobile start`. Test both
light and dark mode (the re-skin isn't in yet, but colours must be token-driven).

**Solo / no-plan path**
- [ ] Fresh day, no meals → home shows Remaining = full target, `Nothing logged
      yet` + `Add a meal`.
- [ ] Tap a meal `+` → sheet slides up over the dimmed day; Usual tab is selected.
- [ ] With no history → Usual shows `No favourites yet` + helper copy.
- [ ] Quick add → search a food → `+` → `Logged.` toast, ring depletes, `Daily
      intake` climbs; close sheet → the meal section shows the rolled-up total.
- [ ] Re-open → the just-logged item now appears under Recent; `Repeat <meal>`
      re-logs it in one tap.
- [ ] Tap a Usual/Recent row body → stepper appears; change qty → total updates.

**Plan-driven path (todayPlan present)**
- [ ] Generate/have a plan → sheet shows plan items pre-filled with ring-dots.
- [ ] Tap `Had this` on one item → fills emerald, haptic, becomes `Had it ✓`, ring
      + `Daily intake` update.
- [ ] Header `Mark today's meals as had` → whole meal confirms at once.
- [ ] "Had something else" → swap flow runs (`swapPlanMeal`), meal content changes,
      nothing turns red.
- [ ] Skip a meal → `Skipped this one? That's fine — it rolls to tomorrow.`; no red
      state, remaining rolls forward calmly.

**Notification deep-link**
- [ ] Trigger/simulate a meal reminder → tap it → app opens straight to
      `MealLogSheet` on the correct meal, Usual tab, items pre-filled → one tap
      confirms and closes the loop.

**No-guilt / edge states**
- [ ] Late unconfirmed meal shows nothing accusatory.
- [ ] Over-target day: ring crosses to `danger` only when meaningfully over; slightly
      over uses `gold`, not alarm-red.
- [ ] Rapid double-tap on a plan `Had this` does not double-log (server
      re-checks inside the `markPlanMealAte` transaction — confirm the UI stays
      consistent).

## Out of scope / follow-ups (gated — do NOT touch here)
1. **Indian food DB / Indian portions (katori/bowl/roti/piece)** — build-vs-buy
   undecided; USDA stays the source for now. File as its own spec once decided.
2. **"Quiet wealth" re-skin of `theme.ts`** (charcoal/emerald/champagne) — needs
   founder sign-off (guideline §8). This feature is built colour-token-only so the
   re-skin lands without reopening it.
3. **Natural-language multi-item parsing** (`2 roti and dal` → multiple items) —
   v2; the search field does single-item search now, with a `// TODO(v2)` seam and
   the placeholder/helper copy already in place. Barcode + photo parse are v2 stubs
   (affordance only).
4. **Analytics event wiring** (§6 events: `meal_log_started`,
   `favorite_relogged`, `plan_item_marked_consumed`, `log_completed`, etc.) — no
   analytics library is wired up yet; leave the single `submitLog` funnel and
   `// TODO(v2 analytics)` markers only. Privacy rule to honour when it lands:
   never put raw meal text / images / barcode payloads in event props.

**Also intentionally untouched:** a real **coach entity** does not exist in the
schema, so the plan-driven variant serves both AI-plan and future coached users off
`todayPlan`; the coach-attribution line is a render-only seam. A coach data model is
a separate future spec.
