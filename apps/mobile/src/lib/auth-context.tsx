import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as authLib from "./auth";

const API_URL =
  Platform.OS === "web"
    ? (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(
        /\/\/[\d.]+:/,
        "//localhost:",
      )
    : (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000");

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
    const response = await fetch(`${API_URL}/api/auth/get-session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { session?: unknown };
    return !!data.session;
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
