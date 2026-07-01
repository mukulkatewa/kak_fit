import { LRUCache } from "lru-cache";
import type { User } from "@kak-fit/db";

export const SESSION_CACHE_TTL_MS = 30_000;
const CLEANUP_INTERVAL_MS = 60_000;

const maxEntries = Math.max(
  1,
  Number.parseInt(process.env.TRPC_SESSION_CACHE_SIZE ?? "10000", 10) || 10_000,
);

type CacheStats = {
  hits: number;
  misses: number;
  evictions: number;
};

const stats: CacheStats = {
  hits: 0,
  misses: 0,
  evictions: 0,
};

const sessionCache = new LRUCache<string, User>({
  max: maxEntries,
  ttl: SESSION_CACHE_TTL_MS,
  updateAgeOnGet: true,
  updateAgeOnHas: false,
  dispose: (_value, _key, reason) => {
    if (reason === "evict" || reason === "expire") {
      stats.evictions += 1;
    }
  },
});

let maintenanceStarted = false;

export function getSessionCacheStats() {
  return {
    ...stats,
    size: sessionCache.size,
    max: maxEntries,
    hitRate:
      stats.hits + stats.misses === 0
        ? 0
        : Number((stats.hits / (stats.hits + stats.misses)).toFixed(4)),
  };
}

export function clearSessionCache() {
  sessionCache.clear();
  stats.hits = 0;
  stats.misses = 0;
  stats.evictions = 0;
}

export function getCachedSessionUser(token: string): User | null {
  const cached = sessionCache.get(token);
  if (cached) {
    stats.hits += 1;
    return cached;
  }
  stats.misses += 1;
  return null;
}

export function setCachedSessionUser(token: string, user: User) {
  sessionCache.set(token, user);
}

export function deleteCachedSessionUser(token: string) {
  sessionCache.delete(token);
}

function logCacheStats() {
  sessionCache.purgeStale();
  if (process.env.NODE_ENV !== "development") return;
  console.log(
    `[SessionCache] Size: ${sessionCache.size}/${maxEntries}, Stats: ${JSON.stringify(getSessionCacheStats())}`,
  );
}

export function startSessionCacheMaintenance() {
  if (maintenanceStarted) return;
  maintenanceStarted = true;

  const timer = setInterval(logCacheStats, CLEANUP_INTERVAL_MS);
  if (typeof timer === "object" && "unref" in timer) {
    timer.unref();
  }
}

// Module init: start maintenance once per server instance.
startSessionCacheMaintenance();

export { sessionCache };
