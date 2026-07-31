type WindowEntry = { count: number; resetAt: number };
const windows = new Map<string, WindowEntry>();

export function rateLimit(
  userId: string,
  bucket: string,
  opts: { limit: number; windowMs: number },
): boolean {
  const key = `${userId}:${bucket}`;
  const now = Date.now();
  const entry = windows.get(key);

  if (!entry || now >= entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + opts.windowMs });
    return true;
  }

  if (entry.count >= opts.limit) return false;
  entry.count++;
  return true;
}

/** Clear all rate-limit windows. Used by the integration test harness. */
export function resetRateLimits(): void {
  windows.clear();
}

// Cleanup stale entries every 5 minutes to prevent memory leak
const cleanupTimer: unknown = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows.entries()) {
    if (now >= entry.resetAt) windows.delete(key);
  }
}, 5 * 60 * 1000);

// Don't hold the event loop open — otherwise `node --test` and one-off scripts hang.
// Typed as unknown because this file is also compiled under DOM lib, where
// setInterval returns a number rather than a Node Timeout.
(cleanupTimer as { unref?: () => void })?.unref?.();
