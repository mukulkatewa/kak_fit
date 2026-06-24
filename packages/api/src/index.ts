import type { inferRouterOutputs } from "@trpc/server";
import { router, publicProcedure } from "./trpc";
import { authRouter } from "./routers/auth";
import { exerciseRouter } from "./routers/exercise";
import { bodyMeasurementRouter } from "./routers/body-measurement";
import { nutritionRouter } from "./routers/nutrition";
import { progressRouter } from "./routers/progress";
import { personalRecordRouter } from "./routers/personal-record";
import { routineRouter } from "./routers/routine";
import { workoutRouter } from "./routers/workout";
import { progressPhotoRouter } from "./routers/progress-photo";
import { developerRouter } from "./routers/developer";

export const appRouter = router({
  health: publicProcedure.query(() => ({
    status: "ok" as const,
    service: "kak-fit-api",
    timestamp: new Date().toISOString(),
  })),

  version: publicProcedure.query(() => ({
    name: "Kak Fit",
    version: "0.2.0",
    phase: "Phase 2 — Progress + Nutrition",
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
  progress: progressRouter,
  bodyMeasurement: bodyMeasurementRouter,
  progressPhoto: progressPhotoRouter,
  developer: developerRouter,
});

export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export { createTRPCContext } from "./trpc";
export type { TRPCContext } from "./trpc";
