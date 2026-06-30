import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { apiHeaders, getApiUrl } from "./api-client";
import { authClient, AUTH_COOKIE_KEY, persistOAuthCookieFromUrl } from "./auth-client";

const TOKEN_KEY = "kak_fit_token";
const REFRESH_TOKEN_KEY = "auth_refresh_token";
const TOKEN_EXPIRY_KEY = "kak_fit_token_expiry";
const REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

/** OAuth return path — no parentheses (Better Auth rejects `/(tabs)`-style paths). */
export const AUTH_CALLBACK_PATH = "/login-callback";

let cachedToken: string | null | undefined =
  Platform.OS === "web"
    ? (globalThis.localStorage?.getItem(TOKEN_KEY) ?? null)
    : undefined;
let cachedRefreshToken: string | null | undefined =
  Platform.OS === "web"
    ? (globalThis.localStorage?.getItem(REFRESH_TOKEN_KEY) ?? null)
    : undefined;
let cachedExpiryMs: number | null | undefined =
  Platform.OS === "web"
    ? Number(globalThis.localStorage?.getItem(TOKEN_EXPIRY_KEY) ?? "") || null
    : undefined;

let refreshPromise: Promise<boolean> | null = null;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

type SessionPayload = {
  session?: { token?: string; expiresAt?: string | Date };
  user?: { id: string; name: string; email: string };
};

function isNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /network request failed|failed to fetch|load failed|internet|offline|econn|timeout|fetch failed/i.test(message);
}

function decodeJwtExpiryMs(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(globalThis.atob(base64)) as { exp?: number };
    if (typeof payload.exp === "number") {
      return payload.exp * 1000;
    }
  } catch {
    return null;
  }
  return null;
}

function parseExpiry(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

async function readStoredRefreshToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    const token = globalThis.localStorage?.getItem(REFRESH_TOKEN_KEY) ?? null;
    cachedRefreshToken = token;
    return token;
  }
  const token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  cachedRefreshToken = token;
  return token;
}

async function readStoredExpiry(): Promise<number | null> {
  if (Platform.OS === "web") {
    const raw = globalThis.localStorage?.getItem(TOKEN_EXPIRY_KEY);
    const ms = raw ? Number(raw) : null;
    cachedExpiryMs = ms && !Number.isNaN(ms) ? ms : null;
    return cachedExpiryMs;
  }
  const raw = await SecureStore.getItemAsync(TOKEN_EXPIRY_KEY);
  const ms = raw ? Number(raw) : null;
  cachedExpiryMs = ms && !Number.isNaN(ms) ? ms : null;
  return cachedExpiryMs;
}

async function writeStoredToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function writeStoredRefreshToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(REFRESH_TOKEN_KEY, token);
    cachedRefreshToken = token;
    return;
  }
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  cachedRefreshToken = token;
}

async function writeStoredExpiry(expiryMs: number): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(TOKEN_EXPIRY_KEY, String(expiryMs));
    cachedExpiryMs = expiryMs;
    return;
  }
  await SecureStore.setItemAsync(TOKEN_EXPIRY_KEY, String(expiryMs));
  cachedExpiryMs = expiryMs;
}

async function removeStoredToken(): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function removeStoredRefreshToken(): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(REFRESH_TOKEN_KEY);
    cachedRefreshToken = null;
    return;
  }
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  cachedRefreshToken = null;
}

async function removeStoredExpiry(): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(TOKEN_EXPIRY_KEY);
    cachedExpiryMs = null;
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY);
  cachedExpiryMs = null;
}

async function persistSessionCredentials(
  accessToken: string,
  options?: { refreshToken?: string; expiresAt?: string | Date | null },
) {
  await setToken(accessToken);
  const refreshCredential = options?.refreshToken ?? accessToken;
  await writeStoredRefreshToken(refreshCredential);

  const jwtExpiry = decodeJwtExpiryMs(accessToken);
  const sessionExpiry = parseExpiry(options?.expiresAt ?? null);
  const expiryMs = jwtExpiry ?? sessionExpiry?.getTime() ?? null;
  if (expiryMs != null) {
    await writeStoredExpiry(expiryMs);
  }
}

/** Deep link the in-app browser returns to after Google sign-in. */
export function getAuthCallbackUrl(): string {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${AUTH_CALLBACK_PATH}`;
    }
    return `${getApiUrl()}${AUTH_CALLBACK_PATH}`;
  }
  return Linking.createURL(AUTH_CALLBACK_PATH);
}

export function getTokenSync(): string | null {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
  }
  return cachedToken ?? null;
}

export function hasKnownTokenState(): boolean {
  return Platform.OS === "web" || cachedToken !== undefined;
}

export const tokenHydrationPromise: Promise<string | null> =
  Platform.OS === "web"
    ? Promise.resolve(getTokenSync())
    : Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.getItemAsync(TOKEN_EXPIRY_KEY),
      ])
        .then(([token, refreshToken, expiryRaw]) => {
          cachedToken = token;
          cachedRefreshToken = refreshToken;
          const expiryMs = expiryRaw ? Number(expiryRaw) : null;
          cachedExpiryMs = expiryMs && !Number.isNaN(expiryMs) ? expiryMs : null;
          return token;
        })
        .catch(() => {
          cachedToken = null;
          cachedRefreshToken = null;
          cachedExpiryMs = null;
          return null;
        });

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
  cachedRefreshToken = null;
  cachedExpiryMs = null;
  await Promise.all([removeStoredToken(), removeStoredRefreshToken(), removeStoredExpiry()]);
}

export async function getRefreshToken(): Promise<string | null> {
  if (cachedRefreshToken !== undefined) {
    return cachedRefreshToken;
  }
  return readStoredRefreshToken();
}

export async function getTokenExpiry(): Promise<Date | null> {
  const storedMs = cachedExpiryMs !== undefined ? cachedExpiryMs : await readStoredExpiry();
  if (storedMs) return new Date(storedMs);

  const token = await getToken();
  if (!token) return null;

  const jwtExpiry = decodeJwtExpiryMs(token);
  if (jwtExpiry) return new Date(jwtExpiry);

  return null;
}

export async function shouldRefreshToken(): Promise<boolean> {
  const token = getTokenSync() ?? (await getToken());
  if (!token) return false;

  const expiry = await getTokenExpiry();
  if (!expiry) return true;
  return expiry.getTime() - Date.now() < REFRESH_THRESHOLD_MS;
}

export function isAccessTokenExpired(expiry: Date | null): boolean {
  if (!expiry) return false;
  return expiry.getTime() <= Date.now();
}

export type RefreshTokenResult = "refreshed" | "skipped" | "failed" | "offline";

export async function refreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = performTokenRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function performTokenRefresh(): Promise<boolean> {
  const credential = (await getRefreshToken()) ?? (await getToken());
  if (!credential) return false;

  if (credential.startsWith("cookie_session_")) {
    const result = await completeAuthSession();
    return Boolean(result?.token);
  }

  try {
    let headerToken: string | null = null;
    const session = await authClient.getSession({
      fetchOptions: {
        credentials: "include",
        headers: apiHeaders({ Authorization: `Bearer ${credential}` }),
        onSuccess: (ctx) => {
          headerToken = ctx.response.headers.get("set-auth-token");
        },
      },
    });

    const data = session.data as SessionPayload | null;
    if (!data?.user?.id) return false;

    const cookieToken = await readTokenFromAuthCookies();
    const bodyToken = data.session?.token ?? null;
    const newToken = headerToken ?? bodyToken ?? cookieToken;
    if (!newToken) return false;

    await persistSessionCredentials(newToken, {
      refreshToken: cookieToken ?? credential,
      expiresAt: data.session?.expiresAt,
    });
    return true;
  } catch (error) {
    if (isNetworkError(error)) {
      throw error;
    }
    return false;
  }
}

export async function refreshTokenIfNeeded(): Promise<RefreshTokenResult> {
  const shouldRefresh = await shouldRefreshToken();
  if (!shouldRefresh) return "skipped";

  try {
    const refreshed = await refreshToken();
    return refreshed ? "refreshed" : "failed";
  } catch (error) {
    if (isNetworkError(error)) return "offline";
    return "failed";
  }
}

async function readTokenFromAuthCookies(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const raw = await SecureStore.getItemAsync(AUTH_COOKIE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, { value?: string }>;
    for (const [name, entry] of Object.entries(parsed)) {
      if (name.includes("session_token") && entry?.value) {
        return entry.value;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function completeAuthSession(callbackUrl?: string | null): Promise<{
  token: string;
  user: AuthUser;
} | null> {
  await persistOAuthCookieFromUrl(callbackUrl);

  const maxAttempts = Platform.OS === "web" ? 3 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await delay(500 * attempt);
    }

    let headerToken: string | null = null;
    const session = await authClient.getSession({
      fetchOptions: {
        credentials: "include",
        onSuccess: (ctx) => {
          headerToken = ctx.response.headers.get("set-auth-token");
        },
      },
    });

    const data = session.data as SessionPayload | null;
    if (!data?.user?.id) {
      if (Platform.OS === "web" && attempt < maxAttempts - 1) {
        continue;
      }
      return null;
    }

    const cookieToken = await readTokenFromAuthCookies();
    const bodyToken = data.session?.token ?? null;
    const token = headerToken ?? bodyToken ?? cookieToken;

    if (!token) {
      if (Platform.OS === "web") {
        const sessionMarker = `cookie_session_${data.user.id}`;
        await setToken(sessionMarker);
        return {
          token: sessionMarker,
          user: {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
          },
        };
      }
      throw new Error("Signed in but no API token was returned. Try again.");
    }

    await persistSessionCredentials(token, {
      refreshToken: cookieToken ?? token,
      expiresAt: data.session?.expiresAt,
    });

    return {
      token,
      user: {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
      },
    };
  }

  return null;
}

export async function ensureBearerFromExistingSession(): Promise<boolean> {
  if (getTokenSync()) return true;
  const completed = await completeAuthSession();
  return Boolean(completed?.token);
}

export async function signInWithGoogle() {
  const callbackURL = getAuthCallbackUrl();

  const { error } = await authClient.signIn.social({
    provider: "google",
    callbackURL,
  });

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "INVALID_ORIGIN" || code === "MISSING_OR_NULL_ORIGIN") {
      throw new Error(
        error.message ??
          "Sign-in blocked by server origin policy. Point EXPO_PUBLIC_API_URL at your live API URL (see docs/ENV_SETUP.md).",
      );
    }
    if (code === "INVALID_CALLBACK_URL") {
      throw new Error("Sign-in configuration error. Update the app and try again.");
    }
    throw new Error(error.message ?? "Google sign-in failed");
  }

  if (Platform.OS === "web") {
    return new Promise<{ token: string; user: AuthUser }>(() => {});
  }

  const result = await completeAuthSession();
  if (!result) {
    throw new Error("Sign-in was cancelled");
  }

  return result;
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
  await authClient.signOut().catch(() => undefined);
  await clearToken();
}
