import "@/lib/env-check";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@kak-fit/api";
import { prisma } from "@kak-fit/db";
import { auth } from "@/lib/auth";
import {
  deleteCachedSessionUser,
  getCachedSessionUser,
  setCachedSessionUser,
} from "@/lib/session-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const raw = authHeader.slice(7);
  // DB stores token id; Better Auth bearer may send id.signature
  return raw.includes(".") ? raw.split(".")[0] : raw;
}

async function resolveBearerUser(token: string) {
  const dbSession = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (dbSession && dbSession.expiresAt > new Date()) {
    return { user: dbSession.user, expiresAt: dbSession.expiresAt };
  }
  return null;
}

const createContext = async (opts: { req: Request }) => {
  let user = null;
  const sessionToken = extractBearerToken(opts.req);

  // Mobile sends a Bearer token: resolve the full user in a SINGLE query
  // (the previous code did getSession + a redundant user.findUnique, i.e.
  // 2-3 round-trips to a distant DB on every request).
  if (sessionToken) {
    user = getCachedSessionUser(sessionToken);
    if (!user) {
      const resolved = await resolveBearerUser(sessionToken);
      if (resolved) {
        user = resolved.user;
        setCachedSessionUser(sessionToken, resolved.user, resolved.expiresAt);
      } else {
        deleteCachedSessionUser(sessionToken);
      }
    }
  } else {
    // Web cookie path: let Better Auth resolve the session.
    const session = await auth.api.getSession({ headers: opts.req.headers });
    if (session?.user?.id) {
      user = await prisma.user.findUnique({ where: { id: session.user.id } });
    }
  }

  return { prisma, user, sessionToken };
};

const handler = async (req: Request) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

  if (req.method === "GET" && response.ok) {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "private, no-cache");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return response;
};

export { handler as GET, handler as POST };
