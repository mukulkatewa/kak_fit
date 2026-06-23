import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LOCAL_ORIGINS = new Set([
  "http://localhost:8081",
  "http://localhost:19006",
  "http://127.0.0.1:8081",
]);

function parseHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    const match = url.match(/^https?:\/\/([^/:]+)/);
    return match?.[1] ?? null;
  }
}

function expoOriginsForHost(host: string): string[] {
  return [
    `http://${host}:8081`,
    `http://${host}:19006`,
    `exp://${host}:8081`,
    `exp://${host}:19006`,
  ];
}

function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>(LOCAL_ORIGINS);

  for (const envUrl of [
    process.env.BETTER_AUTH_URL,
    process.env.EXPO_PUBLIC_API_URL,
  ]) {
    if (!envUrl) continue;
    try {
      const parsed = new URL(envUrl);
      origins.add(parsed.origin);
      const host = parsed.hostname;
      for (const origin of expoOriginsForHost(host)) origins.add(origin);
    } catch {
      const host = parseHost(envUrl);
      if (host) {
        for (const origin of expoOriginsForHost(host)) origins.add(origin);
      }
    }
  }

  for (const extra of (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(",")) {
    const trimmed = extra.trim();
    if (trimmed) origins.add(trimmed);
  }

  return origins;
}

const ALLOWED_ORIGINS = buildAllowedOrigins();

function isLanDevOrigin(origin: string): boolean {
  return (
    /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:(8081|19006)$/.test(origin) ||
    /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:(8081|19006)$/.test(origin)
  );
}

function corsHeaders(origin: string | null) {
  const isAllowed =
    origin && (ALLOWED_ORIGINS.has(origin) || isLanDevOrigin(origin));

  const allowed = isAllowed ? origin! : "http://localhost:8081";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Expose-Headers": "set-auth-token",
    "Access-Control-Allow-Credentials": "true",
  };
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(corsHeaders(origin))) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
