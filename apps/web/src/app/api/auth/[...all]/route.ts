import { auth } from "@/lib/auth";
import { parseBearerSessionToken, revokeSessionToken } from "@kak-fit/api";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

function revokeTokenFromRequest(req: Request) {
  const token = parseBearerSessionToken(req.headers.get("authorization"));
  if (token) revokeSessionToken(token);
}

export async function GET(req: Request) {
  return handler.GET(req);
}

export async function POST(req: Request) {
  const { pathname } = new URL(req.url);
  if (pathname.endsWith("/sign-out")) {
    revokeTokenFromRequest(req);
  }
  return handler.POST(req);
}
