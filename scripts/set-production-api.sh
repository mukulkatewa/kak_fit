#!/usr/bin/env bash
# Point local + mobile env at the deployed Vercel API URL.
# Usage: ./scripts/set-production-api.sh https://your-app.vercel.app
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <vercel-api-url>"
  echo "Example: $0 https://kak-fit-web.vercel.app"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${1%/}"
ENV_FILE="$ROOT/.env"

if [[ ! "$API_URL" =~ ^https:// ]]; then
  echo "API URL must be https (got: $API_URL)"
  exit 1
fi

python3 - "$ENV_FILE" "$API_URL" <<'PY'
import pathlib, re, sys
path, api_url = sys.argv[1], sys.argv[2]
updates = {
    "EXPO_PUBLIC_API_URL": api_url,
    "BETTER_AUTH_URL": api_url,
}
lines = pathlib.Path(path).read_text().splitlines()
out, seen = [], set()
for line in lines:
    m = re.match(r"^([A-Z_][A-Z0-9_]*)=", line)
    if m and m.group(1) in updates:
        key = m.group(1)
        out.append(f'{key}="{updates[key]}"')
        seen.add(key)
    else:
        out.append(line)
for key, val in updates.items():
    if key not in seen:
        out.append(f'{key}="{val}"')
pathlib.Path(path).write_text("\n".join(out) + "\n")
PY

cp "$ENV_FILE" "$ROOT/apps/web/.env.local"
{
  echo "# Auto-generated — production API"
  grep '^EXPO_PUBLIC_' "$ENV_FILE" || true
} > "$ROOT/apps/mobile/.env"

echo "Production API set to: $API_URL"
echo "  Updated: .env, apps/web/.env.local, apps/mobile/.env"
echo ""
echo "Restart Expo (METRO_RESET=1 pnpm dev:mobile) or rebuild EAS for changes to apply."
