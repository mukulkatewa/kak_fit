import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = new Set([
  "http://localhost:8081",
  "http://localhost:19006",
  "http://127.0.0.1:8081",
]);

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
