import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";

export const createTRPCContext = async () => {
  return {};
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  health: publicProcedure.query(() => {
    return {
      status: "ok" as const,
      service: "kak-fit-api",
      timestamp: new Date().toISOString(),
    };
  }),

  version: publicProcedure.query(() => {
    return {
      name: "Kak Fit",
      version: "0.1.0",
      phase: "Phase 0 — Foundation",
    };
  }),
});

export type AppRouter = typeof appRouter;
