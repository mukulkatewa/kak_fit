import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { showAppToast } from "../components/ui";
import * as authLib from "./auth";
import { setSessionExpiredHandler } from "./auth-session-events";
import { queryClient } from "./query-client";

const TOKEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
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
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => getInitialAuthState().isAuthenticated,
  );
  const [isLoading, setIsLoading] = useState(() => getInitialAuthState().isLoading);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const signOut = useCallback(async () => {
    await authLib.signOut();
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
    setIsRefreshing(true);
    try {
      const result = await authLib.refreshTokenIfNeeded();
      if (result === "refreshed") {
        setIsAuthenticated(true);
        showAppToast("Session renewed", "info");
      } else if (result === "failed") {
        const expiry = await authLib.getTokenExpiry();
        if (authLib.isAccessTokenExpired(expiry)) {
          showAppToast("Session expired, please log in", "error");
          await signOut();
        }
      }
      return result;
    } finally {
      setIsRefreshing(false);
    }
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

      const recovered = await authLib.ensureBearerFromExistingSession();
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

    void refreshSession();

    const id = setInterval(() => {
      void refreshSession();
    }, TOKEN_REFRESH_INTERVAL_MS);

    return () => clearInterval(id);
  }, [isAuthenticated, isLoading, refreshSession]);

  const signInWithGoogle = useCallback(async () => {
    const result = await authLib.signInWithGoogle();
    if (Platform.OS !== "web") {
      setIsAuthenticated(true);
      setIsLoading(false);
      void queryClient.invalidateQueries();
    }
    return result;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        isRefreshing,
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
