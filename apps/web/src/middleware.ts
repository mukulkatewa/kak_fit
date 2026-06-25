import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildTrustedOrigins, isAllowedOrigin } from "./lib/trusted-origins";

const ALLOWED_ORIGINS = new Set(buildTrustedOrigins());

function corsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = isAllowedOrigin(origin, ALLOWED_ORIGINS);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, api-key, x-api-key",
    "Access-Control-Expose-Headers": "set-auth-token",
    "Access-Control-Allow-Credentials": "true",
  };

  if (isAllowed && origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
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
