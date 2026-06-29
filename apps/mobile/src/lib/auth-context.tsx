import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
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
    if (authLib.hasKnownTokenState()) return;
    void authLib.tokenHydrationPromise
      .then((token) => {
        setIsAuthenticated(Boolean(token));
        setIsLoading(false);
      })
      .catch(() => {
        setIsAuthenticated(false);
        setIsLoading(false);
      });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const result = await authLib.signInWithGoogle();
    setIsAuthenticated(true);
    void queryClient.invalidateQueries();
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
