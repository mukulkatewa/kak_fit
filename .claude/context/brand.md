# Brand & voice

## Name
**Working name: "Kak Fit"** — a rename is in progress. Leading candidate:
**Bryo** (verified clean in fitness; the team is avoiding Hindi names and common
English words, which are all taken). The name is an **open question** — don't
treat "Kak Fit" as final in user-facing copy decisions; flag naming choices for
the user. Package/scope names (`@kak-fit/*`) are internal and stay as-is until a
deliberate rename.

## Who we talk to
Two audiences, one app:
- **The coach** — an Instagram fitness creator running a real business. Talk to
  them like a capable peer who respects their brand: this is *their* business, we
  are the plumbing. Never make the coach feel like our employee (that's the FITTR
  trap we're the opposite of).
- **The client** — a regular person trying to stay consistent. Warm, supportive,
  never preachy or bro-y. The enemy is the drop-off after two weeks; copy should
  lower friction and celebrate small wins.

## Voice
Premium but understated — "quiet wealth," not hype. Supportive, calm, confident.
Plain words over jargon. India-first: rupees (₹), UPI, local framing — not a
Westernized $-and-Stripe tone.

## Tone rules
- Encouraging, not nagging. A reminder is a gentle nudge, not a guilt trip.
- Concrete and short — this is a phone, in one hand, often mid-workout.
- Never imply medical/diagnostic authority (legal line — see `docs/legal.md`).
  Health data is shared with a *human coach*; the app itself never diagnoses.
- Money is real and shared between two people — be precise and trustworthy about
  amounts, cuts, and payouts. No dark patterns around subscriptions or refunds.

## Reference copy
Current in-app strings live in `apps/mobile/src/` (screens under `app/`,
primitives in `components/`). Match the existing understated tone when adding
buttons, empty states, errors, and onboarding text.
