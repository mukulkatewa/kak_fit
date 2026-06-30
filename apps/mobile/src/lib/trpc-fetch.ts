import { getToken, getTokenSync, refreshToken } from "./auth";
import { notifySessionExpired } from "./auth-session-events";
import { apiHeaders } from "./api-client";
import { dedupedFetch } from "./trpc-request-cache";

export const TRPC_REQUEST_TIMEOUT_MS = 30_000;

function createTimeoutSignal(ms: number, parent?: AbortSignal | null): AbortSignal {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    const timeoutSignal = AbortSignal.timeout(ms);
    if (!parent) return timeoutSignal;
    if ("any" in AbortSignal && typeof AbortSignal.any === "function") {
      return AbortSignal.any([parent, timeoutSignal]);
    }
    return timeoutSignal;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Request timeout after ${ms}ms`));
  }, ms);

  const onParentAbort = () => {
    clearTimeout(timer);
    controller.abort(parent?.reason);
  };

  parent?.addEventListener("abort", onParentAbort, { once: true });

  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onParentAbort);
    },
    { once: true },
  );

  return controller.signal;
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = getTokenSync() ?? (await getToken());
  const isRealToken = token && !token.startsWith("cookie_session_");
  return apiHeaders(isRealToken ? { Authorization: `Bearer ${token}` } : {});
}

async function fetchWithAuthRetry(
  url: RequestInfo | URL,
  options?: RequestInit,
): Promise<Response> {
  const signal = createTimeoutSignal(TRPC_REQUEST_TIMEOUT_MS, options?.signal ?? null);
  const response = await fetch(url, { ...options, credentials: "include", signal });

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshToken();
  if (!refreshed) {
    notifySessionExpired();
    return response;
  }

  const headers = new Headers(options?.headers);
  const token = getTokenSync() ?? (await getToken());
  const isRealToken = token && !token.startsWith("cookie_session_");
  if (isRealToken) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    headers.delete("Authorization");
  }

  const auth = await authHeaders();
  for (const [key, value] of Object.entries(auth)) {
    headers.set(key, value);
  }

  const retrySignal = createTimeoutSignal(TRPC_REQUEST_TIMEOUT_MS, options?.signal ?? null);
  return fetch(url, { ...options, headers, credentials: "include", signal: retrySignal });
}

/** tRPC httpBatchLink fetch — dedup, auth retry, and 30s timeout. */
export function trpcFetch(url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  return dedupedFetch(url, options, fetchWithAuthRetry);
}
