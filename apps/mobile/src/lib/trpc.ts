import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@kak-fit/api/router";
import superjson from "superjson";
import { apiHeaders, getApiUrl } from "./api-client";
import { getToken, getTokenSync } from "./auth";

export const trpc = createTRPCReact<AppRouter>();

export const queryStaleTime = {
  authMe: 5 * 60 * 1000,
  authStats: 5 * 60 * 1000,
  weeklyVolume: 5 * 60 * 1000,
  workoutHistory: 60 * 1000,
  routineList: 60 * 1000,
  progress: 2 * 60 * 1000,
  exerciseDetail: 10 * 60 * 1000,
  previousPerformance: 60 * 1000,
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
