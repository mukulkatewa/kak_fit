#!/usr/bin/env bash
# Auto-detect home WiFi IP and sync to all .env files
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IP=$(hostname -I | awk '{print $1}')

if [[ -z "$IP" ]]; then
  echo "Could not detect LAN IP. Are you connected to WiFi?"
  exit 1
fi

ENV_FILE="$ROOT/.env"
sed -i "s|^EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=\"http://${IP}:3000\"|" "$ENV_FILE"
sed -i "s|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=\"http://${IP}:3000\"|" "$ENV_FILE"

cp "$ENV_FILE" "$ROOT/apps/web/.env.local"
cp "$ENV_FILE" "$ROOT/apps/mobile/.env"

echo "Synced WiFi IP → $IP"
echo "  EXPO_PUBLIC_API_URL=http://${IP}:3000"
echo "  BETTER_AUTH_URL=http://${IP}:3000"
