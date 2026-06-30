/** In-flight GET deduplication window (ms) after response settles. */
export const REQUEST_DEDUP_TTL_MS = 100;

export type TrpcRequestMonitorEvent =
  | { type: "fetch"; url: string; deduped: boolean }
  | { type: "batch"; itemCount: number }
  | { type: "error"; url: string; message: string };

export type TrpcRequestStats = {
  fetches: number;
  deduped: number;
  errors: number;
};

const requestCache = new Map<string, Promise<Response>>();

let stats: TrpcRequestStats = { fetches: 0, deduped: 0, errors: 0 };

function authHeaderFromInit(headers?: HeadersInit): string {
  if (!headers) return "";
  if (headers instanceof Headers) {
    return headers.get("authorization") ?? "";
  }
  if (Array.isArray(headers)) {
    const entry = headers.find(([key]) => key.toLowerCase() === "authorization");
    return entry?.[1] ?? "";
  }
  const record = headers as Record<string, string>;
  return record.authorization ?? record.Authorization ?? "";
}

export function getTrpcRequestStats(): Readonly<TrpcRequestStats> {
  return stats;
}

export function resetTrpcRequestStats(): void {
  stats = { fetches: 0, deduped: 0, errors: 0 };
}

const isDevLogging =
  typeof globalThis !== "undefined" &&
  "__DEV__" in globalThis &&
  Boolean((globalThis as { __DEV__?: boolean }).__DEV__);

export function logTrpcRequestEvent(event: TrpcRequestMonitorEvent): void {
  if (!isDevLogging) return;

  if (event.type === "fetch") {
    console.log(
      `[tRPC] ${event.deduped ? "deduped" : "fetch"} ${event.url.slice(0, 120)}`,
    );
  } else if (event.type === "batch") {
    console.log(`[tRPC] batch dispatched (${event.itemCount} ops)`);
  } else {
    console.warn(`[tRPC] error ${event.url.slice(0, 80)}: ${event.message}`);
  }
}

/**
 * Deduplicate identical in-flight GET requests (e.g. parallel mounts).
 * Mutations always bypass the cache.
 */
export function dedupedFetch(
  url: RequestInfo | URL,
  options: RequestInit | undefined,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const method = (options?.method ?? "GET").toUpperCase();
  if (method !== "GET") {
    stats.fetches += 1;
    return fetchImpl(url, options);
  }

  const urlKey = typeof url === "string" ? url : url.toString();
  const cacheKey = `${urlKey}:${authHeaderFromInit(options?.headers)}`;

  const cached = requestCache.get(cacheKey);
  if (cached) {
    stats.deduped += 1;
    logTrpcRequestEvent({ type: "fetch", url: urlKey, deduped: true });
    return cached;
  }

  stats.fetches += 1;
  logTrpcRequestEvent({ type: "fetch", url: urlKey, deduped: false });

  const promise = fetchImpl(url, options)
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      stats.errors += 1;
      logTrpcRequestEvent({ type: "error", url: urlKey, message });
      throw error;
    })
    .finally(() => {
      setTimeout(() => requestCache.delete(cacheKey), REQUEST_DEDUP_TTL_MS);
    });

  requestCache.set(cacheKey, promise);
  return promise;
}
