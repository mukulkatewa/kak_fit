import { useEffect } from "react";
import { refreshToken } from "./auth";
import { notifySessionExpired } from "./auth-session-events";
import { useAuth } from "./auth-context";
import { authMeQueryOptions, trpc } from "./trpc";

function isUnauthorizedError(error: { data?: { code?: string } | null }): boolean {
  return error.data?.code === "UNAUTHORIZED";
}

/** Validates the cached session in the background; refreshes token or signs out on 401. */
export function AuthSessionValidator() {
  const { isAuthenticated, isLoading } = useAuth();
  const utils = trpc.useUtils();
  const { error, isFetched } = trpc.auth.me.useQuery(undefined, {
    ...authMeQueryOptions,
    enabled: isAuthenticated && !isLoading,
    retry: false,
  });

  useEffect(() => {
    if (!isFetched || !error || !isUnauthorizedError(error)) return;

    void (async () => {
      const refreshed = await refreshToken();
      if (refreshed) {
        await utils.auth.me.invalidate();
        return;
      }
      notifySessionExpired();
    })();
  }, [error, isFetched, utils.auth.me]);

  return null;
}
