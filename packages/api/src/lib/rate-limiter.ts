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

// Cleanup stale entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows.entries()) {
    if (now >= entry.resetAt) windows.delete(key);
  }
}, 5 * 60 * 1000);
