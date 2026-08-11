# Kak Fit — Product Definition

> The single source of truth for **what we're building and why.**
> Architecture lives in [PLATFORM_PIVOT.md](./PLATFORM_PIVOT.md). History lives in
> [WORKLOG.md](./WORKLOG.md). This file is the product.
>
> _Written: 2026-08-06 · Working name "Kak Fit" (final name TBD)_

---

## 1. One line

> **The tool that lets an Instagram fitness coach run their entire 1:1 coaching
> business from their phone — their brand, their clients, their money.**

We are not a fitness app for gym-goers. We are the **business-in-a-box** for the
coach. The coach is our customer. Their clients are the coach's customers.

---

## 2. Who it's for

**Primary customer — the coach.** An Instagram fitness influencer with an
audience (1k–100k followers) who already sells, or wants to sell, 1:1 coaching.
Today they run it on **WhatsApp + Excel + Google Pay + PDF diet plans**. That is
who we replace.

**End user — the client.** Someone who follows that coach and pays to train with
them. They never "choose" us — they come because their coach brought them.

**We sell to the coach. The coach brings the users.** That is the entire growth
model. Find 50 coaches, each brings 20–200 clients. We never buy users.

---

## 3. Why we win — the core insight

Every competitor sits in one of two camps, and both leave our customer unserved:

**FITTR (India's big player) owns the customer.** A client signs up to FITTR;
FITTR assigns them a coach. The coach builds FITTR's brand and pays FITTR a cut
of demand FITTR created. **An influencer who already has an audience would never
take that deal** — they'd be giving away the brand and money they already earned.
FITTR is demand + tools, bundled, FITTR keeps control.

**Western tools (Trainerize, TrueCoach, Everfit, FitBudd, Kahunas) are built for
the West.** Priced in dollars ($22–225/mo), paid via Stripe/PayPal, desktop-first,
and they stack add-on fees. An Indian coach charging ₹2,000/month cannot use a
$79 tool paid in USD.

**The gap between them is our whole company:**

> A **tools-only** platform, for coaches who **already have their own demand**,
> that lets them **keep their brand, their clients, and their money** — built
> **India-first and mobile-first.**

FITTR structurally can't chase this without cannibalizing itself. The Western
tools can't serve the Indian influencer's price point or payment rails. That's
the daylight we own.

---

## 4. The USPs — our distinguishing points

These are the promises. Everything we build serves one of them.

### USP 1 — It's the coach's business, not ours
The coach's name and brand are on the client's screen (white-label feel). The
coach owns the client relationship. If they ever leave, they take their clients.
We are the plumbing, never the face. *(Opposite of FITTR.)*

### USP 2 — India-first, for real
Priced in **₹**, paid via **UPI + Razorpay**, payouts to **Indian bank accounts**.
A price a coach charging ₹2,000/month can actually afford. *(No competitor does
this as a tool — FitBudd is India-built but sells in USD; FITTR is a marketplace,
not a tool.)*

### USP 3 — Mobile-first, for the coach
The coach runs their whole business from their phone — because that's where an
Instagram coach already lives. Every competitor's coach app is their weakest
piece. We win exactly where they're all worst.

### USP 4 — Everything included, one flat price
No add-ons for meal plans, no add-ons for payments, no per-transaction fee. One
predictable price in rupees. *(Kahunas proved coaches love flat + 0%; we do it
cheaper and in INR.)*

### USP 5 — Kill WhatsApp + Excel + GPay
The full loop in one app: onboard → program → nutrition → chat → check-ins →
live call → payment. The coach never opens another tool. *(Trainerize's "complete
loop," done right on mobile.)*

### USP 6 — A client app people actually keep using
The universal failure of this category: clients stop logging after two weeks, so
the coach falls back to WhatsApp. Our edge is that we came from the consumer side
— a genuinely good Hevy-style logger, nutrition tracker, and progress charts
already exist. This is the one USP that's hard to copy, and we already have it.

### USP 7 — A growth engine pointed at the coach's Instagram
Built-in **transformation challenges + before/after sharing** — FITTR's viral
loop, but working for the *coach's* brand. Every client win becomes content the
coach posts, which brings the coach more clients, which brings us more coaches.

---

## 5. How the money works

Two revenue lines, both simple:

1. **Coach subscription** — tiered by active client count. Generous free tier
   (up to ~3 clients) so a coach tries it with zero risk, then pays once they're
   earning. Predictable monthly revenue for us.
2. **A small cut** of what clients pay coaches through the app — grows as they
   grow. Kept low (well under FITTR) and clearly disclosed. Optional to start;
   subscription alone can carry v1.

**Store-tax rule that shapes the product:** 1:1 live coaching qualifies for
Apple's person-to-person carve-out → billed on our own rail (Razorpay) at **0%
store tax**. This is *why* we sell the coaching relationship, not per-class
tickets or pre-recorded courses. See PLATFORM_PIVOT.md §2.

**Money is stored as integer paise, in a ledger.** Never floats, never a mutable
balance. This splits real money between two parties — correctness is non-negotiable.

---

## 6. What's in — and what's deliberately out

### v1 — the thin slice that proves it
One coach can run one real client, end to end:
1. Coach signs up → gets a **share link** (their "link in bio")
2. Client taps link → installs → is **auto-connected to that coach**
3. Coach sees the client's **logged workouts + meals + measurements**
4. Coach **assigns one program + one meal plan** (reuses existing builders)
5. They **chat**, do a **check-in**, and book **one Google Meet call**
6. Client **pays** the coach through the app

Ship that. Put it in front of one real Instagram coach. Their reaction beats
another month of building.

### v2 — makes a coach's day easier
Templates & reuse · automation (auto-welcome, auto-assign week 1, reminders) ·
adherence dashboard across all clients · transformation challenges · coach's
business stats (clients, revenue, who's slipping).

### Later — only if coaches ask
Wearable/Health-app sync (steps, sleep) as *data for the coach* · group sessions ·
richer analytics · web dashboard for programming on a big screen.

### Explicitly NOT building
- ❌ **A coach marketplace / discovery** — coaches bring their own clients. No
  browsing, no matching. *(This is the FITTR model; it's not ours.)*
- ❌ **Pre-recorded courses** — reference clips inside a plan are fine; a course
  store is not our platform.
- ❌ **A public social feed** — follow/like/comment is a different app. Coaching
  is personal (you ↔ your coach), not a public gym-flexing feed.
- ❌ **Medical/diagnostic advice** — health data is stored and shared with a
  human coach; the app never diagnoses. See PLATFORM_PIVOT.md §4.
- ❌ **Our own video calling** — Google Meet via Calendar. Zero video infra.

The test for any new idea: *does it help the coach run their business?* If not,
it's out.

---

## 7. Where we stand today

We are **not** starting from zero. ~70% of the client-side product already exists
and works: workout logger (sets, PRs, supersets, rest timer), nutrition tracker +
AI meal planner, 1,193 exercises, progress charts, body measurements, photos,
Google auth, and the meal-reminder feature just shipped.

**The gap is the coach layer** — relationship, consent, prescriptions, booking,
payments — which is mostly *permission and workflow plumbing on top of features
that already exist*, not new fitness functionality. That's why this is a
months-of-work pivot, not a rebuild.

**Foundation work before feature work** (see PLATFORM_PIVOT.md §6 and WORKLOG.md):
error tracking (Sentry), storage behind an interface, a `packages/core` for pure
business logic, and the AWS move — get the base strong, then build the coach
layer on it.

---

## 8. The pitch, in one breath

> *"You already have the followers. We give you everything else — programs,
> nutrition, chat, live calls, and payments — under your own name, on your phone,
> priced in rupees. Stop running your coaching on WhatsApp and Excel."*
