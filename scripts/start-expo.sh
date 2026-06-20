#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Free port 8081
fuser -k 8081/tcp 8082/tcp 2>/dev/null || true
sleep 1

bash "$ROOT/scripts/sync-ip.sh"
IP=$(hostname -I | awk '{print $1}')

export REACT_NATIVE_PACKAGER_HOSTNAME="$IP"
export EXPO_DEVTOOLS_LISTEN_ADDRESS="$IP"

echo ""
echo "============================================"
echo "  Kak Fit — Expo (scan QR with Expo Go)"
echo "============================================"
echo "  WiFi IP : $IP"
echo "  API     : http://${IP}:3000"
echo "  Expo    : exp://${IP}:8081"
echo ""
echo "  ✅ Works with Play Store Expo Go (SDK 54)"
echo "  Scan QR below, or enter: exp://${IP}:8081"
echo "============================================"
echo ""

cd "$ROOT/apps/mobile"
CLEAR_FLAG=""
if [[ "${EXPO_CLEAR_CACHE:-}" == "1" ]] || [[ "${METRO_RESET:-}" == "1" ]]; then
  CLEAR_FLAG="--clear"
  echo "Clearing Metro cache (EXPO_CLEAR_CACHE / METRO_RESET)"
fi
exec npx expo start --lan --port 8081 $CLEAR_FLAG
