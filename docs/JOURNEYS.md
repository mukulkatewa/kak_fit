# Kak Fit — User Journeys, Core Workflows & Engagement

> How a real person moves through the app, the problems they hit at each step,
> and how we solve each one. This is the map we design screens against.
> Companion to [PRODUCT.md](./PRODUCT.md) and [DECISIONS.md](./DECISIONS.md).
>
> _Started: 2026-08-10_

---

## 1. The three people we serve

- **Solo user** — tracks their own fitness/wellness. May never hire a human (free
  or AI Coach tier).
- **Coached client** — arrived via an influencer's link; has a human coach.
- **Coach / influencer** — a power-user who logs their own training *and* runs a
  coaching business here.

The engine is the same for all; the journey differs.

---

## 2. The wellness journey — 7 stages, and the problem at each

Every user moves through these. Each stage has a churn risk and a fix.

| Stage | The problem | How we solve it |
|---|---|---|
| **1. Arrive** | "Why this app?" | Coach's link → auto-connect; a clear "start free" promise. |
| **2. Onboard** | Long forms feel like work | Short, conversational survey (goal, age, level). Drives *recommendations*, not gates. |
| **3. First value ("aha")** | No value in 2 min → uninstall | Instantly show a personalized plan / today's dashboard / their coach — value before any effort. |
| **4. Daily logging** | **People stop logging** (the category killer) | Friction-free one-tap logging via notifications. This is our moat. |
| **5. See progress** | Progress feels invisible day-to-day | Visualize wins — streaks, PRs, trends, weekly recap. Celebrate them. |
| **6. Plateau / life gets busy** | Motivation dips → drop-off | Rollover (nothing lost), coach check-ins, friend nudges, adaptive plans, win-back nudges. |
| **7. Advocate** | No reason to share | Shareable wins, copyable meal plans, referral, "become a coach." |

**The whole game is getting users past stage 4 (logging) to stage 5 (visible
progress).** That transition is where every competitor loses people.

---

## 3. The core problems in a fitness journey → our generalized answers

| The user's problem | Our answer |
|---|---|
| "I don't know what to do." | Personalized plan from the onboarding survey (AI or coach). |
| "Logging is a chore, so I quit." | One-tap logging from a notification. The core craft. |
| "I skipped a day — now I feel off-track / guilty." | **Rollover** — the skipped item moves forward, nothing lost, gently. |
| "I can't tell if it's working." | Progress visualization: streaks, PRs, trends, before/after in numbers. |
| "I lose motivation." | Streaks + coach accountability + friend sharing + celebrated wins + challenges. |
| "Am I even doing this right?" | Coach feedback, exercise demos, form references (coach reference clips). |
| "Eating right is confusing." | Nutrition tracking + AI/coach meal plans + copyable plans. |
| "I have a condition / special need." | Medical-lab section + a *qualified* coach (see [legal.md](./legal.md)). |
| "It's too generic for me (older / injured / competitive)." | Survey-driven recommendations; free to search & log anything. |
| "Expert help is expensive / out of reach." | 3-rung ladder: Free → AI Coach → Human Coach. |

---

## 4. Core workflows (these become the screens)

**Solo / client:**
1. **Onboard** — goal survey → first personalized plan.
2. **Daily home / dashboard** — today at a glance; the daily loop lives here.
3. **Log a workout** — start, log sets, finish (one-tap where possible).
4. **Log a meal** — from a reminder or manually, in a tap.
5. **See progress** — charts, PRs, streaks, weekly recap.
6. **Share / copy** — share a win or copy a friend's/coach's meal plan (opt-in privacy).
7. **Manage medical/lab** — upload a report, share with a qualified coach.

**Coach:**
8. **Onboard a client** — share link → intake.
9. **Client roster + adherence** — who's on track, who's slipping, at a glance.
10. **Build & assign** — program or meal plan (templates + AI-assist), send to a client.
11. **Communicate** — chat + weekly check-ins.
12. **Live session** — book → Google Meet link → reminders → join.
13. **Get paid** — subscription + payout.
14. **Grow** — run a challenge, share content, referral.

**Money / account (cross-cutting):**
15. **Subscribe / upgrade** — free → AI Coach → Human Coach.
16. **Settings** — privacy sharing, rollover toggle, reminders, units, credential (coach).

---

## 5. Engagement & retention playbook (post-download)

Ordered by impact:

1. **Fast "aha"** — deliver visible value in the first 2 minutes (a ready plan,
   today's dashboard, their coach). The single biggest lever against day-1 churn.
2. **Notifications as the engine** — contextual, one-tap-to-log, never spammy. The
   notification *is* the engagement mechanism (already proven by the meal reminder).
3. **Streaks** — consecutive days/weeks; the classic habit hook. Protect them
   (rollover, streak-freeze on rest days) so one slip doesn't kill the habit.
4. **Celebrate progress** — PR popups, milestones, a weekly recap the user *wants*
   to open. Make wins feel like wins.
5. **Coach touch** — for coached users, a human checking in is the strongest
   retention force there is. Prompt coaches to check in on slipping clients.
6. **Social accountability (opt-in)** — friends see what you share; gentle peer
   nudges and suggestions. Copyable meal plans pull people back.
7. **Challenges** — time-boxed goals with before/after wins (FITTR's engine),
   pointed at the coach's audience — growth + retention at once.
8. **Adaptive plans + rollover** — the plan bends to real life instead of breaking,
   so a bad week doesn't become a churned user.
9. **Win-back** — smart nudges for lapsed users ("you were on a 5-day streak —
   pick it back up"). Cheap, effective.

**Guiding principle:** reduce friction, make progress visible, and give a reason to
come back tomorrow. Everything above is one of those three.

### Notification tone — kind, never guilt-tripping

Our notifications *never* shame. The whole category nags ("You missed your workout!")
and it drives people away. We do the opposite — warm, understanding, permission to
rest.

- **Missed a day?** *"Busy day? Totally fine — rest is part of it. If you've got 5
  minutes, log it; if not, tomorrow's here."*
- **Show up?** Quiet appreciation, not confetti spam. *"Nice — that's three this week."*
- **Skipping is allowed.** We explicitly tell people it's okay to skip a day. That
  trust is what keeps them from deleting the app out of guilt.
- Contextual and sparse. One good nudge beats five ignored ones. Every notification
  should be worth the interruption.

The tone matches the brand: an understated, supportive private trainer — never a
drill sergeant.

---

## 6. Open questions for design

- What's the **one "aha" moment** we build the onboarding around? (Ready plan? First
  one-tap log? Meeting your coach?)
- What does the **daily home screen** lead with — today's plan, the rings, or the
  coach's message?
- How light can **onboarding** be while still personalizing the plan?

_(These are the things the design screenshots should help us answer.)_
