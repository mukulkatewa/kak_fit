# Kak Fit

A mobile-first workout tracker — Hevy-style. **Core focus: logging + progress. Social comes later.**

> **Demo build: everything is free.** No paywall or subscription limits — all
> routines, custom exercises, and full history are unlocked.

## Stack

- **Mobile:** React Native + Expo Router + TypeScript (light + dark theme)
- **Backend:** Next.js + tRPC + TypeScript
- **Database:** PostgreSQL + Prisma (Supabase)
- **Auth:** Better Auth (Google OAuth + bearer tokens for mobile)
- **Exercise data:** Database-backed catalog with Wger/Hevy import scripts and exercise media
- **Nutrition:** USDA FoodData Central (food search + macro tracking)

## Docs

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Excalidraw drawing guide, system components, data model, and interview flows
- [docs/PROJECT_ROADMAP.md](./docs/PROJECT_ROADMAP.md) — competitive research and phased roadmap
- [docs/HEVY_COMPARISON.md](./docs/HEVY_COMPARISON.md) — current end-to-end feature comparison vs Hevy + gap backlog
- [docs/ENV_SETUP.md](./docs/ENV_SETUP.md) — environment variables and database setup
- [docs/REACT_NATIVE_REVIEW.md](./docs/REACT_NATIVE_REVIEW.md) — architecture review, remaining production work, and interview walkthrough

## Quick Start

```bash
# 1. Install
pnpm install

# 2. Start Postgres
pnpm docker:up

# 3. Setup env
cp .env.example .env
cp .env apps/web/.env.local

# 4. Database
pnpm db:generate
pnpm db:push
pnpm db:import      # Import the exercise catalog from Wger
pnpm db:seed        # Optional — checks for legacy demo user

# 5. Run API (terminal 1)
pnpm --filter @kak-fit/web dev

# 6. Run mobile (terminal 2)
pnpm --filter @kak-fit/mobile start
# Or web preview: pnpm --filter @kak-fit/mobile start --web
```

## Android emulator on Windows

For live React Native changes, run these in two VS Code PowerShell terminals
from the project root, with the emulator running:

```powershell
# Terminal 1: starts the local API and Metro; keep this open.
npm start
```

```powershell
# Terminal 2: open Kak Fit; builds/installs it if no debug app is installed.
npm run android
```

On Windows, `npm start` starts a missing local API, checks database/auth health,
warms the API router, starts Metro on 8081, and prepares the Android bundle.
The first bundle can take a while; wait for its `Ready: API +
database + Metro` message before running the Android command. Ctrl+C stops only
the child services that this invocation started. Existing healthy services are
reused; keep their original terminals open. `npm run dev:api` remains available
when you want to run the API separately.

If the debug app is already installed, `npm run android` restarts it directly
without Gradle. After native dependency/code changes, explicitly rebuild:

```powershell
npm run android -- --build
```

The mobile commands also work from `apps/mobile`. On Windows they set the local
API URL and connect emulator ports 3000 and 8081 automatically. Startup checks
the API health, database and authentication before opening Android. Launching
uses the native main activity, avoiding Expo's development-client deep link.
The debug app's Metro host is set to `127.0.0.1:8081`, using ADB reverse for the
bundle and Fast Refresh instead of the emulator's slower host bridge. Other
developer preferences are preserved.
`Network request failed` in tRPC logs means requests are failing: check the API
terminal and `http://127.0.0.1:3000/api/health` before rebuilding Android.
Use `npm.cmd` if PowerShell blocks `npm.ps1`. The pnpm `node-linker` warning from
npm is informational; keep the repository's pnpm configuration.

Wait for Metro to be ready on 8081 before running the Android command. Windows
explicitly uses that existing bundler; it does not start another server on 8082.
If API and Metro are already running for this project, `npm start` reports that
and exits successfully. If it starts a missing service, it stays open to own that
service. Open Kak Fit with the Android command; the Expo Go QR code is not needed.

The first Android command without an installed debug app compiles and installs
it. Then saving most UI/JavaScript/TypeScript changes updates it through Fast
Refresh. Later sessions
only need `npm start` and `npm run android`. `npm run android:open` is an optional
shortcut to bring the installed app forward without restarting it. Native changes
need `npm run android -- --build`; app-config/plugin changes also need prebuild
first. Routine successful tRPC requests are quiet; actual errors are still logged.
Set `EXPO_PUBLIC_TRPC_DEBUG=1` before starting Metro for detailed request logs.
The debug app uses the same package as the release demo. To restore the standalone demo:

```powershell
adb install -r .\results\kak-fit-emulator.apk
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\android-emulator.ps1
```

The following instructions describe the standalone release demo:

Kak Fit stays installed in the same Android Virtual Device after closing the app,
Android Studio, or Windows. To show the installed app again, start that emulator
and run these commands from the project root:

```powershell
# Terminal 1: keep this running during the interview.
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-api-windows.ps1
```

```powershell
# Terminal 2: reconnect the local API and open the installed app.
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\android-emulator.ps1
```

After reconnecting, you can close Terminal 2 and open Kak Fit from its app icon.
The installed APK includes its JavaScript; Metro and another build are unnecessary.
Use the build steps below only for the first installation or after code changes.

Start an Android emulator in Android Studio, install dependencies with
`pnpm install --frozen-lockfile`, then run this from the project root in PowerShell:

```powershell
# Terminal 1: run the API using apps/web/.env.local and keep it open.
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-api-windows.ps1

# Terminal 2: generate Android configuration after installing dependencies.
Push-Location .\apps\mobile
try {
  node ..\..\node_modules\expo\bin\cli prebuild --platform android --no-install
} finally { Pop-Location }

# Build a standalone APK, install it, and open Kak Fit.
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\android-emulator.ps1 -Build

# Open the installed app again; no build or Metro server is needed.
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\android-emulator.ps1
```

The build uses `http://localhost:3000` and forwards the emulator's port 3000 to
your computer with ADB. Keep the local API running during the demo; Metro is not
needed. Localhost HTTP is permitted by the Android network configuration.
Pass `-ApiUrl https://your-api.example.com` to build against another backend. Set
`ANDROID_HOME` to your Android SDK and `JAVA_HOME` to JDK 17, and ensure `adb.exe`
and Node.js are on your PATH. The first build downloads Android dependencies.
The resulting APK is saved as `results/kak-fit-emulator.apk` for the running
emulator's architecture. Sign in with Google inside the emulator before your demo.

## Sign in

Use **Continue with Google** on the login screen. Set `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` in `.env` (see [docs/ENV_SETUP.md](./docs/ENV_SETUP.md)).

## Features (Live)

- Google sign-in, persistent mobile sessions
- Searchable exercise library + per-exercise detail & charts
- Routine builder (create, duplicate, delete) + program/category templates
- Workout logger (empty / from routine, set types, rest timer, previous values, copy set)
- Personal records (auto-detected on finish) + workout history & read-only detail view
- Progress: volume / duration / reps charts, streak, muscle heatmap, PRs
- Nutrition: USDA food search, meal logging, daily calorie + macro rings
- Body measurements (log + weight trend)
- Light + dark theme (system default, manual toggle in Settings)

See [docs/HEVY_COMPARISON.md](./docs/HEVY_COMPARISON.md) for the full feature matrix and what's next.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `http://localhost:3000` | API status page |
| `/api/auth/*` | Better Auth routes |
| `/api/trpc` | tRPC API (used by mobile) |

## Monorepo

```
apps/
  web/      → Next.js API server
  mobile/   → Expo React Native app
packages/
  db/       → Prisma schema + import scripts
  api/      → Shared tRPC routers
```
