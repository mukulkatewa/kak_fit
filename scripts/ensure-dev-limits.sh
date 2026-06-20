#!/usr/bin/env bash
# Dev servers (Next Turbopack, Metro) watch thousands of files in a pnpm monorepo.
# When Linux inotify limit is too low you get:
#   "OS file watch limit reached" → Module not found → API 500 on login
set -euo pipefail

MIN_WATCHES=524288
CURRENT="$(cat /proc/sys/fs/inotify/max_user_watches 2>/dev/null || echo 0)"

if [[ "$CURRENT" -ge "$MIN_WATCHES" ]]; then
  exit 0
fi

echo ""
echo "⚠️  inotify watch limit is ${CURRENT} (recommended: ${MIN_WATCHES})"
echo "   Large monorepos can hit this and break Next.js / Expo dev servers."
echo ""
echo "   Fix once (requires sudo):"
echo "     sudo sysctl -w fs.inotify.max_user_watches=${MIN_WATCHES}"
echo "     echo 'fs.inotify.max_user_watches=${MIN_WATCHES}' | sudo tee /etc/sysctl.d/99-inotify.conf"
echo "     sudo sysctl --system"
echo ""
echo "   Using polling-based file watching as fallback (slightly slower HMR)."
echo ""

export WATCHPACK_POLLING="${WATCHPACK_POLLING:-true}"
export CHOKIDAR_USEPOLLING="${CHOKIDAR_USEPOLLING:-true}"
