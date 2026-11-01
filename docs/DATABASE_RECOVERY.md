# Fresh Supabase recovery

## Current architecture

The Expo mobile app calls the Next.js API over tRPC. Better Auth handles Google
login and stores its users and sessions in PostgreSQL through Prisma. Supabase
provides PostgreSQL and Storage; Supabase Auth is not the app's login provider.

The existing local configuration uses Prisma Accelerate for runtime database
queries and a Supabase session pooler for schema operations. Mobile targets a
deployed Vercel API. All three destinations must agree after replacement.

## Provision and connect

1. Create a new Supabase project in the intended organization and region.
   Keep the old project intact. A fresh project does not recover old accounts,
   workouts, routines, or photos.
2. Copy the new project's session pooler connection string from **Connect**.
   Use its actual host, project reference, and URL-encoded database password.
   For the local API, use this PostgreSQL URL as `DATABASE_URL` and `DIRECT_URL`.
   Do not retain an Accelerate URL linked to the old database. Clear
   `PRISMA_ACCELERATE_URL` for this direct local setup.
3. Update the root `.env` Supabase reference, password, pooler host, project URL,
   and server storage key. Keep secrets in ignored environment files.
   `scripts/sync-ip.sh` URL-encodes the raw password and copies server settings
   to `apps/web/.env.local`. It preserves existing Accelerate URLs, so replace
   both `DATABASE_URL` and `PRISMA_ACCELERATE_URL` during a project cutover.
   Set `SYNC_LAN_IP=false` to preserve explicit local API and OAuth URLs.
4. Disable the Supabase Data API if only Prisma accesses application tables.
   Application authorization is enforced by the Next.js API; these tables must
   not become independently accessible through an unprotected Data API.
5. Preserve the existing Google OAuth credentials. Choose the API URL before
   configuring its callback at `/api/auth/callback/google`. Mobile must reach
   that API; it does not connect directly to PostgreSQL.

See the [Supabase Prisma guide](https://supabase.com/docs/guides/database/prisma)
for pooler and Data API guidance. This repository uses Prisma 6; do not copy
Prisma 7 configuration examples into it unchanged.

## Initialize the empty database

Verify the target project before running these commands:

```bash
pnpm db:generate
pnpm db:push
pnpm --filter @kak-fit/db db:bootstrap
pnpm db:import
pnpm db:count
```

The migration history contains incremental changes without the initial table
creation migration. `pnpm db:migrate` cannot initialize an empty database.
For this recovery, `db:push` creates the current Prisma schema. The bootstrap
command enables RLS on all public tables in this dedicated project and creates
the historical custom partial index `Workout_userId_active_idx`. Neither command
baselines the migration history. Repair/baseline migration history separately before
using migration deployment for future releases.

`db:import` imports the current Wger catalog; the historical count in the README
is not a guarantee. Hevy data and hosted exercise media need their own imports.
`db:seed` only checks for a legacy demo account. Sign in with Google to create
an account, then create a routine and complete a workout to verify persistence.

## Verify before UI work

- The local API health endpoint returns HTTP 200 with `db: connected`; a failed
  database query returns HTTP 503 with `db: unavailable`.
- Google sign-in creates a user and a session in the new database.
- Exercises load; a workout can be started, logged, finished, and reopened.
- A progress photo uploads into the new project's Storage bucket.
- Restarting the app retains the session and saved workout.

If mobile continues to use Vercel, update that API's deployment environment too;
local environment changes do not update a deployed server. If using the local
API from an Android emulator, configure emulator networking and a compatible
OAuth callback first. UI review follows successful backend recovery.

## Current local setup

The replacement project is `gcaiqnazgefmzyqhetws`, using the Mumbai session
pooler. Both Prisma URLs target the new project and Accelerate is disabled.
The local API and mobile configuration use `http://localhost:3000` with
`SYNC_LAN_IP=false`. The deployed Vercel environment is a separate configuration.

Start the API with `pnpm dev:api`. For the Android emulator, once Android SDK
platform tools are installed and an emulator is running, run:

```bash
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081
```

Google Cloud must allow `http://localhost:3000/api/auth/callback/google` as an
authorized redirect URI. OAuth initiation was verified; completing Google
sign-in requires the user's browser session.

For credential rotation, change `SUPABASE_DB_PASSWORD` to the new raw password
and `SUPABASE_SERVICE_ROLE_KEY` to the new secret key in the root `.env`, run
`pnpm sync:ip`, and restart the API. Do not paste passwords into shell commands.
Run `node --test scripts/sync-ip.test.cjs` to check environment synchronization.
