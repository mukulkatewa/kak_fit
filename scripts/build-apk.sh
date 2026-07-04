#!/usr/bin/env bash
# Build a direct Android APK (no Play Store). Uses preview profile → .apk download link.
#
# Option A — log in once in terminal (recommended):
#   cd apps/mobile && npx eas-cli login    # use your NEW Expo Gmail
#   cd ../.. && ./scripts/build-apk.sh
#
# Option B — access token (paste the REAL token, not "your_token_here"):
#   EXPO_TOKEN=AbCdEf123... ./scripts/build-apk.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/apps/mobile"
PROJECT_ID="dd9991e3-ad4a-44fa-a372-040744c4b768"

if [[ "${EXPO_TOKEN:-}" == "your_token_here" || "${EXPO_TOKEN:-}" == "your_token" ]]; then
  echo "ERROR: You used the example placeholder — not a real token."
  echo ""
  echo "Do ONE of these:"
  echo "  1) cd apps/mobile && npx eas-cli login   (browser login with NEW Gmail)"
  echo "     then run: ./scripts/build-apk.sh"
  echo ""
  echo "  2) Create a real token: https://expo.dev/settings/access-tokens"
  echo "     EXPO_TOKEN=paste_real_token_here ./scripts/build-apk.sh"
  exit 1
fi

cd "$MOBILE"

echo "==> Expo account"
pnpm exec eas whoami || {
  echo ""
  echo "Not logged in. Run: cd apps/mobile && npx eas-cli login"
  exit 1
}

echo "==> Link project $PROJECT_ID"
pnpm exec eas init --id "$PROJECT_ID" --force --non-interactive

echo "==> Build Android APK (preview — direct download, NOT Play Store)"
pnpm exec eas build --platform android --profile preview --non-interactive

echo ""
echo "Done. When the build finishes, open the build URL above and tap Download for the .apk"
