import { router, publicProcedure } from "./trpc";
import { authRouter } from "./routers/auth";
import { exerciseRouter } from "./routers/exercise";
import { nutritionRouter } from "./routers/nutrition";
import { personalRecordRouter } from "./routers/personal-record";
import { routineRouter } from "./routers/routine";
import { workoutRouter } from "./routers/workout";

export const appRouter = router({
  health: publicProcedure.query(() => ({
    status: "ok" as const,
    service: "kak-fit-api",
    timestamp: new Date().toISOString(),
  })),

  version: publicProcedure.query(() => ({
    name: "Kak Fit",
    version: "0.2.0",
    phase: "Phase 1 — Core Workout Engine",
  })),

  exerciseCount: publicProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.exercise.count({ where: { isCustom: false } });
    return { count };
  }),

  auth: authRouter,
  exercise: exerciseRouter,
  routine: routineRouter,
  workout: workoutRouter,
  personalRecord: personalRecordRouter,
  nutrition: nutritionRouter,
});

export type AppRouter = typeof appRouter;

export { createTRPCContext } from "./trpc";
export type { TRPCContext } from "./trpc";
