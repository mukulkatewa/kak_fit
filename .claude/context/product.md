# Product — Kak Fit (working name; rename in progress, leading candidate "Bryo")

> Full detail lives in `docs/PRODUCT.md`, `docs/START_HERE.md`, and
> `docs/DECISIONS.md`. This is the short version the personas read.

## One line
The tool that lets an Instagram fitness coach run their entire 1:1 coaching
business from their phone — their brand, their clients, their money — built
**India-first, mobile-first**, with a client app people actually keep using.

## The pivot (important)
This started as a **Hevy-style solo workout tracker** and is being pivoted into a
**creator-first coaching platform**. ~70% of the *client-side* app already exists
and works (workout logger, nutrition + AI meal planner, 1,193 exercises, progress
charts, measurements, photos, Google auth, meal reminders). The remaining work is
the **coach layer** — profiles, engagement, consent, prescriptions, booking,
payments — which is mostly permission + workflow plumbing on top of existing
features, not a rebuild. Anything in the older docs (PROJECT_ROADMAP, FEATURES,
HEVY_COMPARISON, DESIGN_SYSTEM) is **solo-tracker-era background — partly stale**.

## Who it's for
- **Primary customer — the coach.** An Instagram fitness influencer (1k–100k
  followers) who sells or wants to sell 1:1 coaching, today run on WhatsApp +
  Excel + GPay + PDF diet plans. We replace that.
- **End user — the client.** Comes because their coach brought them, not because
  they chose us. The client owns their account + data; the coach owns the
  relationship, templates, and earnings, and sets their own price.

## The core bet
Every competitor loses users because logging is a chore and people quit. Our moat
is making logging **effortless** (notification → one tap) and keeping people past
the drop-off point. We come from the consumer side, so the client app is already
good — that's the edge over coach-tools that bolted on a weak one.

## Money model
- **Three tiers:** Free (track forever) → **AI Coach** (paid) → **Human Coach**
  (paid, via a creator). Coach subscription tiered by active client count + a
  small, clearly-disclosed cut of what clients pay coaches.
- **India-first payments:** INR, UPI AutoPay, Razorpay (Route for payouts).
  Quarterly billing.
- **Money is stored as integer paise, in a ledger** — never floats, never a
  mutable balance. Splitting real money between two parties; correctness is
  non-negotiable.
- 1:1 live coaching uses Apple's person-to-person carve-out → billed on our own
  rail at 0% store tax. This is *why* we sell the coaching relationship, not
  courses or per-class tickets.

## v1 — the thin slice
One coach runs one real client end to end: share link → client auto-connects →
coach sees logged workouts/meals/measurements → assigns one program + one meal
plan → chat + check-in + one Google Meet call → client pays through the app.

## Explicitly NOT building
- ❌ Coach marketplace / discovery (that's FITTR's model, not ours)
- ❌ Pre-recorded courses (reference clips inside a plan are fine)
- ❌ A public social feed (social is light: selective sharing + copyable plans)
- ❌ Medical/diagnostic advice (health data is stored & shared with a human coach;
      the app never diagnoses — see `docs/legal.md`)
- ❌ Our own video calling (Google Meet via Calendar API, zero video infra)

The test for any new idea: *does it help the coach run their business?*
