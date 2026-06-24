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

/** Session user — refetch on mount when stale (see queryStaleTime.authMe). */
export const authMeQueryOptions = {
  staleTime: queryStaleTime.authMe,
  refetchOnMount: true,
} as const;

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getApiUrl()}/api/trpc`,
        transformer: superjson,
        async headers() {
          const token = getTokenSync() ?? (await getToken());
          return apiHeaders(token ? { Authorization: `Bearer ${token}` } : {});
        },
      }),
    ],
  });
}
