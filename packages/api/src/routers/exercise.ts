import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getPreviousExercisePerformance } from "../services/previous-values";
import { protectedProcedure, router } from "../trpc";

const exerciseListInclude = {
  category: { select: { id: true, name: true } },
  muscles: {
    where: { isPrimary: true },
    take: 1,
    include: { muscle: { select: { id: true, name: true } } },
  },
} as const;

const exerciseDetailInclude = {
  category: { select: { id: true, name: true } },
  muscles: {
    include: { muscle: { select: { id: true, name: true } } },
    orderBy: { isPrimary: "desc" as const },
  },
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
        include: exerciseListInclude,
        orderBy: { name: "asc" },
        take: input?.limit ?? 20,
        ...(input?.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
      });

      return exercises;
    }),

  /**
   * Resolve many exercise names to ids in ONE query. Used when importing
   * program/category templates so saving a routine is a single round-trip
   * instead of one search request per exercise.
   */
  resolveByNames: protectedProcedure
    .input(z.object({ names: z.array(z.string().min(1)).min(1).max(60) }))
    .query(async ({ ctx, input }) => {
      const normalized = input.names.map((n) => n.trim()).filter(Boolean);

      const candidates = await ctx.prisma.exercise.findMany({
        where: {
          OR: [{ isCustom: false }, { isCustom: true, userId: ctx.user.id }],
          name: {
            in: normalized,
            mode: "insensitive",
          },
        },
        select: { id: true, name: true },
      });

      // Fall back to a contains match for names that had no exact hit.
      const exactByLower = new Map(candidates.map((c) => [c.name.toLowerCase(), c]));
      const unresolved = normalized.filter((n) => !exactByLower.has(n.toLowerCase()));

      let fuzzy: { id: string; name: string }[] = [];
      if (unresolved.length > 0) {
        fuzzy = await ctx.prisma.exercise.findMany({
          where: {
            OR: [{ isCustom: false }, { isCustom: true, userId: ctx.user.id }],
            AND: { OR: unresolved.map((n) => ({ name: { contains: n, mode: "insensitive" as const } })) },
          },
          select: { id: true, name: true },
        });
      }

      const resolved: Array<{ name: string; exerciseId: string; matchedName: string }> = [];
      for (const name of normalized) {
        const exact = exactByLower.get(name.toLowerCase());
        const match =
          exact ??
          fuzzy.find((f) => f.name.toLowerCase().includes(name.toLowerCase())) ??
          fuzzy.find((f) => name.toLowerCase().includes(f.name.toLowerCase()));
        if (match) {
          resolved.push({ name, exerciseId: match.id, matchedName: match.name });
        }
      }

      return resolved;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const exercise = await ctx.prisma.exercise.findFirst({
        where: {
          id: input.id,
          OR: [{ isCustom: false }, { isCustom: true, userId: ctx.user.id }],
        },
        include: exerciseDetailInclude,
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
        include: exerciseListInclude,
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
