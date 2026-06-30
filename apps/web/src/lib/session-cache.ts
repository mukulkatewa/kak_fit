import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LRUCache } from "lru-cache";
import type { User } from "@kak-fit/db";

export const SESSION_CACHE_TTL_MS = 30_000;
const CLEANUP_INTERVAL_MS = 60_000;
const CACHE_DUMP_FILE = join(tmpdir(), "kak-fit-trpc-session-cache.json");

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
let shutdownHooksRegistered = false;

function restoreCacheState() {
  try {
    if (!existsSync(CACHE_DUMP_FILE)) return;
    const raw = readFileSync(CACHE_DUMP_FILE, "utf8");
    const dumped = JSON.parse(raw) as Parameters<LRUCache<string, User>["load"]>[0];
    if (Array.isArray(dumped) && dumped.length > 0) {
      sessionCache.load(dumped);
    }
  } catch (error) {
    console.warn("[SessionCache] Failed to restore cache state", error);
  }
}

function persistCacheState() {
  try {
    mkdirSync(tmpdir(), { recursive: true });
    writeFileSync(CACHE_DUMP_FILE, JSON.stringify(sessionCache.dump()), "utf8");
  } catch (error) {
    console.warn("[SessionCache] Failed to persist cache state", error);
  }
}

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
  console.log(
    `[SessionCache] Size: ${sessionCache.size}/${maxEntries}, Stats: ${JSON.stringify(getSessionCacheStats())}`,
  );
}

function registerShutdownHooks() {
  if (shutdownHooksRegistered) return;
  shutdownHooksRegistered = true;

  const shutdown = () => {
    persistCacheState();
    sessionCache.clear();
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  process.once("beforeExit", persistCacheState);
}

export function startSessionCacheMaintenance() {
  if (maintenanceStarted) return;
  maintenanceStarted = true;

  restoreCacheState();
  registerShutdownHooks();

  const timer = setInterval(logCacheStats, CLEANUP_INTERVAL_MS);
  if (typeof timer === "object" && "unref" in timer) {
    timer.unref();
  }
}

// Module init: start maintenance once per server instance.
startSessionCacheMaintenance();

export { sessionCache };
