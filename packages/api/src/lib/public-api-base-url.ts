/** Canonical public API origin for docs links and LLM tool manifests. */
export function resolvePublicApiBaseUrl(): string {
  const trim = (url: string) => url.replace(/\/$/, "");

  if (process.env.BETTER_AUTH_URL?.trim()) return trim(process.env.BETTER_AUTH_URL.trim());
  if (process.env.EXPO_PUBLIC_API_URL?.trim()) return trim(process.env.EXPO_PUBLIC_API_URL.trim());
  if (process.env.VERCEL_URL?.trim()) return `https://${process.env.VERCEL_URL.trim()}`;

  return "http://localhost:3000";
}
