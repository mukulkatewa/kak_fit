import { Platform } from "react-native";

/** API base URL — localhost on web preview, LAN IP on native device. */
export function getApiUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return envUrl.replace(/\/\/[\d.]+:/, "//localhost:");
  }
  return envUrl;
}

/**
 * Better Auth rejects requests with `Origin: null` (what React Native sends).
 * Send a trusted origin so sign-in works from Expo Go on a real phone.
 */
export function getClientOrigin(): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }

  const apiUrl = getApiUrl();
  const host = apiUrl.replace(/^https?:\/\//, "").replace(/:\d+$/, "");
  return `exp://${host}:8081`;
}

export function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Origin: getClientOrigin(),
    ...extra,
  };
}
