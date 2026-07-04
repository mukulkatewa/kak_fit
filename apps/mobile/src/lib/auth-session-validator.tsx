import { useEffect, useRef } from "react";
import { isWithinAuthGracePeriod, refreshToken } from "./auth";
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
  const handlingRef = useRef(false);
  const { error, isFetched } = trpc.auth.me.useQuery(undefined, {
    ...authMeQueryOptions,
    enabled: isAuthenticated && !isLoading && !isWithinAuthGracePeriod(),
    retry: false,
  });

  useEffect(() => {
    if (!isFetched || !error || !isUnauthorizedError(error) || handlingRef.current) return;
    if (isWithinAuthGracePeriod()) return;

    handlingRef.current = true;

    void (async () => {
      try {
        const refreshed = await refreshToken();
        if (refreshed) {
          await utils.auth.me.invalidate();
          return;
        }
        notifySessionExpired();
      } finally {
        handlingRef.current = false;
      }
    })();
  }, [error, isFetched, utils.auth.me]);

  return null;
}
