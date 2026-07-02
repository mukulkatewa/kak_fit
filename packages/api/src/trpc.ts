import { TRPCError } from "@trpc/server";
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { prisma, type User } from "@kak-fit/db";

export type TRPCContext = {
  prisma: typeof prisma;
  user: User | null;
  sessionToken: string | null;
};

type CachedContextUser = { user: User; sessionExpiresAt: Date; cacheExpiresAt: number };

const SESSION_CACHE_TTL_MS = 30_000;
const sessionUserCache = new Map<string, CachedContextUser>();

function extractBearerToken(authHeader?: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const raw = authHeader.slice(7);
  return raw.includes(".") ? raw.split(".")[0] : raw;
}

function getCachedUser(token: string) {
  const cached = sessionUserCache.get(token);
  if (!cached) return null;
  const now = Date.now();
  if (cached.cacheExpiresAt <= now || cached.sessionExpiresAt <= new Date()) {
    sessionUserCache.delete(token);
    return null;
  }
  return cached.user;
}

function setCachedUser(token: string, user: User, sessionExpiresAt: Date) {
  const ttl = Math.min(SESSION_CACHE_TTL_MS, sessionExpiresAt.getTime() - Date.now());
  if (ttl <= 0) return;
  if (sessionUserCache.size > 10_000) {
    sessionUserCache.clear();
  }
  sessionUserCache.set(token, { user, sessionExpiresAt, cacheExpiresAt: Date.now() + ttl });
}

export const createTRPCContext = async (
  opts?: FetchCreateContextFnOptions,
): Promise<TRPCContext> => {
  const sessionToken = extractBearerToken(opts?.req.headers.get("authorization"));

  let user: User | null = null;

  if (sessionToken) {
    user = getCachedUser(sessionToken);
    if (!user) {
      const session = await prisma.session.findUnique({
        where: { token: sessionToken },
        include: { user: true },
      });

      if (session && session.expiresAt > new Date()) {
        user = session.user;
        setCachedUser(sessionToken, session.user, session.expiresAt);
      }
    }
  }

  return { prisma, user, sessionToken };
};

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});
