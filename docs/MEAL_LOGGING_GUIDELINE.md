# Meal-Logging — Competitor Teardown & Design Guideline

> How we make meal logging **effortless** — our moat. Built from a frame-by-frame
> study of **FITTR** (our named competitor) and **Lifesum**, run through the studio
> (product · design · brand · data). Companion to [PRODUCT.md](./PRODUCT.md),
> [JOURNEYS.md](./JOURNEYS.md), and `.claude/context/design.md`.
>
> _Written 2026-08-11. Palette + copy marked "proposed" need a sign-off (see §8)._

---

## 0. The one idea

Every competitor loses users because **logging is a chore and people quit around
week two**. Our reframe: **both our users already have a plan to log against** — the
coached client has the coach's plan, the solo/AI user has our AI meal plan. So
logging should be **verifying, not constructing**. Everything below serves that.

Neither reference app's *mood* is ours. FITTR = dense, colourful, upsell-anxious.
Lifesum = friendly, watercolour, paywall-cheerful. **Ours is an understated private
trainer: calm, confident, warm-dark.** The screen should feel like it already knows
your day and is quietly holding it for you.

---

## 1. Teardown — FITTR (our named competitor)

Dark, dense "super-app." Model = marketplace/community (owns the customer; coaches
are supply) — the model we **reject**. Still, its logging UX is the most relevant
in the Indian market.

**Nutrition is plan-driven.** A coach/diet-plan prescribes the day's meals. Each
food row = name · "200 gm • 118 Kcal" · macro line "P:6 C:10 F:6" · inline quantity
edit (tap the number → editable "200 ✎ gm") · a `⋯` menu · and a **check to "mark
consumed."** Per-meal "Tap to mark this meal as consumed" + a global "Mark all
meals as consumed" toggle. For a coached client, logging collapses to **ticking
checkboxes** on a pre-filled plan — near-zero friction.

**Natural-language multi-item logging (the standout).** A "Log your Breakfast"
modal with a freeform box — *"100g chicken, 100ml apple juice, 2 slices bread, 2
pieces paneer, 1 tsp/tbsp sugar, 1 bowl/katori rice"* — "use comma or press return
to add multiple items," plus **Catalogue** (browse DB) and a **camera** (photo).
Indian units are native: bowl/katori/piece/slice.

**Heavily Indian food DB** with Indian portions (Idly Batter, Coconut Chutney,
Paneer, Khichadi).

**Deep nutrition detail:** sugar/fibre, protein, fat (sat/unsat/trans), each with
"% of target calories" bars; a micronutrient sheet (vitamins, minerals); RDA
explainer. Plus Daily Calorie Budget, Insights, Meal Reminders, a "quick tip"
banner, and contextual recipes ("Recipes For Milk," filter by Macros/Cuisine).

**Elsewhere:** video-demo-first workouts (play thumbnail per exercise → set logger),
a marketplace "Get a Coach" (packages from ₹1,866/mo, certified coaches, weekly
monitoring), tools/calculators, wearable trackers, Refer & Earn, community chat.

**Aesthetic & anti-patterns:** near-black bg, dark-grey cards, teal/green accent,
macro bars in green/blue/red, gradient promo cards. Powerful but **busy** —
padlocks and upsells scattered everywhere, super-app sprawl.

---

## 2. Teardown — Lifesum

Light, warm, friendly consumer tracker.

- **Diary:** a big **"Remaining"** calorie ring (Eaten / Remaining / Burned) + 3
  macro cards with progress bars + meal cards (Breakfast/Lunch/Dinner/Snacks), each
  with a food thumbnail, a **"Recommended 540–810 kcal"** range, and a big `+`.
- **Meal-log screen:** search bar + **barcode scan**; a persistent "Daily intake
  X/2700 kcal" summary; three tabs — **History** (last tracked) / **Favorites**
  (usual meals) / **Quick-add**. Search rows = name · kcal · serving · verified
  badge · one-tap `+`. On add: a **"Food added" toast**, live-updating totals,
  animated macro bars, a big green **DONE**. An **"AI — track your meal faster"**
  fast-lane.
- **Gamification:** weekly Life Score ring, streaks, weight graph, watercolour
  illustrations. Programs (16:8 fasting, high-protein), recipes.
- **Anti-patterns:** paywall-heavy (SAVE 50%, locks on recipes/AI/create-meal),
  cheerful serif headers that set a register we don't want.
- **Note:** its light palette (off-white + green `#3DB54A`) is almost identical to
  our *current* pre-pivot theme — validation that the ergonomics travel, but not
  the look we're moving to.

---

## 3. Features to add — priority for our use case

Judged against the moat: a feature earns v1 only if it removes taps or removes
thinking, for **both** the coached client (verify a plan) and the solo/AI user
(construct a meal).

### Must-have (v1)
1. **Plan-driven one-tap "mark as had it."** Our moat made literal — coach or AI
   prescribes the day, logging = confirming. Highest leverage on the board, and it
   also feeds the coach's adherence view.
2. **Favourites / last-tracked one-tap re-log.** People eat the same ~15 things;
   turn repeats into one tap. Lifesum's real lesson (not its rings).
3. **Indian food DB + Indian portions** (katori/bowl/roti/piece). Foundational
   enabler — USDA FoodData Central is wrong for an India-first app. **Build-vs-buy
   decision** (licensed Indian nutrition DB vs. self-built) — flag to Tech Lead.
4. **Live totals + a calm toast.** Cheap; makes each tap feel like it did
   something, reinforcing the loop.

### Build FIRST
**Notification → one-tap "mark consumed" on the prescribed plan.** It closes the
exact loop in our core bet (notification → one tap → done), and the plumbing
largely **already exists** — see §3.1. This is under-built UI on existing API, not
a rebuild.

### v2
- **Natural-language multi-item logging** (the off-plan escape hatch). Great, but
  needs a mature Indian DB + a parser that understands Indian units first, or it
  embarrasses us on day one.
- **Barcode scan** (packaged food; needs its own barcode DB — another build-vs-buy).
- "Recommended range" per meal — mild value for free/solo users; redundant for
  coached clients (the plan already sets the target).

### Skip
- **Photo logging** — AI-vision cost + error rate; novelty, not retention.
- **Deep micronutrient / RDA sheets** — FITTR clutter; violates one-primary-action.
- **Contextual recipes** — super-app sprawl we explicitly reject.

### 3.1 What already exists in the codebase
`packages/api/src/routers/nutrition.ts` already has `markPlanMealAte`,
`skipPlanMeal`, `swapPlanMeal`, `reusePreviousPlan`, `generatePlan`, and
`searchFoods` / `searchFoodsUsda`; `useUsualMealItems` / `nutrition.usualMealItems`
already ranks a user's frequent items per meal type. The gap is the **UI**: the log
surface currently opens as a full Modal, search-first, with **no Recent/Usual/
Quick-add segments** (`apps/mobile/app/(tabs)/nutrition.tsx:1279+`) — so the one-tap
moat is under-built exactly where it matters most.

### Coach angle (why checkbox logging outranks the flashier NL feature)
- **Solo user** must *construct* each meal → logging is creation, higher friction.
- **Coached client** only has to *verify* → logging is a tick. Friction drops to
  near-zero for the user who didn't choose us and is most likely to quit.
- Those ticks answer coaches' #1 complaint ("clients stop logging → I'm back on
  WhatsApp"). It passes the product test: *it helps the coach run their business.*

---

## 4. Design guideline (combined → our "quiet wealth")

### 4.1 Daily nutrition home — lead with ONE hero, not a dashboard
- Open on a single **"Remaining" calorie ring** — the one number a repeat user
  checks. Reuse the existing **tick-mark `ProgressRing`** (`charts.tsx:159`) as our
  **signature element**; keep everything else flat and quiet.
- Center: big Remaining kcal (`h1`) + small `caption` label. Under it, **three thin
  macro bars** (P/C/F) — not three cards (cards compete with the hero).
- Below: **meal sections** (Breakfast/Lunch/Dinner/Snacks) as `ListGroup`s; each
  header = name + rolled-up "420 kcal · 22g P" + one quiet `+`.
- **No promo card, no points token, no streak banner here.** Streaks/progress live
  on the Progress tab. This screen has one job: see Remaining, log the next thing.

### 4.2 Meal-log entry — a Sheet, not a new page
- Open logging as a **bottom Sheet** over the dimmed day (keeps context). Persistent
  header inside: which meal + a **live "Daily intake" total** that updates on every
  add (Lifesum's best idea).
- Top row: **one search field + inline scan + camera icons** (right-aligned, quiet).
  Barcode/photo do **not** get their own big buttons.
- Under search: **three segments — Recent · Usual · Quick add** (one real segmented
  control). Default landing = **Usual** (≈80% of logging is a repeat). Search is the
  exception, not the default.
- **Natural-language input is the behaviour of the search field**, not a 4th tab —
  typing "2 roti and dal" parses multi-item (builds on `usualMealItems` +
  `searchFoods`).
- Result row = name · serving · kcal · one tap-to-add `+`. Tapping the row body
  opens **inline quantity edit** (FITTR's "200 ✎ gm" as a small stepper, not a
  modal-in-a-modal).

### 4.3 One-tap re-log ergonomics (the moat)
Target: a repeat meal is **one tap, from wherever the user already is** — three
doors into the *same* pre-filled action:
- **Usual tab is the engine.** Surface the top ~6 frequent items as full-width rows
  with a big `+`; one tap = logged at last-used quantity + quiet "Logged" toast +
  ring animates. No confirm step.
- **Recent tab = "same as yesterday."** Top row is the literal previous day's
  version of this meal as a single **"Repeat breakfast"** action — one tap re-logs
  the whole meal. The single highest-leverage tap in the app.
- **Notification deep-link closes the loop.** The reminder already deep-links
  (`meal-reminder-notification-bridge.tsx`); landing must be a **pre-scoped one-tap
  confirm** — the sheet opens on the right meal, Usual tab, previous items
  pre-filled. Notification action buttons ("Log the usual" / "Something else")
  should let the fastest path skip the app where the OS allows.

### 4.4 Coached-client variant — a calm plan, not a chore list
- Meal rows arrive **pre-populated, styled as "planned"** — full-colour text with an
  **unfilled ring-dot** on the left (echoes the calorie ring; not a checkbox
  square). Tap → fills emerald with a soft haptic; confirmed items settle to a
  dimmer `textMuted` (done, not celebrated-loud).
- Keep **"mark the whole meal as had it"** at the meal header (FITTR's mark-all,
  reframed) — the coached equivalent of the Usual one-tap.
- **Swap, don't fail.** Ate something else → "had something else" opens the same log
  sheet. The plan bends (rollover), it doesn't turn red.
- **No guilt.** An unconfirmed dinner at 10pm says nothing accusatory; a missed meal
  rolls forward quietly. Coach presence is a **thin, warm attribution** ("Today's
  plan from Coach Rhea"), never a big card or a nag.

### 4.5 Visual translation to "quiet wealth" *(proposed target — not yet in theme.ts)*
- **Ring vs bars:** ring for the ONE hero (Remaining); bars for the three macros.
  Never two rings, never rings-per-macro.
- **Cards:** flat `surface` on `bg`, `radius.lg`, hairline `border`, `shadows.sm`
  only. **No gradients/glass on content surfaces.** Meal items are rows in one
  `ListGroup`, not nested cards. Gradient is allowed in exactly one place — the
  reminder art.
- **Dark-first palette** (hand to Tech Lead as the dark target; replaces the current
  pre-pivot green/blue in `theme.ts:54–127`):
  - `bg` **warm charcoal, not pure black** — ~`#121311` (pure `#000` is FITTR's cold
    look).
  - `surface #1B1C19` · `surfaceHover #232420` · `border #2A2B27` (barely-there
    separation; whitespace does the work).
  - `text` **warm off-white** `#F4F1E9` (champagne-tinted) · `textMuted #A8A399`
    (never pure white).
  - `accent` **quiet emerald** ~`#2FA56A` (deep, not neon; replaces dark-mode blue
    `#0A84FF`) · `accentMuted` ~12%.
  - `gold` **champagne** ~`#CBB07C`, reserved for PRs/badges/"over target" — a
    special-moment token, not a UI accent.
- **Macro colours — a restrained data set** (retune the candy indigo/pink/amber at
  `theme.ts:86–88, 124–126`): Protein → emerald · Carbs → champagne gold · Fat →
  muted clay/bronze (~`#B8846B`). Low saturation — "instrument," not confetti.
  Emerald stays the only *interactive* accent.
- **Typography — stay all-sans on the logging surface.** Numbers must read clean;
  Lifesum's friendly serif is the register we reject. Reserve any warm display face
  for *emotional* moments only (weekly recap, coach welcome, a milestone) — never a
  food row.
- **Ring depletion** (already the right idea at `nutrition.tsx:161–164`): emerald
  fill on `surfaceHover` track; shifts emerald → champagne as remaining depletes;
  crosses to `danger` only when meaningfully over. Just retarget the tokens.

### 4.6 Steal / refuse
**Steal from FITTR:** ① Indian-unit natural-language logging · ② inline quantity
edit on a row · ③ coached "mark the meal as had it" roll-up (reframed as a plan).
**Steal from Lifesum:** ① persistent live "Daily intake" total · ② Recent/Usual/
Quick-add as the log spine (capped at three) · ③ calm confirmation (toast + macro
animation + whitespace).
**Refuse (both apps do these):** ① upsell locks in the flow — no padlocks on food
rows or macro detail; monetisation lives elsewhere, never mid-log · ② guilt / red
"behind" states — missed rolls forward with warm copy · ③ surface sprawl /
dashboard-itis — one hero, then meals · ④ gradients/watercolour everywhere (one
gradient home only: the reminder art).

---

## 5. Copy (ready to use; India-first, understated)

Name-agnostic — nothing here breaks at rename. British spelling ("favourites").

- **NL input placeholder:** `2 roti, a katori dal, half a bowl of sabzi`
  **Helper:** `Type it like you'd say it. Separate items with a comma.`
- **Logged-item estimate line:** `Roughly 320 kcal · 14g protein` (keep "Roughly" —
  honest, non-diagnostic).
- **Empty — no meals yet:** `Nothing logged yet` / `Add your first meal — a line of
  text is enough.` / **`Add a meal`**
- **Empty — per slot:** `Not logged yet`
- **Empty — no favourites:** `No favourites yet` / `Log a meal you eat often, then
  save it here for one-tap next time.`
- **Success toast:** `Logged.` (variant: `Logged — dinner's done for today.`; rare
  warm variant: `Logged. Nice and easy.`) — no confetti.
- **Coached "mark consumed":** `Had this` → `Had it ✓` · whole day: `Mark today's
  meals as had` · skipped: `Skipped this one? That's fine — it rolls to tomorrow.`
- **Buttons:** `Add a meal` · `Done` · `Save as usual` · `Log with a photo` · `Type
  or say it`.
- **Reminder notifications (deep-link to one-tap logging):**
  - `Lunchtime. What was on the plate? Tap to log in a line.`
  - `Winding down? If today's meals are still open, a quick line sorts it. If not,
    no worries.`
  - `Busy day — totally fine. Got a minute? Log dinner. If not, tomorrow's here.`
- **Vocabulary discipline:** keep the action name constant end-to-end —
  `Add a meal` → `Logged.` (not "Success"); `Had this` → `Had it` (never "Consumed").

---

## 6. What we'll measure (before/after the current USDA flow)

- **North star:** **D14 logging-day retention** — of users who logged on their first
  active day, the % who log ≥1 meal on a day in the D11–D14 window. (The cliff every
  competitor falls off.)
- **Guardrails:** median time-to-log (p50/p90) must be ≤ the current search flow;
  log-completion rate must not drop; edit/correction rate must not climb.
- **Events** (`object_action`): `meal_log_started`, `nl_parse_submitted`,
  `favorite_relogged`, `plan_item_marked_consumed`, `log_completed`. Shared props:
  `method: search|nl|favorite|barcode|photo|plan_checkbox`, `source:
  notification|manual|plan|widget`, `meal_slot`, `is_coached`, `latency_ms`,
  `item_count`. **Privacy: never put raw meal text, images, or barcode payloads in
  event properties** — length/counts only.
- **Leading indicator of "effortless":** share of `log_completed` via one-tap paths
  (`method ∈ {favorite, plan_checkbox, barcode}`).
- **Measurement:** prefer a user-level A/B (not per-session); if under-powered at the
  thin-slice stage, use before/after matched weekly cohorts and read the fast
  indicators (latency, one-tap share, completion) first — retention needs weeks.
  No analytics library is wired up yet.

---

## 7. Gating dependencies

1. **Indian food database** — we're on USDA (US foods); nothing below works well for
   India without this. Build-vs-buy.
2. **The "quiet wealth" re-skin of `theme.ts`** — the current palette is pre-pivot;
   the entire look in §4.5 is blocked on it. This is the visual gating item.

---

## 8. Open questions / needs sign-off
- **Palette (§4.5):** approve the proposed charcoal/emerald/champagne hexes as the
  dark target, or iterate against your screenshots.
- **Copy:** confirm British **"favourites"** spelling, and whether to keep the ✓ in
  `Had it ✓`.
- **Indian food DB:** build vs. licence — Tech Lead to scope.
- Same "effortless" treatment is wanted for **exercise logging** next — this doc is
  meals-first by request.
