import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@kak-fit/api";
import { prisma } from "@kak-fit/db";
import { auth } from "@/lib/auth";

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const raw = authHeader.slice(7);
  // DB stores token id; Better Auth bearer may send id.signature
  return raw.includes(".") ? raw.split(".")[0] : raw;
}

type CachedUser = NonNullable<Awaited<ReturnType<typeof resolveBearerUser>>>;

// Short-lived in-memory cache so repeated requests on the same token skip the
// auth DB round-trip. The DB lives in a remote region, so each saved round-trip
// is ~1s. TTL is intentionally short to keep sign-out reasonably responsive.
const SESSION_CACHE_TTL_MS = 30_000;
const sessionCache = new Map<string, { user: CachedUser; expires: number }>();

async function resolveBearerUser(token: string) {
  const dbSession = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (dbSession && dbSession.expiresAt > new Date()) {
    return dbSession.user;
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
    const cached = sessionCache.get(sessionToken);
    if (cached && cached.expires > Date.now()) {
      user = cached.user;
    } else {
      user = await resolveBearerUser(sessionToken);
      if (user) {
        sessionCache.set(sessionToken, { user, expires: Date.now() + SESSION_CACHE_TTL_MS });
      } else {
        sessionCache.delete(sessionToken);
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

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
