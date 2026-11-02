import { QueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { defaultQueryClientOptions } from "./query-options";

const queryShouldRetry = (failureCount: number, error: unknown) => {
  if (error instanceof TRPCClientError) {
    const httpStatus = error.data?.httpStatus;
    if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
      return false;
    }
  }
  // Recover network failures through an explicit retry or reconnection.
  if (error instanceof TypeError) return false;
  return failureCount < 1;
};

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      ...defaultQueryClientOptions,
      queries: {
        ...defaultQueryClientOptions.queries,
        retry: queryShouldRetry,
      },
      mutations: {
        // A lost response does not prove the write failed. Retries belong in
        // operation-specific recovery logic, with server idempotency where needed.
        retry: false,
      },
    },
  });
}

/** Shared React Query client for the app shell and auth sign-out. */
export const queryClient = createQueryClient();
