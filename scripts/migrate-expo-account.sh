#!/usr/bin/env bash
# Link Kak Fit to a NEW Expo account and publish update + start Android build.
#
# Prerequisites (do once in browser):
#   1. Sign up: https://expo.dev/signup  (use your other Gmail)
#   2. Create token: https://expo.dev/accounts/[username]/settings/access-tokens
#
# Usage:
#   EXPO_TOKEN=your_new_token ./scripts/migrate-expo-account.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/apps/mobile"
API_URL="${EXPO_PUBLIC_API_URL:-https://web-eight-khaki-87.vercel.app}"

if [[ -z "${EXPO_TOKEN:-}" ]]; then
  echo "ERROR: Set EXPO_TOKEN from your NEW Expo account."
  echo "  expo.dev → Account → Access Tokens → Create"
  echo ""
  echo "  EXPO_TOKEN=xxx ./scripts/migrate-expo-account.sh"
  exit 1
fi

echo "==> Sync API URL: $API_URL"
"$ROOT/scripts/set-production-api.sh" "$API_URL"

cd "$MOBILE"

echo "==> Verify new Expo account"
pnpm exec eas whoami

echo "==> Create new EAS project (new account)"
python3 - "$MOBILE/app.json" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
data = json.loads(path.read_text())
expo = data.get("expo", {})
expo.pop("owner", None)
extra = expo.get("extra") or {}
extra.pop("eas", None)
if extra:
    expo["extra"] = extra
else:
    expo.pop("extra", None)
expo.pop("updates", None)
data["expo"] = expo
path.write_text(json.dumps(data, indent=2) + "\n")
print("Cleared owner, projectId, and updates URL from app.json")
PY

rm -rf .expo 2>/dev/null || true
rm -f .eas/project.json 2>/dev/null || true

pnpm exec eas init --force --non-interactive

echo ""
echo "==> New project linked. app.json updated."
grep -E '"projectId"|"owner"|"url"' app.json || true

echo "==> Publish OTA update to main"
pnpm exec eas update --branch main --message "Initial publish on new Expo account" --non-interactive

echo "==> Start Android APK build (preview)"
pnpm exec eas build --platform android --profile preview --non-interactive

echo ""
echo "Done. Open the build URL above when finished for the APK download link."
echo "Expo Go: https://expo.dev/accounts/$(pnpm exec eas whoami 2>/dev/null | head -1)/projects/kak-fit"
