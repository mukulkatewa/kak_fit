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

### 6. Google OAuth (Sign in with Google)

```env
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

**How to get (free):**
1. https://console.cloud.google.com → Create project
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Application type: Web application
4. Authorized redirect URIs: `https://api.kakfit.app/api/auth/callback/google`
5. Paste Client ID and Client Secret

Leave empty to use email-only auth (works fine for launch).

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
DATABASE_URL="postgresql://postgres.REF:PASSWORD@HOST:6543/postgres?pgbouncer=true&schema=public&sslmode=require"
DIRECT_URL="postgresql://postgres.REF:PASSWORD@HOST:5432/postgres?schema=public&sslmode=require"
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGci..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."
```

| Variable | Where to get it |
|----------|-----------------|
| `SUPABASE_DB_PASSWORD` | Dashboard → Project Settings → **Database** → Database password |
| `SUPABASE_POOLER_HOST` | Dashboard → **Connect** → **ORMs** → **Prisma** (host in connection string) |
| `DATABASE_URL` / `DIRECT_URL` | Auto-built by `sync:ip` — transaction pooler `:6543` + session pooler `:5432` |
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
pnpm db:import          # Wger exercises
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
