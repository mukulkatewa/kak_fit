const LOCAL_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8081",
  "http://localhost:19006",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:19006",
  "exp://localhost:8081",
  "exp://localhost:19006",
] as const;

function parseHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    const match = url.match(/^https?:\/\/([^/:]+)/);
    return match?.[1] ?? null;
  }
}

function parseOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    const match = url.match(/^(https?:\/\/[^/]+)/);
    return match?.[1] ?? null;
  }
}

function asHttpsUrl(value: string): string {
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://${value}`;
}

/** Expo Go / web preview origins for a given host (LAN IP or localhost). */
export function expoOriginsForHost(host: string): string[] {
  return [
    `http://${host}:8081`,
    `http://${host}:19006`,
    `exp://${host}:8081`,
    `exp://${host}:19006`,
  ];
}

function addUrl(origins: Set<string>, raw: string | undefined) {
  if (!raw?.trim()) return;
  const normalized = asHttpsUrl(raw.trim());
  const origin = parseOrigin(normalized);
  if (origin) origins.add(origin);
  const host = parseHost(normalized);
  if (host) {
    for (const expoOrigin of expoOriginsForHost(host)) origins.add(expoOrigin);
  }
}

/** Origins allowed for Better Auth and API CORS (production + local + Expo). */
export function buildTrustedOrigins(): string[] {
  const origins = new Set<string>(LOCAL_ORIGINS);

  for (const raw of [
    process.env.BETTER_AUTH_URL,
    process.env.EXPO_PUBLIC_API_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    addUrl(origins, raw);
  }

  for (const extra of (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(",")) {
    const trimmed = extra.trim();
    if (!trimmed) continue;
    const origin = parseOrigin(asHttpsUrl(trimmed));
    if (origin) origins.add(origin);
  }

  return [...origins];
}

export function isLanDevOrigin(origin: string): boolean {
  return (
    /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:(8081|19006)$/.test(origin) ||
    /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:(8081|19006)$/.test(origin)
  );
}

export function isAllowedOrigin(origin: string | null, allowed: Set<string>): boolean {
  return origin != null && (allowed.has(origin) || isLanDevOrigin(origin));
}
