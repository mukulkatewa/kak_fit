import { expoClient, getSetCookie } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { getApiUrl } from "./api-client";

const AUTH_COOKIE_KEY = "better-auth_cookie";

export const authClient = createAuthClient({
  baseURL: getApiUrl(),
  fetchOptions: {
    credentials: "include",
  },
  plugins: [
    expoClient({
      scheme: "kakfit",
      storage: SecureStore,
    }),
  ],
});

/** Persist OAuth session cookies returned on the deep-link URL (Expo Go). */
export async function persistOAuthCookieFromUrl(url: string | null | undefined) {
  if (!url || Platform.OS === "web") return;
  try {
    const cookie = new URL(url).searchParams.get("cookie");
    if (!cookie) return;
    const prev = await SecureStore.getItemAsync(AUTH_COOKIE_KEY);
    const merged = getSetCookie(cookie, prev ?? undefined);
    await SecureStore.setItemAsync(AUTH_COOKIE_KEY, merged);
  } catch {
    // ignore malformed callback URLs
  }
}

export { AUTH_COOKIE_KEY };
