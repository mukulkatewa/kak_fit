# Environment Variables — Complete Setup Guide

Copy `.env.example` to `.env` at the project root, then fill in each section below.

```bash
cp .env.example .env
cp .env apps/web/.env.local   # Next.js reads from here
```

---

## Required for Local Development

These are the **minimum** to run the app locally.

### 1. Database

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kak_fit?schema=public"
```

| Field | What to paste |
|-------|---------------|
| `postgres` (user) | Your Postgres username |
| `postgres` (password) | Your Postgres password |
| `localhost:5432` | Host:port — use Docker default or your VPS IP |
| `kak_fit` | Database name |

**Local:** Run `pnpm docker:up` — uses the values above as-is.

**Production (VPS):** Replace with your server connection string. Example:
```env
DATABASE_URL="postgresql://kakfit:STRONG_PASSWORD@db.yourserver.com:5432/kak_fit?schema=public&sslmode=require"
```

---

### 2. Auth (Better Auth)

```env
BETTER_AUTH_SECRET="your-32-char-random-secret-here-minimum"
BETTER_AUTH_URL="http://localhost:3000"
```

| Variable | How to get it |
|----------|---------------|
| `BETTER_AUTH_SECRET` | Run: `openssl rand -base64 32` — paste output |
| `BETTER_AUTH_URL` | Local: `http://localhost:3000` · Prod: `https://api.kakfit.app` |

**Production example:**
```env
BETTER_AUTH_SECRET="xK9mP2vL8nQ4wR7tY1uI0oA3sD6fG5hJ"
BETTER_AUTH_URL="https://api.kakfit.app"
```

---

### 3. Mobile App

```env
EXPO_PUBLIC_API_URL="http://localhost:3000"
```

| Environment | Value |
|-------------|-------|
| Local (simulator) | `http://localhost:3000` |
| Local (physical device) | `http://YOUR_LAN_IP:3000` (e.g. `http://192.168.1.42:3000`) |
| Production | `https://api.kakfit.app` |

Find your LAN IP: `ip addr` or `ifconfig`.

---

## Physical Device Setup

When running the Expo app on a **real phone or tablet** (Expo Go or a dev build), `localhost` on the device refers to the phone itself — not your computer. If `EXPO_PUBLIC_API_URL` is missing or left at `http://localhost:3000`, **every API call fails** and screens may show empty states (“No routines yet”, etc.) even though you have data.

### Required

Set `EXPO_PUBLIC_API_URL` to a URL your phone can reach:

| Scenario | `EXPO_PUBLIC_API_URL` |
|----------|------------------------|
| API on your Mac/PC (same Wi‑Fi) | `http://YOUR_LAN_IP:3000` (e.g. `http://192.168.1.100:3000`) |
| Deployed API (Vercel, VPS, etc.) | `https://your-app.vercel.app` |

Add to the project root `.env` (and restart Expo after changing):

```env
EXPO_PUBLIC_API_URL=https://your-vercel-app.vercel.app
```

For local dev against your machine, use your LAN IP instead:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

### Find your LAN IP

- **macOS:** `ifconfig | grep "inet 192"` (or check System Settings → Network)
- **Linux:** `ip addr` or `hostname -I`
- **Windows:** `ipconfig` — look for IPv4 under your Wi‑Fi adapter

Ensure the phone and computer are on the same network, and that your firewall allows inbound connections on port `3000` if you use a LAN URL.

In dev builds, a yellow banner appears at the top if the app cannot reach the configured API URL.

---

### 4. Server Port

```env
PORT=3000
```

Leave as `3000` unless your host requires another port.

---

## Required for Production

### 5. USDA FoodData Central (Nutrition — Free)

```env
USDA_API_KEY="your-usda-api-key"
```

**How to get (free, takes 2 minutes):**
1. Go to https://fdc.nal.usda.gov/api-key-signup.html
2. Enter your email
3. Check inbox — paste the API key

No usage fees. Rate limit: ~1,000 requests/hour (more than enough with local food cache).

---

## Optional — Enable When Ready

### 6. Google OAuth (Sign in with Google) — Required

```env
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

**How to get (free):**
1. https://console.cloud.google.com → Create project
2. APIs & Services → **OAuth consent screen** → External → add test users while in Testing
3. APIs & Services → **Credentials** → Create OAuth 2.0 Client ID → Web application
4. **Authorized redirect URIs:**
   - `https://api.kakfit.app/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google`
5. Paste Client ID and Client Secret into `.env`

**Publish for all users:** OAuth consent screen → **Publish app** (see end of this section).

Leave empty only if you are not running auth locally — the API will log a missing-env warning.

---

### 7. File Storage (Profile pics, workout photos)

**Option A — Self-hosted MinIO (recommended, $0)**

```env
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="kak-fit"
S3_REGION="us-east-1"
S3_PUBLIC_URL="http://localhost:9000/kak-fit"
```

Run MinIO via Docker (we'll add `docker-compose` service in Phase 2).

**Option B — Supabase (recommended for production)**

Use Supabase for **Postgres + Storage** in one place.

```env
SUPABASE_PROJECT_REF="your-project-ref"
SUPABASE_DB_PASSWORD="your-database-password"
SUPABASE_POOLER_HOST="aws-1-ap-northeast-1.pooler.supabase.com"
# Auto-written by `pnpm sync:ip` from the above (Prisma + Supabase pattern):
# Runtime uses the SESSION pooler (:5432) — the API is a long-lived server, so a
# persistent connection is 3-5x faster than the transaction pooler (:6543).
DATABASE_URL="postgresql://postgres.REF:PASSWORD@HOST:5432/postgres?schema=public&sslmode=require&connection_limit=5"
DIRECT_URL="postgresql://postgres.REF:PASSWORD@HOST:5432/postgres?schema=public&sslmode=require"
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGci..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."
```

| Variable | Where to get it |
|----------|-----------------|
| `SUPABASE_DB_PASSWORD` | Dashboard → Project Settings → **Database** → Database password |
| `SUPABASE_POOLER_HOST` | Dashboard → **Connect** → **ORMs** → **Prisma** (host in connection string) |
| `DATABASE_URL` / `DIRECT_URL` | Auto-built by `sync:ip` — `DIRECT_URL` always uses the session pooler. If `DATABASE_URL` is Prisma Accelerate (`prisma://` or `accelerate.prisma-data.net`), `sync:ip` updates **only** `DIRECT_URL`. |

> **`prisma db push` / migrations** use `DIRECT_URL`. Do **not** point `DIRECT_URL` at
> `db.<ref>.supabase.co` — that direct host often fails with `P1001 Can't reach database server`.
> Use the pooler host from Dashboard → Connect → Prisma (e.g. `aws-0-ap-south-1.pooler.supabase.com:5432`).

> **Latency tip:** request speed is dominated by the database region. If the API
> feels slow, host the Supabase project in the region closest to you (e.g.
> `ap-south-1` / Mumbai) or use local Docker Postgres for development.

### Moving the database to a closer region (e.g. Tokyo → Mumbai)

Supabase **cannot change a project's region** after creation — you create a new
project in the target region and repoint the app.

1. **Create a new project** at [supabase.com](https://supabase.com) → Region:
   **South Asia (Mumbai) `ap-south-1`**. Set a DB password.
2. **Copy the new credentials** into `.env` (only these change):
   - `SUPABASE_PROJECT_REF` — the new project ref
   - `SUPABASE_DB_PASSWORD` — the new password
   - `SUPABASE_POOLER_HOST` — from Dashboard → **Connect → ORMs → Prisma**
     (looks like `aws-0-ap-south-1.pooler.supabase.com`)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY` — from Dashboard → **Settings → API**
3. **Rebuild env + schema + data:**
   ```bash
   pnpm sync:ip          # rewrites DATABASE_URL/DIRECT_URL to the new host
   pnpm db:push          # creates the schema
   pnpm db:import        # re-imports the 855 Wger exercises
   pnpm db:seed          # recreates the demo user
   ```
4. **(Optional) keep existing user data** instead of re-seeding — copy old → new:
   ```bash
   pg_dump "OLD_DIRECT_URL" --data-only --no-owner > data.sql
   psql "NEW_DIRECT_URL" < data.sql
   ```
5. **Storage:** the `progress-photos` bucket auto-creates on the first upload to
   the new project; existing photos are not migrated automatically. Exercise
   catalog media imports into `SUPABASE_EXERCISE_MEDIA_BUCKET` when set, then
   `SUPABASE_IMAGE_BUCKET`, falling back to `SUPABASE_STORAGE_BUCKET`.
6. Restart the API (`pnpm dev:api`). Expect every request to drop by ~70%.
| `SUPABASE_PROJECT_REF` | Subdomain in your project URL (`https://REF.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_*` | Dashboard → Project Settings → **API** (use the `anon` JWT key, not `sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Same API page (server-only, never ship to mobile) |

When `SUPABASE_DB_PASSWORD` and `SUPABASE_POOLER_HOST` are set, `pnpm sync:ip` writes both Prisma URLs. Then run:

```bash
pnpm sync:ip
pnpm db:push
pnpm db:seed    # optional demo user
```

---

### 8. Payments (When you launch Pro tier)

```env
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRO_MONTHLY_PRICE_ID="price_..."
STRIPE_PRO_YEARLY_PRICE_ID="price_..."
```

**How to get:**
1. https://dashboard.stripe.com → Developers → API keys
2. Create Products → Pro Monthly ($1.99) and Pro Yearly ($17.99)
3. Copy Price IDs

Use `sk_test_...` keys during development. Leave empty until Phase 3 monetization.

---

### 9. Push Notifications (Phase 3+)

```env
EXPO_ACCESS_TOKEN=""
```

Get from: https://expo.dev → Account → Access Tokens. Free for reasonable volume.

---

## Production Checklist

```bash
# 1. Copy and fill .env
cp .env.example .env
# Fill: DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, EXPO_PUBLIC_API_URL, USDA_API_KEY

# 2. Copy to Next.js
cp .env apps/web/.env.local

# 3. Database
pnpm docker:up          # or point DATABASE_URL to your VPS Postgres
pnpm db:push
pnpm db:import          # Wger exercises (uses session pooler automatically)
pnpm db:count           # Quick check: users + exercise count
pnpm db:seed            # Demo user (skip in prod)

# 4. Build & run
pnpm --filter @kak-fit/web build
pnpm --filter @kak-fit/web start

# 5. Mobile — set production API URL
EXPO_PUBLIC_API_URL=https://api.kakfit.app pnpm --filter @kak-fit/mobile start
```

---

## Quick Reference — What You Need Right Now

| Variable | Required now? | Where to get |
|----------|---------------|--------------|
| `DATABASE_URL` | ✅ Yes | Docker default or your Postgres |
| `BETTER_AUTH_SECRET` | ✅ Yes | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | ✅ Yes | `http://localhost:3000` |
| `EXPO_PUBLIC_API_URL` | ✅ Yes | `http://localhost:3000` or LAN IP |
| `USDA_API_KEY` | ✅ For nutrition | fdc.nal.usda.gov (free) |
| `GOOGLE_CLIENT_ID` | ❌ Optional | Google Cloud Console |
| `S3_*` / Supabase | ❌ Phase 2 | MinIO Docker or Supabase |
| `STRIPE_*` | ❌ Phase 3 | Stripe Dashboard |

---

*Paste your values into `.env` and `.env` is gitignored — never commit secrets.*
