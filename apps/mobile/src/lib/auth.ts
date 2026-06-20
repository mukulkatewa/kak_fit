import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "kak_fit_token";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function authRequest(path: string, body: Record<string, string>) {
  const response = await fetch(`${API_URL}/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const token = response.headers.get("set-auth-token");
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message ?? data?.error ?? "Authentication failed");
  }

  if (!token) {
    throw new Error("No session token returned");
  }

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
