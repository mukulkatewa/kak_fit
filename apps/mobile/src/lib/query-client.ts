import { QueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { defaultQueryClientOptions, queryDedupStaleTime } from "./trpc";

const mutationRetryDelay = (attemptIndex: number) =>
  Math.min(1000 * 2 ** attemptIndex, 30_000);

const mutationShouldRetry = (failureCount: number, error: unknown) => {
  if (error instanceof TRPCClientError) {
    const httpStatus = error.data?.httpStatus;
    if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
      return false;
    }
  }
  return failureCount < 3;
};

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      ...defaultQueryClientOptions,
      queries: {
        ...defaultQueryClientOptions.queries,
        // Short window for unstated queries; per-screen options override with longer values.
        staleTime: Math.max(queryDedupStaleTime, defaultQueryClientOptions.queries.staleTime),
        structuralSharing: true,
        queryKeyHashFn: (queryKey) => JSON.stringify(queryKey),
      },
      mutations: {
        retry: mutationShouldRetry,
        retryDelay: mutationRetryDelay,
      },
    },
  });
}

/** Shared React Query client for the app shell and auth sign-out. */
export const queryClient = createQueryClient();
