# Kak Fit — Features, Bugs & Roadmap

> Working doc for our dev sessions. Update this as we ship things.
> _Last updated: June 24, 2026 · v0.2.0_

---

## What We Have Right Now

### Auth & Account
- Email sign-up / sign-in (Better Auth)
- Bearer token sessions on mobile
- Profile name + bio edit
- Settings: theme (system/light/dark), weight unit (kg/lbs), default rest timer
- Version shown as `v0.2.0 · Free` in settings

### Workout Engine
- Start empty workout or from a routine
- Add/remove exercises, reorder via drag-and-drop
- Supersets
- Sets with weight, reps, RPE (1–10), set type (Normal / Warmup / Drop / Failure)
- Auto-fill previous values per exercise
- Rest timer with notification + auto-start
- Finish workout (saves PR, fills previous-set cache)
- Cancel or discard active workout
- Edit completed workouts (change weight/reps/notes)
- Repeat a past workout, create routine from it
- Progress photos attached to a workout (requires Supabase storage)

### Routines
- Create, edit, delete routines
- Folders (create / rename / delete, move routines)
- Duplicate routine
- Reorder exercises in routine builder
- Share routine via link (`/routine/share/[token]`)
- Import shared routine
- Static explore programs (curated, not user-generated)
- Import program (saves all its routines at once)
- Browse by category

### Exercise Library
- 858 exercises imported from Wger (muscles, equipment, category, instructions)
- Search + filter by muscle group
- Custom exercises (create with muscle targeting)
- Exercise detail: weight chart, PRs, previous performance history

### Progress & Analytics
- Personal records (by type: weight, reps, volume, 1RM)
- Volume history chart (week/month/3-month/year)
- Weekly volume bar chart on dashboard
- Muscle heatmap (volume by muscle group)
- Workout calendar
- Top exercises
- Streak tracking
- Body measurements (weight, body fat %, waist, chest, arms) + trend charts
- Progress photo gallery + side-by-side before/after compare

### Nutrition
- USDA FoodData Central food search
- Log meals by type (breakfast / lunch / dinner / snack)
- Daily macro summary rings (calories, protein, carbs, fat)
- Custom foods CRUD
- Nutrition goals (calorie + macro targets)
- Full daily summary

### Developer API (Hevy-style)
- Personal REST API at `/api/v1`
- Auth via `api-key: kak_…` header
- API key management in Settings → Developer API (max 5 keys, create/revoke)
- Key prefix + last-used tracking
- Endpoints: workouts, routines, exercises, body measurements, personal records
- HTML docs at `/api/v1/docs`
- LLM tool definitions at `/api/v1/llm-tools` (JSON, structured for Gemini/Claude/GPT)
- System prompt generated for Gemini with step-by-step flow
- In beta: Pro gate disabled (`DEVELOPER_API_REQUIRE_PRO` off)

### Tools
- Plate calculator
- Warm-up set generator

### Infrastructure
- Turborepo monorepo (mobile + web + api + db packages)
- Expo Router (iOS, Android, web)
- tRPC for type-safe mobile ↔ server calls
- Prisma + Postgres
- Vercel deployment (web exports mobile SPA)
- Offline workout queue scaffolded (SQLite, partial)

---

## Known Bugs

### High Priority
1. **Offline mode is incomplete** — `offline-workouts.ts` only queues `updateSet`, `updateExerciseNotes`, `finishWorkout`. No queue for start, add exercise, delete set. Web has a stub that does nothing. If network drops mid-workout you lose data.
2. **Progress photos fail silently** — `storageEnabled` check returns false when no Supabase/S3 env vars; upload button just does nothing with no user feedback.
3. **`docsUrl` tRPC proc uses wrong env var** — `process.env.BETTER_AUTH_URL` is used as base URL in developer router but on mobile the API URL is `EXPO_PUBLIC_API_URL`. The docs link shown in the developer API screen is derived from `getApiUrl()` client-side which is correct, but `docsUrl` procedure returns wrong URL if `BETTER_AUTH_URL` is not set.

### Medium Priority
4. **Hardcoded placeholder color in Developer API screen** — `placeholderTextColor="#6b7280"` in `developer-api.tsx` doesn't use theme tokens, breaks on light theme (too dark).
5. **Dashboard social placeholders** — Followers: 0, Following: 0 are hardcoded. Pressing them does nothing. Should be hidden until social is built.
6. **Copy in Developer API screen uses Share sheet** — `developer-api.tsx` uses `Share.share({ message: value })` for copying the base URL and docs link. On mobile this opens the OS share sheet instead of just copying to clipboard. Should use `expo-clipboard` (not currently installed).
7. **LLM tools array is incomplete** — `/api/v1/llm-tools` only lists 8 of 20+ API endpoints. Missing: `delete_exercise_from_routine`, `create_routine`, `delete_routine`, `get_workout`, `update_workout`, `list_body_measurements`, `list_personal_records`. An LLM that reads this endpoint won't know about all the things it can do.
8. **No Claude or ChatGPT system prompt** — `llm-tools.ts` only has a `gemini_system_prompt`. Claude and ChatGPT users have to figure out the auth/flow on their own. Should add `claude_system_prompt` and `openai_system_prompt` variants.
9. **Version string hardcoded** — `v0.2.0 · Free` in `settings.tsx` line 164 is a static string. Won't update automatically.
10. **Free-tier limits not enforced** — Schema and env var exist (`subscriptionTier`, `DEVELOPER_API_REQUIRE_PRO`) but limits (4 routines, 7 custom exercises, 3-month history) are not enforced in any router. Everything is effectively Pro for all users.

### Low Priority
11. **DESIGN_SYSTEM.md is stale** — References screens that have moved or been renamed. Not a bug but causes confusion.
12. **`SubscriptionTier` on User model but no billing flow** — Stripe is in ENV_SETUP but no payment screen, webhook, or upgrade prompt exists anywhere.
13. **No OpenAPI JSON spec** — `/api/v1/docs` returns an HTML page (well-formatted, lists all routes). But Hevy has a full Swagger/OAS 3.0 spec. We need a machine-readable `/api/v1/openapi.json` for Postman, code-gen, and structured LLM tool use.

---

## Hevy Pro Feature Comparison

> Hevy Pro: ~$10/month. Their API is the main pro differentiator for power users.

| Feature | Hevy | Kak Fit | Gap |
|---------|------|---------|-----|
| Workout logging | Best-in-class | Parity (RPE, set types, rest timer, supersets) | ✅ None |
| Edit past workouts | ✅ | ✅ | ✅ None |
| Routines + folders | ✅ | ✅ | ✅ None |
| Share routines | ✅ | ✅ | ✅ None |
| Exercise library | 400+ | 858 (Wger) + custom | ✅ Better |
| PRs + 1RM estimates | ✅ | ✅ | ✅ None |
| Progress charts | Volume, frequency | Volume, PRs, muscle heatmap, calendar | ✅ Parity |
| Muscle heatmap | ✅ | ✅ | ✅ None |
| Body measurements | 14+ fields | 5 fields | 🟡 Need more fields |
| Progress photos | ✅ | ✅ + compare screen | ✅ Better |
| Nutrition tracking | ❌ | ✅ Full USDA + macros | ➕ We win |
| **Developer REST API** | **✅ Pro only** | **✅ Implemented** | 🟡 Minor gaps (see below) |
| **LLM / AI integration** | **❌ None** | **✅ LLM tools JSON + system prompt** | ➕ We win |
| Hevy Trainer (AI coach) | ✅ Pro | 🔲 Not built | 🔴 Big gap |
| Warm-up / plate calculator | ✅ Pro | ✅ | ✅ None |
| CSV export | ✅ Pro | 🔲 | 🟡 Missing |
| Offline logging | ✅ Full | 🟡 Scaffold only | 🔴 Real gap |
| Social feed + follow | ✅ | 🔲 DB only | 🔴 Phase 5 |
| Apple Watch | ✅ | 🔲 | 🔴 Big effort |
| Wear OS | ✅ | 🔲 | 🔴 Big effort |
| Monthly / year-in-review | ✅ | 🔲 | 🟡 Missing |
| Strength benchmarks | ✅ Pro charts | 🔲 | 🟡 Missing |
| Advanced analytics report | 🟡 | 🔲 | 🟡 Missing |
| Multiple workout/day log | ✅ | ✅ | ✅ None |
| Curated programs (26) | ✅ 26 | Static templates | 🟡 Need more |
| OpenAPI / Swagger spec | ✅ | 🟡 HTML only | 🟡 Missing |

---

## Developer API Deep Dive

### How Hevy Does It
Hevy gives Pro users an API key from their web settings. With that key + their public REST API (`api.hevyapp.com`) you can:
- Read all your workouts and routines
- Create new workouts (log via script/bot)
- Edit routines programmatically
- Pull exercise history for an exercise
- Read body measurements

Power users then paste their API key into ChatGPT, Claude, or Gemini with a custom system prompt describing the API. They use natural language to manage their programs — "add Romanian deadlifts 3x12 to Leg Day", "show me my bench press progress", "create a new Push routine with 5 exercises".

### How We've Done It
We have almost full parity with Hevy's API surface, plus extras:

**What works:**
- `GET/POST /workouts`, `GET/PUT /workouts/{id}`
- `GET /workouts/count`, `GET /workouts/events` (sync events with `?since=`)
- `GET/POST /routines`, `GET/PUT /routines/{id}` (no DELETE yet)
- `POST/PATCH/DELETE /routines/{id}/exercises` and sets
- `GET /routine_folders`, `POST /routine_folders` (no update/delete)
- `GET/POST /exercise_templates`, search, get by ID
- `GET /exercise_history/{id}`
- `GET /personal_records`
- `GET/POST/PUT /body_measurements`
- `GET /user/info`

**We have that Hevy doesn't:**
- `/api/v1/llm-tools` — returns a structured JSON object with tool definitions, descriptions, body examples, and a ready-made Gemini system prompt. User copies this into any LLM to immediately get API access.
- Personal records as a dedicated endpoint
- Nutrition data (not exposed via API yet but exists in tRPC)

**Where we exceed Hevy's API:**
- `DELETE /routines/{id}` ✅ — Hevy doesn't have this
- `PUT/DELETE /routine_folders/{id}` ✅ — Hevy doesn't have these
- `GET /routines/search?q=` ✅ — Hevy doesn't have search
- `GET /exercise_templates/search?q=` ✅ — Hevy doesn't have search
- `POST/PATCH/DELETE /routines/{id}/exercises` ✅ — Hevy only has full routine PUT (replace all exercises)
- `GET /personal_records` ✅ — Hevy has no dedicated PR endpoint

**Gaps vs Hevy API:**
- HTML docs only, no OpenAPI JSON spec — Hevy has full Swagger/OAS 3.0
- No Swagger UI
- No official SDK or Postman collection
- LLM tools endpoint is incomplete and Gemini-only

---

## What We Should Build Next (Priority Order)

### Quick Wins (1–2 days each)
1. **Fix placeholder color in Developer API screen** — use theme token
2. **Hide social placeholders** on dashboard until social ships
3. **Add `DELETE /routines/{id}` to REST API** — one-liner in handlers
4. **Add `PUT/DELETE /routine_folders/{id}` to REST API**
5. **OpenAPI JSON spec at `/api/v1/openapi.json`** — generate from existing handler types
6. **Fix progress photo error feedback** — show "storage not configured" message instead of silent fail
7. **More body measurement fields** — hips, thighs, shoulders, forearms, calves, neck (Hevy has 14+)

### Medium Work (1 week each)
8. **CSV export** — workouts and measurements as downloadable CSV. Hevy Pro feature.
9. **Monthly / year-in-review report** — charts summary of the month: total volume, workouts, PRs, muscle focus. Shareable screenshot.
10. **Full offline workout logging** — queue all workout mutations (start, add exercise, delete set, reorder) not just set updates. Sync on reconnect.
11. **AI coach / Hevy Trainer equivalent** — in-app screen where user types natural language and we hit the LLM API with the `/api/v1/llm-tools` system prompt + their key. No need to leave the app.

### Larger Features
12. **Strength benchmarks** — per-exercise strength standards (beginner / novice / intermediate / advanced / elite) by bodyweight. Show where user ranks.
13. **Advanced analytics** — personal volume records (best week/month), frequency heatmap, muscle balance analysis
14. **Billing + Pro tier** — Stripe webhook, upgrade screen, enforce limits. Required before public launch.
15. **Social** — feed, follow, like, comment. Already in DB schema.
16. **Apple Watch / Wear OS** — separate React Native Watch app. Biggest engineering effort.

---

## LLM Integration Vision (Expand on Current)

We already have:
- `/api/v1/llm-tools` returns JSON tool definitions
- Gemini system prompt in `llm-tools.ts`
- Developer API screen explains "Give it to Gemini to edit programs"

What we should add:
- **In-app AI assistant screen** — text box, user types "add squats to leg day", we call their preferred LLM (OpenAI / Gemini / Claude via their own API key or ours), LLM uses our `/api/v1` tools, we show the result
- **Claude + ChatGPT prompt templates** — not just Gemini. Each LLM needs slightly different formatting
- **LLM tool definitions as OpenAPI** — so Claude/Anthropic tool_use format works natively
- **Workout analysis prompt** — "analyze my last month of workouts and suggest improvements"
- **Program generation** — "I want to build strength for powerlifting, 4 days/week, create me a routine"

---

## Session Notes

> Add notes here as we work

- [ ] Fix placeholder color bug in developer-api.tsx
- [ ] Add DELETE /routines/{id} to REST API
- [ ] Add OpenAPI spec
- [ ] Add more body measurement fields
- [ ] Build in-app AI assistant screen
