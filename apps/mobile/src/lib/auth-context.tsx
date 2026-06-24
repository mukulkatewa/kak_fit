import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as authLib from "./auth";

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => ReturnType<typeof authLib.signIn>;
  signUp: (name: string, email: string, password: string) => ReturnType<typeof authLib.signUp>;
  signOut: () => Promise<void>;
  refresh: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = await authLib.getToken();
    const hasToken = Boolean(token);
    setIsAuthenticated(hasToken);
    setIsLoading(false);
    return hasToken;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await authLib.signIn(email, password);
    setIsAuthenticated(true);
    return result;
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const result = await authLib.signUp(name, email, password);
    setIsAuthenticated(true);
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await authLib.signOut();
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
