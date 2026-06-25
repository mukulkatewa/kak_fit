import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as authLib from "./auth";
import { queryClient } from "./query-client";

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => ReturnType<typeof authLib.signIn>;
  signUp: (name: string, email: string, password: string) => ReturnType<typeof authLib.signUp>;
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
    void authLib.tokenHydrationPromise.then((token) => {
      setIsAuthenticated(Boolean(token));
      setIsLoading(false);
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await authLib.signIn(email, password);
    setIsAuthenticated(true);
    void queryClient.invalidateQueries();
    return result;
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const result = await authLib.signUp(name, email, password);
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
    <AuthContext.Provider value={{ isAuthenticated, isLoading, signIn, signUp, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
