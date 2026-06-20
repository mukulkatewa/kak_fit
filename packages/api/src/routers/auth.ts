import { protectedProcedure, router } from "../trpc";

export const authRouter = router({
  me: protectedProcedure.query(({ ctx }) => {
    return {
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      image: ctx.user.image,
      subscriptionTier: ctx.user.subscriptionTier,
    };
  }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const [workoutCount, routineCount, customExerciseCount, prCount] =
      await Promise.all([
        ctx.prisma.workout.count({
          where: { userId: ctx.user.id, finishedAt: { not: null } },
        }),
        ctx.prisma.routine.count({ where: { userId: ctx.user.id } }),
        ctx.prisma.exercise.count({
          where: { userId: ctx.user.id, isCustom: true },
        }),
        ctx.prisma.personalRecord.count({ where: { userId: ctx.user.id } }),
      ]);

    return { workoutCount, routineCount, customExerciseCount, prCount };
  }),
});
