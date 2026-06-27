import type { AcceleratedPrisma } from "@kak-fit/db";
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
    const cached = ctx.user;
    const hasProfileFields =
      cached.subscriptionTier != null &&
      cached.weightUnit != null &&
      cached.defaultRestSeconds != null;

    if (hasProfileFields) {
      return {
        id: cached.id,
        name: cached.name,
        email: cached.email,
        image: cached.image,
        bio: cached.bio,
        subscriptionTier: cached.subscriptionTier,
        weightUnit: cached.weightUnit,
        defaultRestSeconds: cached.defaultRestSeconds,
      };
    }

    const user = await (ctx.prisma as unknown as AcceleratedPrisma).user.findUnique({
      where: { id: cached.id },
      select: userSelect,
      cacheStrategy: { ttl: 60 },
    });
    if (!user) {
      return {
        id: cached.id,
        name: cached.name,
        email: cached.email,
        image: cached.image,
        bio: cached.bio,
        subscriptionTier: cached.subscriptionTier,
        weightUnit: cached.weightUnit,
        defaultRestSeconds: cached.defaultRestSeconds,
      };
    }

    return user;
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
        defaultRestSeconds: z.number().int().min(0).max(600).optional(),
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
