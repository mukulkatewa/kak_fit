#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Free port 3000 so API always runs on the correct port
fuser -k 3000/tcp 3001/tcp 2>/dev/null || true
sleep 1

bash "$ROOT/scripts/sync-ip.sh"

echo ""
echo "Starting API on http://localhost:3000"
echo "Phone will use: http://$(hostname -I | awk '{print $1}'):3000"
echo ""

cd "$ROOT"
exec pnpm dev:web
