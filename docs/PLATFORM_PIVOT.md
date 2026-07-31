# Kak Fit — Coaching Platform Architecture

> **The pivot:** from a single-player workout tracker to a marketplace where
> **live personal trainers** coach real clients — monitoring their training,
> nutrition and health, prescribing routines and diets, and running live sessions
> over Google Meet.
>
> _Decided: 2026-07-28 · Status: design agreed, Phase A in progress_

---

## 1. What this is (and deliberately is not)

**Is:** a community connected to personalised trainers. A coach takes on clients,
sees their real training and nutrition history, prescribes routines and meal
plans, and meets them live 1:1 or in small groups over Google Meet.

**Is not:** a course marketplace. Pre-recorded courses are explicitly out of
scope — coaches who want to sell those should sell them elsewhere. A coach may
attach short reference clips (a warm-up demo, a form cue) *inside* a prescribed
plan, but reference material is never a sellable product on its own.

This constraint is a feature, not a limitation — it's what keeps the economics
work (§2) and kills video-hosting cost almost entirely (reference clips reuse the
existing `ExerciseMedia` + Supabase Storage path).

---

## 2. Monetization — the decision that shapes everything

### The store-tax problem

| What is sold | Apple's treatment | Effective take |
|---|---|---|
| **1:1 realtime coaching** | Guideline 3.1.3(d) explicitly carves out person-to-person realtime services and names *fitness training* | **0%** — own payment rail |
| **One-to-few / one-to-many realtime** | Must use in-app purchase | 30% (15% under Small Business Program) |
| **Pre-recorded content** | Digital content — IAP required | 30% / 15% |

Group classes are in scope for the product but land in the taxed bucket if sold
as tickets.

### The resolution: sell the relationship, not the class

**A client subscribes to a coach.** That subscription is a 1:1 coaching
relationship, which qualifies for the person-to-person carve-out and can be
billed on our own rail at 0% store tax.

**Group live sessions are a benefit of being on that coach's roster** — not a
separately-purchased SKU. A coach running a Saturday mobility session for their
twelve clients isn't selling twelve tickets; they're delivering the coaching
their clients already pay for.

This is simpler to build (no per-class checkout, no per-class refunds), matches
the stated product vision, and keeps the platform on the untaxed side.

> **Caveat, stated honestly:** this is a defensible reading of the guideline, not
> a guarantee — app review involves judgment. The fallback if review pushes back
> is web checkout (the Vercel app already exists): purchase in a browser, app
> shows entitlement only. Keep that path architecturally available: **never
> hard-code the assumption that checkout happens in-app.**

### Payment rail — India first

**Razorpay Route** (alternative: Cashfree Easy Split). Reasons:

- Marketplace split payments + creator payouts to Indian bank accounts, which
  Stripe Connect does not serve well for India-domiciled sellers
- UPI, the dominant consumer rail
- INR-native pricing, matching the aggressive-regional-pricing strategy already
  in the roadmap
- Subscriptions API for recurring coaching, with UPI AutoPay / e-mandate

Platform commission is stored per coach (`commissionBps`) rather than hard-coded,
so launch-partner coaches can be given better terms without a migration.

---

## 3. Google Meet — free, via Calendar

**You never touch the Meet API.** Meet links are a side effect of creating a
Google Calendar event.

**Flow:**

1. **Coach connects Google once.** Better Auth already does Google OAuth and the
   `Account` model already stores tokens. Add the
   `https://www.googleapis.com/auth/calendar.events` scope — **for coaches only**,
   as an incremental consent step, so clients are never asked for calendar access.
2. **On booking confirmation**, the server calls Calendar `events.insert` with
   `conferenceDataVersion=1` and:
   ```jsonc
   {
     "conferenceData": {
       "createRequest": {
         "requestId": "<uuid>",
         "conferenceSolutionKey": { "type": "hangoutsMeet" }
       }
     },
     "attendees": [{ "email": "<client email>" }]
   }
   ```
3. Google returns `conferenceData.entryPoints[].uri` — the Meet link. Store it as
   `CoachingSession.googleMeetUrl` alongside `googleEventId`.
4. **Reschedule** → `events.patch`. **Cancel** → `events.delete`. The Meet link
   follows the event.

**What you get free:** the event lands on the coach's real calendar, the client
receives a calendar invite, and Google sends both parties reminders. No video
infrastructure, no per-minute cost, no Twilio.

**Works with ordinary Gmail accounts** — Workspace is not required.

**Ship-first fallback:** a `manualMeetUrl` field on `CoachingSession` so the
booking flow can go live before the OAuth work lands. The column stays useful
afterwards for coaches who prefer their own static room.

**Failure mode to handle:** the coach's Google refresh token can be revoked. On
Calendar API failure, the booking must still succeed — mark the session
`meetLinkPending`, notify the coach to reconnect, and retry. A booking must never
be lost because Google returned a 401.

---

## 4. Health reports — the useful version that stays legal

### The line that matters

Storing medical reports makes this sensitive personal data under India's DPDP
Act. More importantly: **software that interprets a medical report and
recommends action can be regulated as a medical device** (CDSCO in India, FDA
SaMD in the US). Apple additionally restricts health data handling under
Guidelines 1.4.1 and 5.1.3.

### The design that avoids it

**The report is something the client stores and chooses to share with their
coach. A human coach gives the advice.**

- Client uploads a report (PDF/image) → stored in Supabase Storage, private bucket
- Client enters — or confirms — a few key values (weight, BP, HbA1c, vitamin D,
  haemoglobin), which become `HealthMetric` rows and chart over time
- Sharing is **per-coach, explicit, revocable** — a `ConsentGrant` with scope
  `HEALTH_REPORTS`, never implied by the coaching relationship
- The app itself renders **no diagnosis and no treatment recommendation**
- Non-medical-advice framing is shown at upload and on the coach's view

This is both the legally safe version and the more valuable one — the entire
point of the platform is connecting people to a real trainer, not to an
algorithm.

**If AI extraction of report values is added later** it needs its own consent
step, because it means transmitting medical documents to a third-party model.
Keep it opt-in and separate from the upload consent.

### Consent is the spine, not a checkbox

Every coach read of client data passes through `ConsentGrant`. Four independent
scopes — `WORKOUTS`, `NUTRITION`, `MEASUREMENTS`, `HEALTH_REPORTS` — each
grantable and revocable on its own. A client sharing their training log has not
thereby shared their blood work.

This is exactly the behaviour pinned by the integration tests in
`packages/api/src/test/isolation.integration.test.ts`, which is why that harness
was built before any of this.

---

## 5. Data model additions

Layered on the existing schema; nothing below replaces current models.

```prisma
enum CoachStatus       { PENDING  ACTIVE  SUSPENDED }
enum EngagementStatus  { PENDING_PAYMENT  ACTIVE  PAUSED  CANCELLED  EXPIRED }
enum SessionKind       { ONE_ON_ONE  GROUP }
enum SessionStatus     { SCHEDULED  LIVE  COMPLETED  CANCELLED  NO_SHOW }
enum PrescriptionKind  { ROUTINE  MEAL_PLAN }
enum ConsentScope      { WORKOUTS  NUTRITION  MEASUREMENTS  HEALTH_REPORTS }
enum BillingPeriod     { MONTHLY  ONE_TIME }

/// A user who has been approved to coach. One per User, max.
model CoachProfile {
  id              String      @id @default(cuid())
  userId          String      @unique
  headline        String
  bio             String?
  specialties     String[]    @default([])
  languages       String[]    @default([])
  city            String?
  yearsExperience Int?
  certifications  String[]    @default([])
  status          CoachStatus @default(PENDING)

  /// Platform commission in basis points. Per-coach so launch partners
  /// can get better terms without a migration.
  commissionBps   Int         @default(1500)
  payoutAccountId String?     // Razorpay Route linked account

  timezone              String  @default("Asia/Kolkata")
  googleCalendarEmail   String?
  googleRefreshToken    String? // encrypted at rest
  googleTokenRevokedAt  DateTime?
}

/// What a coach offers. Priced in paise to avoid float money.
model CoachingPlan {
  id                    String        @id @default(cuid())
  coachId               String
  name                  String
  description           String?
  pricePaise            Int
  billingPeriod         BillingPeriod @default(MONTHLY)
  sessionsPerMonth      Int
  includesGroupSessions Boolean       @default(true)
  includesNutritionPlan Boolean       @default(true)
  isActive              Boolean       @default(true)
}

/// The coach↔client relationship. THIS is the thing that gets purchased.
model Engagement {
  id                     String           @id @default(cuid())
  coachId                String
  clientId               String
  planId                 String
  status                 EngagementStatus @default(PENDING_PAYMENT)
  startedAt              DateTime?
  currentPeriodEnd       DateTime?
  cancelledAt            DateTime?
  razorpaySubscriptionId String?

  @@unique([coachId, clientId])
}

/// Client-controlled, per-scope, revocable. Every coach read checks this.
model ConsentGrant {
  id           String       @id @default(cuid())
  engagementId String
  scope        ConsentScope
  grantedAt    DateTime     @default(now())
  revokedAt    DateTime?

  @@unique([engagementId, scope])
}

/// Recurring weekly availability, stored in the coach's timezone.
model CoachAvailability {
  id          String @id @default(cuid())
  coachId     String
  dayOfWeek   Int    // 0 = Sunday
  startMinute Int    // minutes from midnight
  endMinute   Int
}

model CoachingSession {
  id             String        @id @default(cuid())
  coachId        String
  kind           SessionKind   @default(ONE_ON_ONE)
  status         SessionStatus @default(SCHEDULED)
  title          String?
  scheduledStart DateTime
  scheduledEnd   DateTime
  timezone       String

  googleEventId  String?
  googleMeetUrl  String?
  manualMeetUrl  String?   // pre-OAuth fallback; also for coaches with a fixed room
  meetLinkPending Boolean  @default(false)

  coachNotes     String?   // private to the coach
  sharedNotes    String?   // visible to participants

  @@index([coachId, scheduledStart])
}

/// Separate table so a GROUP session holds many clients.
model SessionParticipant {
  id        String    @id @default(cuid())
  sessionId String
  clientId  String
  attended  Boolean   @default(false)
  joinedAt  DateTime?

  @@unique([sessionId, clientId])
}

/// A routine or meal plan authored by a coach for a specific client.
/// Reuses the existing Routine builder and meal-plan payload shape.
model Prescription {
  id             String           @id @default(cuid())
  engagementId   String
  kind           PrescriptionKind
  routineId      String?          // when kind = ROUTINE
  mealPlanPayload Json?           // when kind = MEAL_PLAN
  note           String?
  createdAt      DateTime         @default(now())
  acknowledgedAt DateTime?

  @@index([engagementId, createdAt])
}

model HealthReport {
  id           String   @id @default(cuid())
  userId       String
  title        String
  reportDate   DateTime
  fileUrl      String
  fileMimeType String
  uploadedAt   DateTime @default(now())

  @@index([userId, reportDate])
}

/// Charted values. Manually entered in v1 — no AI extraction.
model HealthMetric {
  id         String   @id @default(cuid())
  userId     String
  reportId   String?
  key        String   // "hba1c", "vitamin_d", "systolic_bp", …
  value      Float
  unit       String
  measuredAt DateTime

  @@index([userId, key, measuredAt])
}

model Payment {
  id                String   @id @default(cuid())
  engagementId      String
  amountPaise       Int
  platformFeePaise  Int
  razorpayPaymentId String?  @unique
  status            String
  capturedAt        DateTime?
}
```

**Design notes:**

- **Money in paise (`Int`), never `Float`.** Float money is a rounding bug waiting
  to happen, and this one splits revenue between two parties.
- **`Engagement` is the unit of purchase**, which is what makes §2 work.
- **`SessionParticipant` is a separate table** even though most sessions are 1:1 —
  group sessions become a row count rather than a schema migration.
- **`Prescription` reuses `Routine`** rather than duplicating the builder. The
  coach uses the routine builder that already exists and ships it to a client.

---

## 6. Phase plan

| Phase | Scope | Blocking? |
|---|---|---|
| **A. Dev velocity** | CI, integration harness, seed, Playwright, EAS Update | ✅ **in progress** |
| **B. Coach layer** | `CoachProfile`, `Engagement`, `ConsentGrant`, coach profile screens, client roster, consent-gated client detail, prescriptions | Needs A |
| **C. Booking + Meet** | Availability, booking flow, Calendar/Meet integration, reminders via existing notification system | Needs B |
| **D. Money** | Razorpay Route, subscriptions, payouts, commission, refunds | Needs B |
| **E. Health reports** | Upload, consent-gated sharing, metric trends | Needs B |

**Phase B is the highest-leverage work** — roughly 80% of what a coach needs to
prescribe already exists (routine builder, AI meal planner, progress charts,
measurement tracking). Phase B is mostly *relationship + permission* plumbing on
top of built features, not new fitness functionality.

---

## 7. Open questions

1. **Coach vetting** — self-serve with manual approval (`CoachStatus.PENDING`), or
   invite-only at launch? Affects whether an admin surface is needed in Phase B.
2. **Commission rate** — the `1500` bps (15%) default is a placeholder.
3. **Refund policy** — mid-cycle cancellation: prorate, or serve out the period?
   Affects `Engagement.currentPeriodEnd` handling.
4. **Group session cap** — "1:10" was mentioned; enforce a hard limit per plan?
5. **Client discovery** — do clients browse coaches in-app, or do coaches bring
   their own audience from Instagram? If the latter, deep links into a coach's
   profile matter far more than a search/browse directory.

Question 5 is worth answering early — it decides whether Phase B needs a
marketplace directory or just a shareable coach link.
