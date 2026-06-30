import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@kak-fit/api/router";
import superjson from "superjson";
import { apiHeaders, getApiUrl } from "./api-client";
import { getToken, getTokenSync } from "./auth";

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

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getApiUrl()}/api/trpc`,
        transformer: superjson,
        async headers() {
          const token = getTokenSync() ?? (await getToken());
          // On web, cookie_session_* markers are local-only flags — don't send
          // them as bearer tokens. The browser will send session cookies instead.
          const isRealToken = token && !token.startsWith("cookie_session_");
          return apiHeaders(isRealToken ? { Authorization: `Bearer ${token}` } : {});
        },
        fetch(url, options) {
          // Ensure cookies are sent for web (same-origin session auth)
          return fetch(url, { ...options, credentials: "include" });
        },
      }),
    ],
  });
}
