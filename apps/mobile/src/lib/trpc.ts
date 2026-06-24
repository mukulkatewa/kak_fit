import { QueryClient } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@kak-fit/api/router";
import superjson from "superjson";
import { apiHeaders, getApiUrl } from "./api-client";
import { getToken } from "./auth";

export const trpc = createTRPCReact<AppRouter>();

/** Session user — refetch on mount so expired tokens are detected without a separate auth gate fetch. */
export const authMeQueryOptions = {
  staleTime: 0,
  refetchOnMount: true,
} as const;

/** Dashboard history/charts — brief cache when returning to the home tab. */
export const dashboardCacheOptions = {
  staleTime: 60_000,
} as const;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
    },
  });
}

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getApiUrl()}/api/trpc`,
        transformer: superjson,
        async headers() {
          const token = await getToken();
          return apiHeaders(token ? { Authorization: `Bearer ${token}` } : {});
        },
      }),
    ],
  });
}
