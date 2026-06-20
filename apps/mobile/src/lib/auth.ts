import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "kak_fit_token";

const API_URL =
  Platform.OS === "web"
    ? (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(
        /\/\/[\d.]+:/,
        "//localhost:",
      )
    : (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000");

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

async function readStoredToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function writeStoredToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function removeStoredToken(): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getToken(): Promise<string | null> {
  return readStoredToken();
}

export async function setToken(token: string): Promise<void> {
  await writeStoredToken(token);
}

export async function clearToken(): Promise<void> {
  await removeStoredToken();
}

async function authRequest(path: string, body: Record<string, string>) {
  const response = await fetch(`${API_URL}/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
    token?: string;
    user?: AuthUser;
  };

  if (!response.ok) {
    throw new Error(data?.message ?? data?.error ?? "Authentication failed");
  }

  const tokenRaw = response.headers.get("set-auth-token") ?? data.token;
  if (!tokenRaw) {
    throw new Error("No session token returned");
  }

  // Store token id (DB key) — Better Auth sends id.signature in header
  const token = tokenRaw.includes(".") ? tokenRaw.split(".")[0] : tokenRaw;
  await setToken(token);
  return { token, user: data.user as AuthUser };
}

export async function signUp(name: string, email: string, password: string) {
  return authRequest("/sign-up/email", { name, email, password });
}

export async function signIn(email: string, password: string) {
  return authRequest("/sign-in/email", { email, password });
}

export async function signOut() {
  const token = await getToken();
  if (token) {
    await fetch(`${API_URL}/api/auth/sign-out`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => undefined);
  }
  await clearToken();
}
