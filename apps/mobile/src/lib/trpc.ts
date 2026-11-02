import { httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@kak-fit/api/router";
import superjson from "superjson";
import { getApiUrl } from "./api-client";
import { authHeaders, trpcFetch } from "./trpc-fetch";

export const trpc = createTRPCReact<AppRouter>();

export { authMeQueryOptions, queryStaleTime } from "./query-options";

/** Batch up to 10 procedure calls per HTTP request; split when URL exceeds browser limits. */
const TRPC_BATCH_MAX_ITEMS = 10;
const TRPC_BATCH_MAX_URL_LENGTH = 2083;

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      loggerLink({
        enabled: (event) => __DEV__ && (
          process.env.EXPO_PUBLIC_TRPC_DEBUG === "1"
          || (event.direction === "down" && event.result instanceof Error)
        ),
        colorMode: "none",
      }),
      httpBatchLink({
        url: `${getApiUrl()}/api/trpc`,
        transformer: superjson,
        maxURLLength: TRPC_BATCH_MAX_URL_LENGTH,
        maxItems: TRPC_BATCH_MAX_ITEMS,
        headers: authHeaders,
        fetch: trpcFetch,
      }),
    ],
  });
}
