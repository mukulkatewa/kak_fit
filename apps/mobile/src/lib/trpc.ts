import { QueryClient } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@kak-fit/api";
import superjson from "superjson";
import { getToken } from "./auth";

const getApiUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
  if (typeof window !== "undefined") {
    return envUrl.replace(/\/\/[\d.]+:/, "//localhost:");
  }
  return envUrl;
};

const API_URL = getApiUrl();

export const trpc = createTRPCReact<AppRouter>();

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 15_000,
      },
    },
  });
}

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_URL}/api/trpc`,
        transformer: superjson,
        async headers() {
          const token = await getToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
