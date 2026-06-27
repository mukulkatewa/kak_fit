import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { apiHeaders, getApiUrl } from "./api-client";

const TOKEN_KEY = "kak_fit_token";

/** In-memory cache so native can read the token synchronously after first hydrate. */
let cachedToken: string | null | undefined =
  Platform.OS === "web"
    ? (globalThis.localStorage?.getItem(TOKEN_KEY) ?? null)
    : undefined;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

/** Synchronous token read — localStorage on web, memory cache on native after hydrate. */
export function getTokenSync(): string | null {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
  }
  return cachedToken ?? null;
}

/** Whether the token cache has been populated (always true on web). */
export function hasKnownTokenState(): boolean {
  return Platform.OS === "web" || cachedToken !== undefined;
}

async function readStoredToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    const token = globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
    cachedToken = token;
    return token;
  }
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  cachedToken = token;
  return token;
}

/** Started at module load so SecureStore is read before the first React paint. */
export const tokenHydrationPromise: Promise<string | null> =
  Platform.OS === "web"
    ? Promise.resolve(getTokenSync())
    : SecureStore.getItemAsync(TOKEN_KEY)
        .then((token) => {
          cachedToken = token;
          return token;
        })
        .catch(() => {
          cachedToken = null;
          return null;
        });

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
  if (hasKnownTokenState()) {
    return getTokenSync();
  }
  return readStoredToken();
}

export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  await writeStoredToken(token);
}

export async function clearToken(): Promise<void> {
  cachedToken = null;
  await removeStoredToken();
}

async function authRequest(path: string, body: Record<string, string>) {
  const response = await fetch(`${getApiUrl()}/api/auth${path}`, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
    token?: string;
    user?: AuthUser;
  };

  if (!response.ok) {
    const code = (data as { code?: string }).code;
    const detail = data?.message ?? data?.error;
    if (code === "INVALID_ORIGIN" || code === "MISSING_OR_NULL_ORIGIN") {
      throw new Error(
        detail ??
          "Sign-in blocked by server origin policy. Point EXPO_PUBLIC_API_URL at your live API URL (see docs/ENV_SETUP.md).",
      );
    }
    throw new Error(detail ?? `Authentication failed (${response.status})`);
  }

  const tokenRaw = response.headers.get("set-auth-token") ?? data.token;
  if (!tokenRaw) {
    throw new Error("No session token returned");
  }

  await setToken(tokenRaw);
  return { token: tokenRaw, user: data.user as AuthUser };
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
    await fetch(`${getApiUrl()}/api/auth/sign-out`, {
      method: "POST",
      headers: apiHeaders({
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }),
      body: "{}",
    }).catch(() => undefined);
  }
  await clearToken();
}
