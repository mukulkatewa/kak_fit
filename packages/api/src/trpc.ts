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

export const createTRPCContext = async (
  opts?: FetchCreateContextFnOptions,
): Promise<TRPCContext> => {
  const authHeader = opts?.req.headers.get("authorization");
  const sessionToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  let user: User | null = null;

  if (sessionToken) {
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true },
    });

    if (session && session.expiresAt > new Date()) {
      user = session.user;
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
