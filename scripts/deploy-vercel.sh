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
DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[a-zA-Z0-9-]+-[a-zA-Z0-9-]+\.vercel\.app' | tail -1)
PROD_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'Production: https://[^ ]+' | sed 's/Production: //' | tail -1)

FINAL_URL="${PROD_URL:-$DEPLOY_URL}"

if [[ -z "$FINAL_URL" ]]; then
  echo "Deploy finished — check Vercel dashboard for URL."
  exit 0
fi

echo ""
echo "Deployed: $FINAL_URL"

if [[ "$FINAL_URL" != "${BETTER_AUTH_URL:-}" ]]; then
  echo "==> Updating local env to production API URL..."
  "$ROOT/scripts/set-production-api.sh" "$FINAL_URL"
  printf '%s' "$FINAL_URL" | vercel env add BETTER_AUTH_URL production --force
  printf '%s' "$FINAL_URL" | vercel env add EXPO_PUBLIC_API_URL production --force
  echo "==> Redeploying with updated BETTER_AUTH_URL..."
  vercel deploy --prod --yes
fi

echo ""
echo "Done. Mobile API: $FINAL_URL"
echo "Restart Expo or rebuild EAS to pick up apps/mobile/.env"
