import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

const userSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
  bio: true,
  subscriptionTier: true,
  weightUnit: true,
  defaultRestSeconds: true,
} as const;

export const authRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user =
      (await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: userSelect,
      })) ?? ctx.user;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      bio: user.bio,
      subscriptionTier: user.subscriptionTier,
      weightUnit: "weightUnit" in user ? user.weightUnit : "KG",
      defaultRestSeconds: "defaultRestSeconds" in user ? user.defaultRestSeconds : 90,
    };
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(60).optional(),
        bio: z.string().max(280).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.bio !== undefined ? { bio: input.bio } : {}),
        },
        select: { id: true, name: true, email: true, image: true, bio: true },
      });
    }),

  updatePreferences: protectedProcedure
    .input(
      z.object({
        weightUnit: z.enum(["KG", "LBS"]).optional(),
        defaultRestSeconds: z.number().int().min(15).max(600).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          ...(input.weightUnit !== undefined ? { weightUnit: input.weightUnit } : {}),
          ...(input.defaultRestSeconds !== undefined
            ? { defaultRestSeconds: input.defaultRestSeconds }
            : {}),
        },
        select: userSelect,
      });
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
