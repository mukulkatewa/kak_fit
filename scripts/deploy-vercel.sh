#!/usr/bin/env bash
# Deploy apps/web to Vercel from monorepo root (full repo upload + Root Directory apps/web).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

if ! command -v vercel >/dev/null 2>&1; then
  echo "Install Vercel CLI: npm i -g vercel"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

cd "$ROOT"

echo "==> Linking project from monorepo root..."
if [[ ! -f "$ROOT/.vercel/project.json" ]]; then
  vercel link --project web --yes
fi

echo "==> Pushing env vars to Vercel (production)..."
ENV_KEYS=(
  DATABASE_URL
  DIRECT_URL
  BETTER_AUTH_SECRET
  BETTER_AUTH_URL
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  EXPO_PUBLIC_API_URL
  USDA_API_KEY
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_STORAGE_BUCKET
)

for key in "${ENV_KEYS[@]}"; do
  val="${!key:-}"
  if [[ -n "$val" ]]; then
    printf '%s' "$val" | vercel env add "$key" production --force 2>/dev/null \
      || printf '%s' "$val" | vercel env add "$key" production
    echo "  $key"
  fi
done

echo "==> Deploying to production (full monorepo)..."
DEPLOY_OUTPUT=$(vercel deploy --prod --yes 2>&1)
echo "$DEPLOY_OUTPUT"

# Prefer the stable production alias — NOT the per-deployment URL (breaks Google OAuth redirect_uri).
ALIASED_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'Aliased: https://[^ ]+' | sed 's/Aliased: //' | tail -1)
CANONICAL_API="${BETTER_AUTH_URL:-}"
if [[ -z "$CANONICAL_API" && -n "$ALIASED_URL" ]]; then
  CANONICAL_API="$ALIASED_URL"
fi

if [[ -z "$CANONICAL_API" ]]; then
  echo "Deploy finished — set BETTER_AUTH_URL in .env to your stable Vercel alias."
  exit 0
fi

CANONICAL_API="${CANONICAL_API%/}"
echo ""
echo "Deployed. Canonical API: $CANONICAL_API"

# Keep Vercel + local env pinned to the stable alias (never a deployment-specific *.vercel.app slug).
if [[ "$CANONICAL_API" != "${BETTER_AUTH_URL:-}" ]]; then
  echo "==> Syncing BETTER_AUTH_URL / EXPO_PUBLIC_API_URL to $CANONICAL_API"
  "$ROOT/scripts/set-production-api.sh" "$CANONICAL_API"
fi

printf '%s' "$CANONICAL_API" | vercel env add BETTER_AUTH_URL production --force 2>/dev/null \
  || printf '%s' "$CANONICAL_API" | vercel env add BETTER_AUTH_URL production
printf '%s' "$CANONICAL_API" | vercel env add EXPO_PUBLIC_API_URL production --force 2>/dev/null \
  || printf '%s' "$CANONICAL_API" | vercel env add EXPO_PUBLIC_API_URL production

echo "==> Redeploying so OAuth uses stable redirect URI..."
vercel deploy --prod --yes >/dev/null

echo ""
echo "Done. API: $CANONICAL_API"
echo "Google redirect URI must be: ${CANONICAL_API}/api/auth/callback/google"
echo "Restart Expo or rebuild EAS to pick up apps/mobile/.env"
