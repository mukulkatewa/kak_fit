import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { showAppToast } from "../components/ui";
import * as authLib from "./auth";
import { signOut as signOutSession } from "./auth-sign-out";
import { setSessionExpiredHandler } from "./auth-session-events";
import { queryClient } from "./query-client";

const TOKEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  signInWithGoogle: () => ReturnType<typeof authLib.signInWithGoogle>;
  signOut: () => Promise<void>;
  refresh: () => Promise<boolean>;
  refreshSession: () => Promise<authLib.RefreshTokenResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getInitialAuthState() {
  if (authLib.hasKnownTokenState()) {
    return {
      isAuthenticated: Boolean(authLib.getTokenSync()),
      isLoading: false,
    };
  }
  return { isAuthenticated: false, isLoading: true };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Start with cached credentials; the hydration effect handles stored sessions.
  const [isAuthenticated, setIsAuthenticated] = useState(() => getInitialAuthState().isAuthenticated);
  const [isLoading, setIsLoading] = useState(() => getInitialAuthState().isLoading);

  const signOut = useCallback(async () => {
    await signOutSession();
    queryClient.clear();
    setIsAuthenticated(false);
  }, []);

  const refresh = useCallback(async () => {
    const token = await authLib.getToken();
    const hasToken = Boolean(token);
    setIsAuthenticated(hasToken);
    setIsLoading(false);
    return hasToken;
  }, []);

  const refreshSession = useCallback(async () => {
    if (authLib.isWithinAuthGracePeriod()) return "skipped" as authLib.RefreshTokenResult;

    const result = await authLib.refreshTokenIfNeeded();
    if (result === "refreshed") {
      setIsAuthenticated(true);
    } else if (result === "failed") {
      const expiry = await authLib.getTokenExpiry();
      if (authLib.isAccessTokenExpired(expiry)) {
        showAppToast("Session expired, please log in", "error");
        await signOut();
      }
    }
    return result;
  }, [signOut]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      showAppToast("Session expired, please log in", "error");
      void signOut();
    });
    return () => setSessionExpiredHandler(null);
  }, [signOut]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (authLib.hasKnownTokenState() && authLib.getTokenSync()) {
        setIsLoading(false);
        return;
      }

      await authLib.tokenHydrationPromise.catch(() => null);

      if (cancelled) return;

      const hasToken = Boolean(authLib.getTokenSync());
      if (hasToken) {
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      // Skip session recovery on clean install (no auth cookies stored) to avoid 4s delay
      const hasPossibleSession = await authLib.hasPossibleStoredSession();
      const recovered = hasPossibleSession ? await authLib.ensureBearerFromExistingSession() : false;
      if (cancelled) return;

      setIsAuthenticated(recovered);
      setIsLoading(false);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    // Background refresh only; immediate post-sign-in refresh is handled by signInWithGoogle → refresh()
    const id = setInterval(() => {
      void refreshSession();
    }, TOKEN_REFRESH_INTERVAL_MS);

    return () => clearInterval(id);
  }, [isAuthenticated, isLoading, refreshSession]);

  const signInWithGoogle = useCallback(async () => {
    const result = await authLib.signInWithGoogle();
    if (Platform.OS !== "web") {
      const ok = await refresh();
      if (!ok) {
        throw new Error("Sign-in completed but session could not be saved. Try again.");
      }
      void queryClient.invalidateQueries();
    }
    return result;
  }, [refresh]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        signInWithGoogle,
        signOut,
        refresh,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
