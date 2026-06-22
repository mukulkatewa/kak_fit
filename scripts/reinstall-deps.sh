#!/usr/bin/env bash
# Full dependency reset — run after git pull or when Metro/Next report missing modules.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Stopping dev servers on 3000 / 8081..."
fuser -k 3000/tcp 8081/tcp 2>/dev/null || true

echo "Removing node_modules and build caches..."
rm -rf node_modules apps/*/node_modules packages/*/node_modules apps/web/.next

echo "Installing dependencies (hoisted layout for Expo + Next)..."
CI=true pnpm install

echo "Generating Prisma client..."
pnpm db:generate

echo ""
echo "Done. Start with:"
echo "  pnpm dev:api"
echo "  METRO_RESET=1 pnpm dev:mobile"
