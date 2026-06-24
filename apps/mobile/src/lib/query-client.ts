import { QueryClient } from "@tanstack/react-query";
import { defaultQueryClientOptions } from "./trpc";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: defaultQueryClientOptions,
  });
}

/** Shared React Query client for the app shell and auth sign-out. */
export const queryClient = createQueryClient();
