#!/usr/bin/env bash
# Deploy apps/web to Vercel (requires: vercel login, repo env in root .env)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/apps/web"
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

cd "$WEB"

echo "==> Linking project (root: apps/web) if needed..."
vercel link --yes 2>/dev/null || vercel link

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

echo "==> Deploying to production..."
DEPLOY_URL=$(vercel deploy --prod --yes 2>&1 | tee /dev/stderr | grep -oE 'https://[a-zA-Z0-9.-]+\.vercel\.app' | tail -1)

if [[ -z "$DEPLOY_URL" ]]; then
  echo "Deploy finished — check Vercel dashboard for URL."
  exit 0
fi

echo ""
echo "Deployed: $DEPLOY_URL"
echo "Run: ./scripts/set-production-api.sh $DEPLOY_URL"
echo "Then redeploy so BETTER_AUTH_URL matches: vercel deploy --prod --yes"
