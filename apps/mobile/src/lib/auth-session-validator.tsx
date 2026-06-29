import { useEffect } from "react";
import { useAuth } from "./auth-context";
import { authMeQueryOptions, trpc } from "./trpc";

function isUnauthorizedError(error: { data?: { code?: string } | null }): boolean {
  return error.data?.code === "UNAUTHORIZED";
}

/** Validates the cached session in the background; signs out on 401. */
export function AuthSessionValidator() {
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const { error, isFetched } = trpc.auth.me.useQuery(undefined, {
    ...authMeQueryOptions,
    enabled: isAuthenticated && !isLoading,
    retry: false,
  });

  useEffect(() => {
    if (!isFetched || !error || !isUnauthorizedError(error)) return;
    void signOut();
  }, [error, isFetched, signOut]);

  return null;
}
