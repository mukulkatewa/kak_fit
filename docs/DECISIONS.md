# Kak Fit — Locked Decisions

> The running list of everything we've **finalised**. Add to it as we settle
> things; never quietly change a line — strike it and add the new decision so the
> history stays honest. Companion to [PRODUCT.md](./PRODUCT.md) (the full story)
> and [PLATFORM_PIVOT.md](./PLATFORM_PIVOT.md) (architecture).
>
> _Started: 2026-08-07 · Name still TBD (working name "Kak Fit")_

---

## ✅ Finalised — product & model

1. **One platform, one brand.** Everyone is a user of the same app. Platform-first,
   **not** white-label, **not** a per-coach app.
2. **Coaches are power-users first.** They log their own training and food here, and
   can *also* coach others.
3. **The core craft is friction-free logging.** Every competitor loses users because
   logging is a chore. Making it effortless is our moat.
4. **Notification-driven one-tap logging** is the primary mechanism (meals shipped;
   extend to workouts and metrics).
5. **Universal logging engine.** Anyone can search and log any exercise, food, or
   metric. The onboarding survey only drives **plan recommendations** (e.g.
   age-appropriate), never app capability.
6. **Social = selective sharing, not broadcasting.** A friend-graph where you share
   only what you choose; others can view and suggest. **"Content" means diets/meal
   plans that people can copy** — no public photo/video feed.
7. **Granular privacy.** You decide what's shared. A coach/nutritionist you hire sees
   only what you grant — including the medical/lab section.

## ✅ Finalised — power dynamic & ownership

8. **The client owns their account and data.** It lives on the platform, forever.
9. **The coach owns the coaching relationship + their IP** (program/meal templates),
   **their earnings, and sets their own price.**
10. **Coach exit:** the coach takes their client list + templates; the client keeps
    their account and data and can go solo, use AI, or switch coaches.

## ✅ Finalised — money

11. **Three-rung ladder:** Free (track) → **AI Coach** (paid) → **Human Coach** (paid,
    via the creator).
12. **Free to track forever; pay for AI + human coaching + heavy media/reports.** The
    paywall matches our real costs (AI, images, compute — *not* storage).
13. **Coached users pay once.** The coach's price includes platform access; we take a
    cut (revenue-share). No double charge.
14. **Two SKUs, decoupled.** Cancel the coach → drop to Free (data retained) or a cheap
    platform-only tier. **The platform subscription survives a coach cancellation.**
15. **India-first payments:** INR, UPI AutoPay / e-mandate, Razorpay (Route for coach
    payouts). Quarterly billing favoured (market norm, lower churn).

## ✅ Finalised — features

16. **Rollover / Carry-over** (default ON, toggle in settings):
    - *Exercise:* a skipped exercise rolls to the **next suitable session** (not blindly
      the next day) — **capped and expires after ~3–4 days**, respecting recovery.
    - *Food:* rebalances **same-day only** to hit the day's target. **Never bank calories
      across days** (health/liability risk). Gentle, with a floor — never starve a meal.
17. **Medical / lab section** (side section, not headline): store reports; **AI
    summarises them *for the human coach*; the human gives the advice.** No AI medical
    advice to users, no diagnosis.
18. **Meal reminder with notification deep-link** — shipped (branch
    `feat/meal-reminder-notifications`).
19. **Coach credentials are captured, shown, and feature-gated** — fitness coach →
    workouts only; nutrition credential → diet plans; medical professional → medical/
    lab section. "Verified" badge on profiles. Disclaimers + injury waivers required.
    Legally driven — see [legal.md](./legal.md).

## ✅ Finalised — design & tone

19. **"Quiet wealth" look:** near-black charcoal base · deep emerald/forest green
    primary · champagne-gold/brass accent used sparingly · warm bone/off-white text
    (never pure white). Minimal, spacious, refined. Delivered as a re-skin through the
    existing `theme.ts` tokens.
20. **Tone of voice:** an understated private trainer — calm, confident, few words.
    Not gym-bro, not clinical.

## 🚫 Finalised — NOT building

21. No coach marketplace / discovery (coaches bring their own clients).
22. No pre-recorded course store (reference clips inside a plan are fine).
23. No public photo/video social feed.
24. No AI-generated medical or diagnostic advice to users.
25. No in-house video calling — Google Meet via the Calendar API for live sessions.

---

## 🟡 Open — still to decide

- **The name** — in progress. Rename is on; "Kak Fit" is a placeholder.
- **Wearables** (Fitbit / Apple Health / Google Fit) — agreed as a **later** feature,
  not v1.
- **v1 seeding** — the app is universal, but *which coaches we recruit first* is unsettled.
- **Refunds & disputes** — who owns chargebacks and support: us or the coach?
- **Coach vetting & liability** — terms, disclaimers ("not medical advice"), screening level.
- **Cold start** — first 10 coaches; a "import your WhatsApp/Excel clients" tool?
- **Build sequencing** — leaning toward building the light social layer *with* the core
  (since it's sharing, not a heavy feed), rather than as a separate phase.

## 🔧 Proposed — engineering (not yet ratified)

_My recommendations from earlier; flagged as proposed, not locked, until you say go._

- Move hosting/data to **AWS** (App Runner + RDS + S3/CloudFront) on your credits.
- Add **Sentry** (no error tracking exists today).
- Put **storage behind an interface** (currently welded to Supabase).
- Add **`packages/core`** for pure business logic (pricing, payout splits, macros).
- Extract the API out of Next.js into a container when convenient (not urgent).
- Money stored as **integer paise, in a ledger** (never floats).
