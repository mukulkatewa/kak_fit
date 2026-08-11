# kak_fit — Deploy config for /ship

_Drafted from scripts/ and CI. Confirm the VERIFY lines — this project has
no `staging` branch yet, so the staging step needs your input._

**Infra:** web → Vercel (`scripts/deploy-vercel.sh`), mobile → Expo/EAS
(`scripts/deploy-expo-new-account.sh`, `scripts/build-mobile.sh`).
**Repo:** github.com/mukulkatewa/kak_fit
**CI:** `ci.yml` (typecheck + unit + API integration) on `main` / PRs.
**Branch flow:** feature → `main`  (RECOMMEND: add a `staging` branch)
**PR base:** main

## Staging
- Web: a Vercel **preview deploy** is the natural staging — every PR gets a
  preview URL if the Vercel project is linked. VERIFY the project is linked
  (`vercel link`) so previews appear on PRs.
- Command (VERIFY): `bash scripts/deploy-vercel.sh` for a preview, or rely
  on the automatic PR preview.
- Staging URL: the PR's Vercel preview URL.

## Production (manual — never automatic)
- Web: VERIFY prod command (likely `bash scripts/deploy-vercel.sh <prod flag>`
  then `bash scripts/set-production-api.sh`).
- Mobile: `pnpm build:mobile:prod` then EAS submit (VERIFY).
- Only after the preview is tested and the user says "promote".
- Production URL: VERIFY.

## Health check
- VERIFY.

## Suggested improvement
Add a `staging` branch + a Vercel staging environment (or an EAS
preview channel) so `/ship` has a real, stable staging target instead of
per-PR previews.
