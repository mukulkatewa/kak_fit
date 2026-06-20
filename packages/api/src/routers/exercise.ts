import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  FREE_CUSTOM_EXERCISE_LIMIT,
} from "../lib/constants";
import { getPreviousExercisePerformance } from "../services/previous-values";
import { protectedProcedure, router } from "../trpc";

const exerciseInclude = {
  category: true,
  muscles: { include: { muscle: true } },
  equipment: { include: { equipment: true } },
} as const;

export const exerciseRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          muscleId: z.string().optional(),
          categoryId: z.string().optional(),
          customOnly: z.boolean().optional(),
          cursor: z.string().optional(),
          limit: z.number().min(1).max(50).default(20),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.trim();
      const where = {
        OR: [
          { isCustom: false },
          { isCustom: true, userId: ctx.user.id },
        ],
        ...(search
          ? { name: { contains: search, mode: "insensitive" as const } }
          : {}),
        ...(input?.customOnly ? { isCustom: true, userId: ctx.user.id } : {}),
        ...(input?.categoryId ? { categoryId: input.categoryId } : {}),
        ...(input?.muscleId
          ? { muscles: { some: { muscleId: input.muscleId } } }
          : {}),
      };

      const exercises = await ctx.prisma.exercise.findMany({
        where,
        include: exerciseInclude,
        orderBy: { name: "asc" },
        take: input?.limit ?? 20,
        ...(input?.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
      });

      return exercises;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const exercise = await ctx.prisma.exercise.findFirst({
        where: {
          id: input.id,
          OR: [{ isCustom: false }, { isCustom: true, userId: ctx.user.id }],
        },
        include: exerciseInclude,
      });

      if (!exercise) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Exercise not found" });
      }

      return exercise;
    }),

  muscles: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.muscle.findMany({ orderBy: { name: "asc" } });
  }),

  categories: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.category.findMany({ orderBy: { name: "asc" } });
  }),

  createCustom: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(120),
        instructions: z.string().max(2000).optional(),
        primaryMuscleId: z.string(),
        secondaryMuscleIds: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.subscriptionTier === "FREE") {
        const count = await ctx.prisma.exercise.count({
          where: { userId: ctx.user.id, isCustom: true },
        });
        if (count >= FREE_CUSTOM_EXERCISE_LIMIT) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Free plan allows ${FREE_CUSTOM_EXERCISE_LIMIT} custom exercises`,
          });
        }
      }

      return ctx.prisma.exercise.create({
        data: {
          name: input.name.trim(),
          instructions: input.instructions,
          isCustom: true,
          userId: ctx.user.id,
          muscles: {
            create: [
              { muscleId: input.primaryMuscleId, isPrimary: true },
              ...input.secondaryMuscleIds.map((muscleId) => ({
                muscleId,
                isPrimary: false,
              })),
            ],
          },
        },
        include: exerciseInclude,
      });
    }),

  previousPerformance: protectedProcedure
    .input(z.object({ exerciseId: z.string() }))
    .query(async ({ ctx, input }) => {
      return getPreviousExercisePerformance(
        ctx.prisma,
        ctx.user.id,
        input.exerciseId,
      );
    }),
});
