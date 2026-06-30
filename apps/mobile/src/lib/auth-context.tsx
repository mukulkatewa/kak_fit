import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as authLib from "./auth";
import { queryClient } from "./query-client";

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  signInWithGoogle: () => ReturnType<typeof authLib.signInWithGoogle>;
  signOut: () => Promise<void>;
  refresh: () => Promise<boolean>;
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

  const refresh = useCallback(async () => {
    const token = await authLib.getToken();
    const hasToken = Boolean(token);
    setIsAuthenticated(hasToken);
    setIsLoading(false);
    return hasToken;
  }, []);

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

      // Cookie session from OAuth but no bearer file yet (web redirect / Expo deep link).
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

  const signInWithGoogle = useCallback(async () => {
    const result = await authLib.signInWithGoogle();
    // On web, signInWithGoogle returns a never-resolving promise because
    // the page redirects to Google. This code only runs on native.
    if (Platform.OS !== "web") {
      setIsAuthenticated(true);
      setIsLoading(false);
      void queryClient.invalidateQueries();
    }
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await authLib.signOut();
    queryClient.clear();
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, signInWithGoogle, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
