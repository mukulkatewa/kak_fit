#!/usr/bin/env bash
# Deploy OTA update + Android APK to the new Expo project.
# Requires EXPO_TOKEN from the NEW Expo account (not mukul_katewa).
#
#   EXPO_TOKEN=xxx ./scripts/deploy-expo-new-account.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/apps/mobile"
PROJECT_ID="dd9991e3-ad4a-44fa-a372-040744c4b768"
API_URL="${EXPO_PUBLIC_API_URL:-https://web-eight-khaki-87.vercel.app}"

if [[ -z "${EXPO_TOKEN:-}" ]]; then
  echo "ERROR: Log in to your NEW Expo account and create a token:"
  echo "  https://expo.dev/settings/access-tokens"
  echo ""
  echo "  EXPO_TOKEN=your_token ./scripts/deploy-expo-new-account.sh"
  exit 1
fi

export EXPO_TOKEN

echo "==> Account"
cd "$MOBILE"
pnpm exec eas whoami

echo "==> Link project $PROJECT_ID"
pnpm exec eas init --id "$PROJECT_ID" --force --non-interactive

echo "==> Sync API URL"
"$ROOT/scripts/set-production-api.sh" "$API_URL"

echo "==> Publish OTA update"
pnpm exec eas update --branch main --message "Deploy on new Expo account" --non-interactive

echo "==> Build Android APK (preview — direct download when done)"
pnpm exec eas build --platform android --profile preview --non-interactive

echo ""
echo "When the build finishes, download the APK from the URL above."
ACCOUNT=$(pnpm exec eas whoami 2>/dev/null | head -1)
echo "Expo Go: https://expo.dev/accounts/${ACCOUNT}/projects/kak-fit"
