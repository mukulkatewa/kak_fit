import { useEffect } from "react";
import { useAuth } from "./auth-context";
import { authMeQueryOptions, trpc } from "./trpc";

function isUnauthorizedError(error: { data?: { code?: string } | null }): boolean {
  return error.data?.code === "UNAUTHORIZED";
}

/** Validates the cached session in the background; signs out on 401. */
export function AuthSessionValidator() {
  const { isAuthenticated, signOut } = useAuth();
  const { error } = trpc.auth.me.useQuery(undefined, {
    ...authMeQueryOptions,
    enabled: isAuthenticated,
    retry: false,
  });

  useEffect(() => {
    if (!error || !isUnauthorizedError(error)) return;
    void signOut();
  }, [error, signOut]);

  return null;
}
