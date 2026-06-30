import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@kak-fit/api/router";
import superjson from "superjson";
import { apiHeaders, getApiUrl } from "./api-client";
import { getToken, getTokenSync, refreshToken } from "./auth";
import { notifySessionExpired } from "./auth-session-events";

export const trpc = createTRPCReact<AppRouter>();

export const queryStaleTime = {
  default: 30 * 1000,
  authMe: 5 * 60 * 1000,
  authStats: 5 * 60 * 1000,
  /** Active workout — fresh enough for live UI without constant refetch. */
  workoutActive: 5 * 1000,
  weeklyVolume: 5 * 60 * 1000,
  workoutHistory: 60 * 1000,
  routineList: 60 * 1000,
  progress: 2 * 60 * 1000,
  progressStreak: 5 * 60 * 1000,
  exerciseDetail: 10 * 60 * 1000,
  previousPerformance: 60 * 1000,
  nutritionDaily: 30 * 1000,
  nutritionMeals: 30 * 1000,
  nutritionTargets: 10 * 60 * 1000,
} as const;

/** Default React Query options — used by query-client.ts (30s baseline for unstated queries). */
export const defaultQueryClientOptions = {
  queries: {
    retry: 1,
    staleTime: queryStaleTime.default,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
} as const;

/** Session user — 5min staleTime; refetches when stale on mount (React Query default). */
export const authMeQueryOptions = {
  staleTime: queryStaleTime.authMe,
} as const;

async function authHeaders() {
  const token = getTokenSync() ?? (await getToken());
  const isRealToken = token && !token.startsWith("cookie_session_");
  return apiHeaders(isRealToken ? { Authorization: `Bearer ${token}` } : {});
}

async function fetchWithAuthRetry(url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
  const response = await fetch(url, { ...options, credentials: "include" });

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

  return fetch(url, { ...options, headers, credentials: "include" });
}

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getApiUrl()}/api/trpc`,
        transformer: superjson,
        headers: authHeaders,
        fetch: fetchWithAuthRetry,
      }),
    ],
  });
}
