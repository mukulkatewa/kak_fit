# Kak Fit — Start Here

> **Read this first.** It's the map to everything we've decided. If you're a new
> session or a new person picking up this project, this page + the docs it links
> are the whole plan.
>
> _Working name "Kak Fit" (rename in progress). Last updated: 2026-08-10._

---

## What we're building, in one line

> **The tool that lets an Instagram fitness coach run their entire 1:1 coaching
> business from their phone — their brand, their clients, their money — built
> India-first, mobile-first, with a client app people actually keep using.**

We started as a Hevy-style solo workout tracker. We're pivoting it into a
**creator-first coaching platform**: one app, one brand, where coaches log their
own training *and* coach others, and regular users track their whole wellness
(training, food, health) with effortless logging.

## The core bet

Every competitor loses users because **logging is a chore and people quit**. Our
moat is making logging *effortless* (notification → one tap) and keeping people
past the drop-off point. We come from the consumer side, so our client app is
already good — that's our edge over every coach-tool that bolted on a weak one.

## The model at a glance

- **Three tiers:** Free (track) → **AI Coach** (paid) → **Human Coach** (paid, via
  a creator). Free to track forever; pay for AI + coaching + heavy media.
- **The client owns their account + data** (stays on the platform). **The coach owns
  the coaching relationship + templates + earnings, and sets their own price.**
- **Coached users pay once** — the coach's price includes platform access; we take a
  cut. Cancel the coach → keep the account (data persists).
- **India-first payments:** INR, UPI AutoPay, Razorpay (Route for payouts).
  Quarterly billing.
- **Live sessions:** Google Meet via Calendar API (zero video infra).
- **Social is light:** selective sharing + copyable meal plans. **No public
  photo/video feed, no marketplace, no courses, no AI medical advice, no own video
  calling.**

---

## The docs — read in this order

1. **[PRODUCT.md](./PRODUCT.md)** — the full product definition: positioning, who
   it's for, the 7 USPs, the money model, what's in v1 vs later, what we're NOT
   building.
2. **[DECISIONS.md](./DECISIONS.md)** — the running list of everything *finalised*
   (~19 locked items) plus what's still open. **The source of truth for "did we
   decide X?"**
3. **[COMPETITORS.md](./COMPETITORS.md)** — the market, how FITTR works, what to
   steal from each tool, and our wedge.
4. **[JOURNEYS.md](./JOURNEYS.md)** — user journeys, the problem→solution table,
   the 16 core workflows (→ screens), the engagement playbook, and notification tone.
5. **[legal.md](./legal.md)** — India rules: coaching is fine without a cert;
   nutrition/medical advice needs qualifications; the product rules that forces.
6. **[PLATFORM_PIVOT.md](./PLATFORM_PIVOT.md)** — proposed architecture (AWS, data
   model for the coach layer, Google Meet, health reports).
7. **[WORKLOG.md](./WORKLOG.md)** — dated history of what was built and why.
8. **[MEAL_LOGGING_GUIDELINE.md](./MEAL_LOGGING_GUIDELINE.md)** — FITTR + Lifesum
   teardown, the features-to-add priority, and the meal-logging design guideline for
   our "effortless logging" moat.

Older reference: PROJECT_ROADMAP.md, HEVY_COMPARISON.md, FEATURES.md (from the
solo-tracker era — partly stale; treat as background, not current plan).

---

## Where things stand (2026-08-10)

**Product & strategy:** vision, model, USPs, competitor analysis, journeys, and
legal are all decided and documented (this folder). Design direction agreed:
premium "quiet wealth" (charcoal + emerald + champagne-gold, warm off-white text),
understated supportive tone.

**Code:** ~70% of the *client-side* app already exists and works — workout logger,
nutrition + AI meal planner, 1,193 exercises, progress charts, measurements, photos,
Google auth. The **meal-reminder feature** is shipped on branch
`feat/meal-reminder-notifications` (not yet merged to main). Test infra, dev seed,
and CI were added. `.env` is restored and the Supabase DB is live (10 users, 1,193
exercises).

**The gap:** the coach layer (profiles, engagement, consent, prescriptions, booking,
payments) is mostly *permission + workflow plumbing on top of features that already
exist* — not a rebuild.

## Immediate next steps

1. Merge `feat/meal-reminder-notifications` to main (after a device check).
2. Lock the **name** (leading candidate: **Bryo** — verified clean in fitness;
   avoid Hindi names and common English words, which are all taken).
3. Re-skin to the "quiet wealth" palette via `theme.ts` tokens.
4. Design pass on the core workflows (user is sharing screenshots).
5. Then build the coach layer (see PLATFORM_PIVOT.md §6 for phase order).

## Open questions (not yet decided)

- **The name** (in progress; Bryo leads).
- **v1 seeding** — which coaches we recruit first.
- **Refunds & disputes** — who owns chargebacks: us or the coach?
- **Coach vetting depth** — beyond credential capture.
- **Cold start** — first 10 coaches; a "import your WhatsApp/Excel clients" tool?
- **Build sequencing** — light social with the core, or after.
- **Engineering** (proposed, not ratified): AWS move, Sentry, storage-behind-an-
  interface, `packages/core`, money as integer paise. See DECISIONS.md.

---

## The stack (today)

Expo/React Native (iOS·Android·web) · tRPC · Prisma · Postgres (Supabase, moving to
AWS RDS later) · Better Auth (Google) · AWS Bedrock (AI) · Supabase Storage (→ S3) ·
Resend/SES (email) · EAS (builds). Monorepo: `apps/{mobile,web}`,
`packages/{api,db}`. Run: `pnpm db:generate` first (or typecheck shows 244 phantom
errors), then `pnpm dev:web` + `pnpm dev:web-app`.
