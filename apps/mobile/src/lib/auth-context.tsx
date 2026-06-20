import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as authLib from "./auth";
import { apiHeaders, getApiUrl } from "./api-client";

const API_URL = getApiUrl();

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => ReturnType<typeof authLib.signIn>;
  signUp: (name: string, email: string, password: string) => ReturnType<typeof authLib.signUp>;
  signOut: () => Promise<void>;
  refresh: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function validateToken(token: string): Promise<boolean> {
  try {
    const input = encodeURIComponent(JSON.stringify({ "0": { json: null } }));
    const response = await fetch(`${API_URL}/api/trpc/auth.me?batch=1&input=${input}`, {
      headers: apiHeaders({ Authorization: `Bearer ${token}` }),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as Array<{ result?: { data?: { json?: { id?: string } } } }>;
    return Boolean(data[0]?.result?.data?.json?.id);
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = await authLib.getToken();
    if (!token) {
      setIsAuthenticated(false);
      setIsLoading(false);
      return false;
    }

    const valid = await validateToken(token);
    if (!valid) {
      await authLib.clearToken();
      setIsAuthenticated(false);
      setIsLoading(false);
      return false;
    }

    setIsAuthenticated(true);
    setIsLoading(false);
    return true;
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
