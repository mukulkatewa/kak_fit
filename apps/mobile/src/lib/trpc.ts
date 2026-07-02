import { Platform } from "react-native";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@kak-fit/api/router";
import superjson from "superjson";
import { getApiUrl } from "./api-client";
import { authHeaders, trpcFetch } from "./trpc-fetch";

export const trpc = createTRPCReact<AppRouter>();

/** Minimum stale window — React Query dedupes in-flight identical queries. */
export const queryDedupStaleTime = 5000;

export const queryStaleTime = {
  default: 30 * 1000,
  authMe: 5 * 60 * 1000,
  authStats: 5 * 60 * 1000,
  /** Active workout — fresh enough for live UI without constant refetch. */
  workoutActive: 10 * 1000,
  weeklyVolume: 5 * 60 * 1000,
  workoutHistory: 2 * 60 * 1000,
  routineList: 2 * 60 * 1000,
  progress: 3 * 60 * 1000,
  progressStreak: 5 * 60 * 1000,
  exerciseDetail: 10 * 60 * 1000,
  previousPerformance: 2 * 60 * 1000,
  nutritionDaily: 30 * 1000,
  nutritionMeals: 30 * 1000,
  nutritionTargets: 10 * 60 * 1000,
  authToken: 60 * 1000,
} as const;

/** Default React Query options — used by query-client.ts (30s baseline for unstated queries). */
export const defaultQueryClientOptions = {
  queries: {
    retry: 1,
    staleTime: queryStaleTime.default,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    structuralSharing: true,
    networkMode: "online" as const,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true, // refetch on mount only when data is stale (TanStack Query v5 default)
  },
} as const;

/** Session user — 5min staleTime; refetches when stale on mount (React Query default). */
export const authMeQueryOptions = {
  staleTime: queryStaleTime.authMe,
} as const;

/** Batch up to 10 procedure calls per HTTP request; split when URL exceeds browser limits. */
const TRPC_BATCH_MAX_ITEMS = 10;
const TRPC_BATCH_MAX_URL_LENGTH = 2083;

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      loggerLink({
        enabled: (opts) =>
          __DEV__ || (opts.direction === "down" && opts.result instanceof Error),
      }),
      httpBatchLink({
        url: `${getApiUrl()}/api/trpc`,
        transformer: superjson,
        // Long GET batch URLs break on some mobile browsers (ERR_SSL_PROTOCOL_ERROR).
        maxURLLength: Platform.OS === "web" ? 0 : TRPC_BATCH_MAX_URL_LENGTH,
        maxItems: TRPC_BATCH_MAX_ITEMS,
        headers: authHeaders,
        fetch: trpcFetch,
      }),
    ],
  });
}
