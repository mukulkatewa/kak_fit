#!/usr/bin/env bash
# Build installable mobile app via EAS (Expo Application Services).
# Usage:
#   ./scripts/build-mobile.sh              # Android APK (preview)
#   ./scripts/build-mobile.sh android      # Android APK (preview)
#   ./scripts/build-mobile.sh ios          # iOS (preview, needs Apple dev account)
#   ./scripts/build-mobile.sh production android
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="preview"
PLATFORM="android"

if [[ "${1:-}" == "production" ]]; then
  PROFILE="production"
  PLATFORM="${2:-android}"
elif [[ "${1:-}" == "android" || "${1:-}" == "ios" || "${1:-}" == "all" ]]; then
  PLATFORM="$1"
elif [[ -n "${1:-}" ]]; then
  echo "Usage: $0 [android|ios|all|production [android|ios|all]]"
  exit 1
fi

API_URL="${EXPO_PUBLIC_API_URL:-https://web-eight-khaki-87.vercel.app}"
echo "==> Syncing mobile env (API: $API_URL)"
"$ROOT/scripts/set-production-api.sh" "$API_URL"

echo "==> Typecheck mobile"
pnpm --filter @kak-fit/mobile typecheck

cd "$ROOT/apps/mobile"

if ! pnpm exec eas whoami >/dev/null 2>&1; then
  echo ""
  echo "Not logged in to Expo. Run once:"
  echo "  cd apps/mobile && pnpm exec eas login"
  echo ""
  echo "Optional CI token: export EXPO_TOKEN=... (from expo.dev → Access Tokens)"
  exit 1
fi

echo "==> EAS build: platform=$PLATFORM profile=$PROFILE"
if [[ "$PLATFORM" == "all" ]]; then
  pnpm exec eas build --profile "$PROFILE" --non-interactive
else
  pnpm exec eas build --platform "$PLATFORM" --profile "$PROFILE" --non-interactive
fi

echo ""
echo "Download the build from the URL above, or run:"
echo "  cd apps/mobile && pnpm exec eas build:list"
