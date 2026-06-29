import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { apiHeaders, getApiUrl } from "./api-client";
import { authClient } from "./auth-client";

const TOKEN_KEY = "kak_fit_token";

/** OAuth return path — no parentheses (Better Auth rejects `/(tabs)`-style paths). */
export const AUTH_CALLBACK_PATH = "/login-callback";

/** Deep link the in-app browser returns to after Google sign-in. */
export function getAuthCallbackUrl(): string {
  if (Platform.OS === "web") {
    return `${getApiUrl()}${AUTH_CALLBACK_PATH}`;
  }
  // Let Expo pick exp:// in Expo Go or kakfit:// in dev/production builds.
  return Linking.createURL(AUTH_CALLBACK_PATH);
}

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

/** Pull bearer token from Better Auth session (for tRPC after OAuth). */
async function syncBearerFromSession(): Promise<string> {
  let capturedToken: string | null = null;

  await authClient.getSession({
    fetchOptions: {
      onSuccess: (ctx) => {
        capturedToken = ctx.response.headers.get("set-auth-token");
      },
    },
  });

  if (!capturedToken) {
    throw new Error("No session token returned after sign-in");
  }

  await setToken(capturedToken);
  return capturedToken;
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

  const session = await authClient.getSession();
  if (!session.data?.user) {
    throw new Error("Sign-in was cancelled");
  }

  const token = await syncBearerFromSession();
  const user = session.data.user;

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email },
  };
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
