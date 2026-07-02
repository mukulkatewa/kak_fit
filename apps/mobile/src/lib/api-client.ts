import { Platform } from "react-native";

function normalizeApiOrigin(url: string): string {
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    // Vercel only serves TLS — avoid baked-in http:// causing ERR_SSL_PROTOCOL_ERROR.
    if (parsed.hostname.endsWith(".vercel.app")) {
      parsed.protocol = "https:";
    }
    return parsed.origin;
  } catch {
    return url.replace(/\/$/, "");
  }
}

/** API base URL — same origin on web when UI + API share one host (Vercel). */
export function getApiUrl(): string {
  const envUrl = normalizeApiOrigin(process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000");
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const { hostname, origin } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return envUrl.replace(/\/\/[\d.]+:/, "//localhost:");
    }
    return origin;
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
  // Remote HTTPS API — use the API origin (trusted via BETTER_AUTH_URL / EXPO_PUBLIC_API_URL on server).
  if (apiUrl.startsWith("https://")) {
    try {
      return new URL(apiUrl).origin;
    } catch {
      // fall through
    }
  }

  const host = apiUrl.replace(/^https?:\/\//, "").replace(/:\d+$/, "");
  return `exp://${host}:8081`;
}

export function apiHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Origin: getClientOrigin(),
    ...extra,
  };
}
