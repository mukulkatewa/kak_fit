# Kak Fit — Product Roadmap & Competitive Research

> A Hevy-style workout tracker built at a lower price point. Mobile-first, social, and progress-focused.

---

## Table of Contents

1. [Vision & Positioning](#vision--positioning)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Exercise Database (Wger)](#exercise-database-wger)
5. [Hevy Competitive Research](#hevy-competitive-research)
6. [Essential MVP Features](#essential-mvp-features)
7. [Pricing Strategy](#pricing-strategy)
8. [Research Observations & Recommendations](#research-observations--recommendations)
9. [Phase-Wise Development Roadmap](#phase-wise-development-roadmap)
10. [Database Schema Overview](#database-schema-overview)
11. [Risks & Mitigations](#risks--mitigations)

---

## Vision & Positioning

**Kak Fit** is a gym workout tracker and social fitness app modeled after [Hevy](https://www.hevyapp.com/) — the #1 workout tracker for strength training — but sold at a **lower price** to capture price-sensitive lifters who want the same core experience.

### Hevy's Three Pillars (we replicate these)

1. **Workout Logging** — fast, flexible session tracking
2. **Progress Tracking** — charts, PRs, body composition
3. **Socializing** — feed, follow, like, comment, discover

### Our Differentiation

| Dimension | Hevy | Kak Fit (target) |
|-----------|------|------------------|
| Pro monthly | $2.99/mo | **$1.99/mo or lower** |
| Pro yearly | $23.99/yr | **$14.99–$19.99/yr** |
| Lifetime | $74.99 | **$49.99 or lower** |
| Free tier | 4 routines, 7 custom exercises, 3mo history | Match or beat (e.g. 5 routines, 10 custom exercises) |
| Coach platform | Hevy Coach (separate B2B product) | Phase 4+ |
| AI programming | Hevy Trainer + HevyGPT (Pro) | Phase 5+ (optional) |

Sources: [Hevy Pro Help](https://help.hevyapp.com/hc/en-us/articles/35119778922263), [PRPath Review 2026](https://prpath.app/blog/hevy-app-review-2026.html)

---

## Tech Stack

### Frontend (Mobile First)

| Layer | Choice | Notes |
|-------|--------|-------|
| Mobile app | **React Native + Expo** | iOS + Android from one codebase; Expo Router for navigation |
| Language | **TypeScript** | End-to-end type safety with tRPC |
| State | React Query (via tRPC) + Zustand | Server state + local workout-in-progress state |
| Charts | Victory Native or react-native-gifted-charts | Progress graphs |

### Backend

| Layer | Choice | Notes |
|-------|--------|-------|
| API server | **Next.js** (App Router) | API routes + optional web dashboard later |
| API layer | **tRPC** | Type-safe mobile ↔ server communication |
| Language | **TypeScript** | Shared types with mobile |
| Auth | **Better Auth** (preferred) or NextAuth | Email + Google OAuth |
| ORM | **Prisma** | Migrations, type-safe queries |
| Database | **PostgreSQL** | Hosted on Supabase, Neon, or Railway |
| Storage | **Supabase Storage** | Profile pics, exercise videos, workout images |
| Jobs | Vercel Cron or BullMQ | Wger import, PR recalculation, feed fan-out |

### Auth Decision: Better Auth vs NextAuth

| Criteria | Better Auth | NextAuth (Auth.js) |
|----------|-------------|-------------------|
| Expo/mobile OAuth | Native support, session tokens | Requires more custom setup |
| Prisma adapter | First-class | Supported |
| Self-hosted | Yes | Yes |
| **Recommendation** | **Better Auth** for mobile-first + Expo | Fallback if Better Auth blocks |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  React Native App (Expo)                 │
│  Screens: Auth, Workout Logger, Routines, Feed, Profile   │
└──────────────────────────┬──────────────────────────────┘
                           │ tRPC (HTTPS)
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Next.js API Server                    │
│  tRPC routers: auth, exercises, workouts, routines,      │
│  social, progress, measurements, uploads                 │
└──────────┬──────────────────────────────┬─────────────────┘
           │ Prisma                      │ Supabase Storage
           ▼                             ▼
┌──────────────────────┐    ┌────────────────────────────┐
│     PostgreSQL       │    │  Buckets:                  │
│  users, exercises,   │    │  - avatars                 │
│  workouts, sets,     │    │  - exercise-media          │
│  routines, social    │    │  - workout-media           │
└──────────────────────┘    └────────────────────────────┘

External (one-time import):
  Wger API → Import script → PostgreSQL (local exercise cache)
```

### Monorepo Structure

```
kak_fit/
├── apps/
│   ├── web/          # Next.js + tRPC server
│   └── mobile/       # Expo React Native
├── packages/
│   ├── db/           # Prisma schema + client
│   ├── api/          # tRPC routers + shared types
│   └── config/       # Shared ESLint/TS configs
└── docs/
    └── PROJECT_ROADMAP.md
```

---

## Exercise Database (Wger)

**Source:** [Wger API](https://wger.readthedocs.io/en/latest/api/api.html) — open source, self-hostable, free forever.

### Why Wger

- Open source & self-hostable
- REST API at `https://wger.de/api/v2/`
- Public endpoints (exercises, muscles, equipment, categories) — no auth required for read
- Exercise images, muscle groups, equipment, categories
- Workout/routine planning support in their data model

### Import Pipeline

```
Wger API
   ↓  (paginated fetch, rate-limit aware)
Import Script (Node.js cron / one-time CLI)
   ↓
PostgreSQL tables:
   - Exercise (name, instructions, wgerId)
   - Muscle, Equipment, Category (lookup tables)
   - ExerciseMuscle (primary/secondary)
   - ExerciseMedia (GIF/image URLs → optionally mirror to Supabase)
```

### Key Wger Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v2/exercise/` | Paginated exercise list |
| `GET /api/v2/exerciseinfo/` | Full exercise details + images |
| `GET /api/v2/muscle/` | Muscle groups |
| `GET /api/v2/equipment/` | Equipment types |
| `GET /api/v2/exercisecategory/` | Categories (strength, cardio, etc.) |
| `GET /api/v2/exerciseimage/` | Exercise images/GIFs |

### Import Notes

- Default page size is 20; use `?limit=100&offset=N` with `next`/`previous` pagination
- Rate limits apply on some endpoints — batch imports with delays
- Store `wgerId` on local exercises for sync/updates
- Allow users to create **custom exercises** alongside imported ones (Hevy parity)

---

## Hevy Competitive Research

### Product Overview

Hevy is a **free workout tracker** with an optional **Pro subscription**. It targets strength training enthusiasts who want logging, analytics, and a fitness social network. Available on **iOS, Android, Web, Apple Watch, and Wear OS**.

Sources: [Hevy Features](https://www.hevyapp.com/features/), [2025 Features Guide](https://help.hevyapp.com/hc/en-us/articles/33106320824727)

---

### Feature Inventory (Complete)

#### 1. Workout Logging

| Feature | Description | Priority for Kak Fit |
|---------|-------------|---------------------|
| Live workout session | Stopwatch, set completion, volume tracking | **MVP P0** |
| Empty workout | Build improvised session on the fly | **MVP P0** |
| Routine-based workout | Start from saved template | **MVP P0** |
| Set types | Normal, warm-up, drop set, failure | **MVP P1** |
| Supersets | Pair exercises, smart scrolling | Phase 2 |
| Weight + reps + time | Per-set logging (kg/lbs, reps/rep range, duration) | **MVP P0** |
| RPE tracking | Per-set RPE column (optional setting) | Phase 2 |
| Previous workout values | Show last performance (global or per-routine) | **MVP P0** |
| Copy previous set | Quick-fill from last set | **MVP P0** |
| Add/delete sets | Swipe to delete | **MVP P0** |
| Exercise notes | Per-exercise tips (routine vs session scope) | Phase 2 |
| Rest timer | Auto-start on set complete, per-exercise override | **MVP P1** |
| Plate calculator | Barbell plate math (Pro feature on Hevy) | Phase 3 |
| Warm-up calculator | Auto-generate warm-up sets (Pro) | Phase 3 |
| Live PR notifications | Instant PR popup on set complete | **MVP P1** |
| Finish workout screen | Name, photos/video, notes, privacy, shareables | **MVP P1** |
| Edit/delete past workouts | Full retroactive editing | **MVP P1** |
| Copy workout → new session | Alternative to routines | Phase 2 |
| Create routine from workout | Convert completed session to template | Phase 2 |
| Offline mode | Full offline logging, sync later | Phase 2 |

Source: [Log & Track Workouts](https://www.hevyapp.com/features/track-workouts/)

#### 2. Routine Builder

| Feature | Description | Priority |
|---------|-------------|----------|
| Create/edit routines | Name, exercises, sets, targets | **MVP P0** |
| Folders | Organize routines (Push/Pull/Legs) | **MVP P0** |
| Reorder exercises | Drag-and-drop | **MVP P0** |
| Duplicate routine | Clone template | **MVP P1** |
| Share routine (link) | External share via hevy.com link | Phase 3 |
| Share folder | Image + link export | Phase 3 |
| Program library | 26 pre-made programs, 8 categories | Phase 3 (curate our own) |
| Hevy Trainer | AI adaptive programming (Pro only) | Phase 5 |
| HevyGPT | ChatGPT plan builder (Pro) | Phase 5 |

Source: [Hevy Trainer](https://www.hevyapp.com/features/workout-plan-generator/)

#### 3. Exercise Library

| Feature | Description | Priority |
|---------|-------------|----------|
| 400+ built-in exercises | Name, instructions, muscle, equipment, GIF/video | **MVP P0** (via Wger) |
| Search + filters | By muscle, equipment, category | **MVP P0** |
| Custom exercises | User-created with primary/secondary muscle | **MVP P0** |
| Exercise performance page | Per-lift history, PRs, 1RM | **MVP P0** |
| Strength level benchmark | Beginner→Elite for squat/bench/deadlift | Phase 4 |

#### 4. Progress Tracking

| Feature | Description | Priority |
|---------|-------------|----------|
| Weight progression charts | Per exercise over time | **MVP P0** |
| Volume progression | Session + set volume | **MVP P0** |
| PR history | Max weight, reps, volume, duration, 1RM | **MVP P0** |
| Estimated 1RM | Calculated from sets | **MVP P1** |
| Set records table | Best weight per rep target | Phase 2 |
| Muscle distribution chart | Volume split by muscle (30d/3mo/yr/all) | Phase 2 |
| Set count per muscle group | Weekly/monthly graphs | Phase 2 |
| Main exercises overview | Most-logged movements | Phase 2 |
| Workout calendar | Full history, streak, multi-year zoom | **MVP P1** |
| Active streak | Consecutive weeks with ≥1 workout | **MVP P1** |
| Monthly report | Recap with PRs, volume, consistency | Phase 3 |
| Year in review | Annual summary + shareables | Phase 4 |

Source: [Track Gym Progress](https://www.hevyapp.com/features/gym-progress/)

#### 5. Body Measurements

| Feature | Description | Priority |
|---------|-------------|----------|
| Weight | Body weight logging | **MVP P0** |
| Body fat % | Optional field | **MVP P1** |
| 14 circumference measurements | Chest, waist, arms, etc. | Phase 2 |
| Progress photos | Upload, compare side-by-side | Phase 2 |
| Measurement history graphs | Trend over time | **MVP P1** |

Hevy gives **full body measurement access on free tier** — only graph history is limited to 3 months.

#### 6. Social Feed (Hevy's Retention Engine)

| Feature | Description | Priority |
|---------|-------------|----------|
| Home feed | Workouts from people you follow | **MVP P0** |
| Discover feed | Workouts from non-followed users | **MVP P1** |
| Like workouts | Engagement | **MVP P0** |
| Comment + reply | Threaded comments | **MVP P0** |
| Follow / unfollow | Social graph | **MVP P0** |
| Private profiles | Follow request required | Phase 2 |
| User profiles | Bio, stats, media, routines, workouts | **MVP P1** |
| Compare stats | Side-by-side with another user | Phase 3 |
| Leaderboards | 38 exercises ranked among friends | Phase 3 |
| Save others' workout as routine | Import from feed | Phase 2 |
| Copy others' workout | Start live session from their log | Phase 2 |
| Workout notifications | Push when specific user posts | Phase 3 |
| Invite friends | Share link, contacts | Phase 2 |
| Upload media with workout | Up to 3 photos or 2 photos + 1 video | **MVP P1** |
| Social shareables | Post-workout graphics (streak, PRs) | Phase 3 |
| Strava integration | Auto-sync workouts | Phase 4 |

Source: [Social Features](https://www.hevyapp.com/features/social-features/)

#### 7. Coach Mode (Hevy Coach — Separate Product)

| Feature | Description | Priority |
|---------|-------------|----------|
| Coach dashboard (web) | Program builder, client management | Phase 4 |
| Assign workouts to clients | Clients log in Hevy app | Phase 4 |
| In-app chat | Coach ↔ client messaging | Phase 4 |
| Track client measurements | Coach view of client body data | Phase 4 |
| Clients get free Pro | While coached on platform | Phase 4 |

Source: [Hevy Coach](https://hevycoach.com/personal-trainer/)

#### 8. Platform & Extras

| Feature | Hevy | Kak Fit Phase |
|---------|------|---------------|
| iOS + Android | ✅ | Phase 1 (Expo) |
| Web app | ✅ hevy.com | Phase 3 (Next.js web UI) |
| Apple Watch | ✅ | Phase 4 |
| Wear OS | ✅ | Phase 5 |
| Home screen widgets | ✅ | Phase 4 |
| Live Activity (iOS) | ✅ | Phase 4 |
| CSV export | Pro | Phase 3 |
| Cloud sync | Free | **MVP P0** |
| Dark/light theme | ✅ | Phase 2 |

---

### Hevy Pricing (Current)

| Tier | Price | Limits |
|------|-------|--------|
| **Free** | $0 | Unlimited workout logging; **4 routines**, **7 custom exercises**, **3 months** graph history; social + exercise library included |
| **Pro Monthly** | $2.99/mo | Unlimited routines, custom exercises, all-time history, warm-up calculator, Hevy Trainer, advanced analytics |
| **Pro Yearly** | $23.99/yr | Same as monthly |
| **Pro Lifetime** | $74.99 | One-time |

Source: [Hevy Pro Subscription](https://help.hevyapp.com/hc/en-us/articles/35119778922263)

---

## Essential MVP Features

These are the **minimum** to compete with Hevy at launch.

### 1. Authentication
- [ ] Email signup / login
- [ ] Google OAuth
- [ ] Session persistence on mobile
- [ ] Profile creation (name, avatar, bio)

### 2. Exercise Library
- [ ] Import exercises from Wger into PostgreSQL
- [ ] Exercise fields: name, instructions, primary muscle, secondary muscle, equipment, GIF/image
- [ ] Search and filter
- [ ] Custom exercise creation (with free-tier limit)

### 3. Workout Logger (Most Important Screen)
- [ ] Per set: weight, reps, time, notes
- [ ] Add set / delete set / copy previous set
- [ ] Mark set complete → optional rest timer
- [ ] Show previous workout values
- [ ] Finish workout → save to profile
- [ ] Start from routine OR empty workout

### 4. Routine Builder
- [ ] Create routines (Push Day, Pull Day, Leg Day, etc.)
- [ ] Folders for organization
- [ ] Add exercise, reorder, set targets
- [ ] Duplicate routine
- [ ] Free tier: 4 routines (match Hevy); Pro: unlimited

### 5. Progress Tracking
- [ ] Weight progression graph (per exercise)
- [ ] Volume progression graph
- [ ] PR history list
- [ ] Free tier: 3 months history; Pro: all-time

### 6. Personal Records
- [ ] Track: max weight, max reps, max volume per exercise
- [ ] Live PR notification on set complete
- [ ] PR highlight on workout summary

### 7. Body Measurements
- [ ] Weight, waist, chest, arms, body fat %
- [ ] Log entry with date
- [ ] Basic trend graph
- [ ] Pro: full measurement set + unlimited history

### 8. Social Feed
- [ ] Follow / unfollow users
- [ ] Home feed (followed users' workouts)
- [ ] Like workouts
- [ ] Comment on workouts
- [ ] Public profiles with workout history
- [ ] Upload workout photos

---

## Pricing Strategy

### Proposed Kak Fit Tiers

| Tier | Price (target) | Includes |
|------|----------------|----------|
| **Free** | $0 | Unlimited workout logging, social feed, exercise library, 4 routines, 7 custom exercises, 3-month graph history, basic measurements |
| **Pro** | **$1.99/mo** or **$17.99/yr** or **$49.99 lifetime** | Unlimited routines, unlimited custom exercises, all-time graph history, full body measurements, export, no ads |
| **Coach** | **$9.99/mo per coach** (Phase 4) | Client management, program assignment, chat, analytics |

**Positioning:** Undercut Hevy Pro by ~33% while matching or slightly beating free-tier limits.

---

## Research Observations & Recommendations

### What Makes Hevy Win

1. **Workout logger UX** — Previous values, set types, fast input. This is the daily touchpoint; it must feel instant.
2. **Social feed** — Accountability and discovery. Users stay because they see friends training.
3. **Progress graphs** — Visual proof of gains. Strong retention hook.
4. **Generous free tier** — Unlimited logging + social keeps users; limits hit power users on routines/history.
5. **Low Pro price** — $2.99/mo is hard to beat; we need to be even lower OR offer more on free.

### What Hevy Does NOT Emphasize (Our Opportunities)

- No meal/nutrition tracking (stay focused — good)
- No built-in music/podcast (out of scope)
- Coach product is expensive separate B2B play — we can enter later
- Web app is secondary to mobile — **we go mobile-first harder**
- Regional pricing gaps — price aggressively in India, SEA, LATAM

### Technical Recommendations

1. **tRPC end-to-end** — Eliminates API contract drift between Expo and Next.js
2. **Optimistic updates on workout logger** — Sets must feel instant even on slow gym WiFi
3. **Local SQLite on mobile (Phase 2)** — Offline workout logging with background sync
4. **Wger image mirroring** — Cache exercise GIFs in Supabase Storage; don't depend on wger.de uptime
5. **PR calculation as DB trigger or background job** — Recalculate on workout save, not on read
6. **Feed as cursor-paginated query** — `workouts WHERE userId IN (following) ORDER BY createdAt DESC`
7. **Better Auth** — Better Expo session story than NextAuth for mobile-first

### MVP Scope Guardrails (Do NOT build in Phase 1)

- Hevy Trainer / AI programming
- Apple Watch / Wear OS
- Strava integration
- Leaderboards
- Coach platform
- Monthly/Year in Review
- Plate calculator / warm-up calculator

---

## Phase-Wise Development Roadmap

### Phase 0 — Foundation (Weeks 1–2) 🚧 In Progress

- [x] Monorepo setup (Turborepo: `apps/web`, `apps/mobile`, `packages/db`, `packages/api`)
- [x] PostgreSQL + Prisma schema (users, exercises, workouts, social)
- [x] Next.js tRPC server scaffold (`/api/trpc` + health endpoint)
- [x] Expo app scaffold with tRPC client shell
- [ ] Better Auth setup (email + Google) — Phase 1
- [ ] Supabase Storage buckets configured — Phase 1
- [ ] CI: lint + typecheck on push — Phase 1

**Exit criteria:** Mobile app calls `health` tRPC endpoint; user can register and see empty home screen.

---

### Phase 1 — Core Workout Engine (Weeks 3–6)

**Goal:** A user can log a full workout without social features.

| Task | Details |
|------|---------|
| Wger import script | Import muscles, equipment, categories, exercises, images |
| Exercise library UI | Search, filter, exercise detail screen |
| Custom exercises | CRUD with free-tier limit (7) |
| Routine builder | Create, edit, reorder, folder organization |
| Workout logger | Empty + routine start, set logging, finish workout |
| Previous values | Show last performance per exercise |
| PR engine | Calculate and store PRs on workout save |
| Workout history | List + detail view on profile |

**Exit criteria:** Complete Push Day workout logged, PR detected, history visible.

---

### Phase 2 — Progress & Measurements (Weeks 7–9)

**Goal:** Retention through data visualization.

| Task | Details |
|------|---------|
| Exercise charts | Weight + volume over time (per exercise) |
| PR history screen | All PRs with dates and workout links |
| Body measurements | Weight, waist, chest, arms, body fat % |
| Measurement graphs | Trend lines |
| Workout calendar | Monthly view + active streak |
| Set types | Warm-up, drop, failure |
| Rest timer | Per-exercise auto timer |
| Edit past workouts | Full edit/delete |
| Offline mode v1 | Queue sets locally, sync on reconnect |

**Exit criteria:** 4-week training history shows progression charts; body weight trend visible.

---

### Phase 3 — Social Feed (Weeks 10–13)

**Goal:** Hevy's stickiness — community layer.

| Task | Details |
|------|---------|
| Follow system | Follow/unfollow, follower counts |
| Home feed | Paginated workouts from followed users |
| Discover feed | Public workouts from non-followed users |
| Likes | Like/unlike workouts |
| Comments | Create, reply, delete own comments |
| User profiles | Bio, avatar, workout list, stats summary |
| Workout media | Upload photos to Supabase on finish workout |
| Workout privacy | Public/private toggle |
| Notifications | Push: new follower, like, comment |
| Share workout summary | Basic shareable card (streak, PRs) |

**Exit criteria:** Two users follow each other, log workouts, like and comment.

---

### Phase 4 — Monetization & Pro (Weeks 14–16)

**Goal:** Revenue while staying cheaper than Hevy.

| Task | Details |
|------|---------|
| Subscription (RevenueCat or Stripe) | Monthly, yearly, lifetime |
| Free tier enforcement | 4 routines, 7 custom exercises, 3mo charts |
| Pro unlock | Unlimited routines/exercises/history |
| Profile settings | Units (kg/lbs), default rest timer, privacy |
| CSV export | Pro feature |
| Superset support | Pair exercises in routines/workouts |
| Copy/save others' workouts | From feed |

**Exit criteria:** Free user hits routine limit → upgrade prompt → Pro unlocks.

---

### Phase 5 — Growth Features (Weeks 17–22)

| Task | Details |
|------|---------|
| Web dashboard | Next.js web UI for routines + analytics |
| Leaderboards | Friend rankings on key lifts |
| Compare stats | Side-by-side user comparison |
| Routine sharing | Public links |
| Monthly report | Auto-generated recap |
| Plate calculator | Barbell math tool |
| Program library | Curated Push/Pull/Legs programs |

---

### Phase 6 — Coach Platform (Weeks 23–30)

| Task | Details |
|------|---------|
| Coach web dashboard | Client list, program builder |
| Assign routines | Push template to client |
| Client app view | "Assigned by coach" workouts |
| In-app messaging | Coach ↔ client chat |
| Client measurements view | Coach reads client body data |
| Coach billing | Separate Stripe plan |

---

### Phase 7 — Platform Expansion (Ongoing)

- Apple Watch companion
- Wear OS
- iOS widgets + Live Activity
- Strava integration
- AI workout suggestions (optional, post-PMF)
- Localization (Hindi, Spanish, Portuguese)

---

## Database Schema Overview

```prisma
// Core entities (packages/db/prisma/schema.prisma)

User          → id, email, name, avatarUrl, bio, isPrivate, subscriptionTier
Follow        → followerId, followingId
Exercise      → id, name, instructions, wgerId?, isCustom, userId?, categoryId
Muscle        → id, name, wgerId
Equipment     → id, name, wgerId
ExerciseMuscle → exerciseId, muscleId, isPrimary
Routine       → id, userId, name, folderId?
RoutineExercise → routineId, exerciseId, order, restSeconds
RoutineSet    → routineExerciseId, setNumber, targetWeight, targetReps, setType
Workout       → id, userId, name, startedAt, finishedAt, isPublic, notes
WorkoutExercise → workoutId, exerciseId, order
WorkoutSet    → workoutExerciseId, setNumber, weight, reps, duration, rpe, setType, isCompleted
PersonalRecord → userId, exerciseId, type (weight|reps|volume|1rm), value, workoutSetId, achievedAt
BodyMeasurement → userId, date, weight, bodyFat, waist, chest, arms, ...
Like          → userId, workoutId
Comment       → id, userId, workoutId, parentId?, content
Media         → workoutId, url, type (image|video)
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Wger API downtime / rate limits | Exercise library gaps | Mirror data locally; cache images in Supabase |
| Hevy copies our pricing | Commoditization | Move faster on regional pricing + community |
| Workout logger latency in gym | Bad UX | Optimistic UI + local queue |
| Social feed cold start | Empty feed | Seed discover feed; suggest users |
| App Store rejection | Launch delay | Follow Apple Health/fitness guidelines early |
| Scope creep (AI, watches) | Delayed MVP | Strict phase gates |

---

## References

- [Hevy App Features](https://www.hevyapp.com/features/)
- [Hevy 2025 Features Guide](https://help.hevyapp.com/hc/en-us/articles/33106320824727)
- [Hevy Social Features](https://www.hevyapp.com/features/social-features/)
- [Hevy Progress Tracking](https://www.hevyapp.com/features/gym-progress/)
- [Hevy Workout Logging](https://www.hevyapp.com/features/track-workouts/)
- [Hevy Pro Subscription](https://help.hevyapp.com/hc/en-us/articles/35119778922263)
- [Hevy Trainer](https://www.hevyapp.com/features/workout-plan-generator/)
- [Hevy Coach](https://hevycoach.com/personal-trainer/)
- [Wger API Documentation](https://wger.readthedocs.io/en/latest/api/api.html)
- [Strong vs Hevy 2026 Comparison](https://prpath.app/blog/strong-vs-hevy-2026.html)

---

*Last updated: June 20, 2026*
