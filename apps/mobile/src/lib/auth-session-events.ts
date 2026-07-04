type SessionExpiredHandler = () => void;

let onSessionExpired: SessionExpiredHandler | null = null;
let lastNotifiedAt = 0;
const NOTIFY_COOLDOWN_MS = 10_000;

export function setSessionExpiredHandler(handler: SessionExpiredHandler | null) {
  onSessionExpired = handler;
}

export function notifySessionExpired() {
  const now = Date.now();
  if (now - lastNotifiedAt < NOTIFY_COOLDOWN_MS) return;
  lastNotifiedAt = now;
  onSessionExpired?.();
}
