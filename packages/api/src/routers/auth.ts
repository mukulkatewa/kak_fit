import { Prisma } from "@kak-fit/db";
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
    const user = ctx.user;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      bio: user.bio,
      subscriptionTier: user.subscriptionTier,
      weightUnit: user.weightUnit,
      defaultRestSeconds: user.defaultRestSeconds,
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
    const [row] = await ctx.prisma.$queryRaw<
      Array<{
        workoutCount: bigint;
        routineCount: bigint;
        customExerciseCount: bigint;
        prCount: bigint;
      }>
    >(Prisma.sql`
      SELECT
        (SELECT COUNT(*)::bigint FROM "Workout" WHERE "userId" = ${ctx.user.id} AND "finishedAt" IS NOT NULL) as "workoutCount",
        (SELECT COUNT(*)::bigint FROM "Routine" WHERE "userId" = ${ctx.user.id}) as "routineCount",
        (SELECT COUNT(*)::bigint FROM "Exercise" WHERE "userId" = ${ctx.user.id} AND "isCustom" = true) as "customExerciseCount",
        (SELECT COUNT(*)::bigint FROM "PersonalRecord" WHERE "userId" = ${ctx.user.id}) as "prCount"
    `);

    return {
      workoutCount: Number(row?.workoutCount ?? 0),
      routineCount: Number(row?.routineCount ?? 0),
      customExerciseCount: Number(row?.customExerciseCount ?? 0),
      prCount: Number(row?.prCount ?? 0),
    };
  }),
});
