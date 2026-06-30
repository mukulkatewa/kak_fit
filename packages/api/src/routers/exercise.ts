import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { normalizeExerciseName } from "../lib/exercise-name";
import {
  exerciseDetailInclude,
  globalExerciseWhere,
  listCatalogExercises,
} from "../services/exercise-catalog";
import { getPreviousExercisePerformance } from "../services/previous-values";
import { protectedProcedure, router } from "../trpc";

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
      return listCatalogExercises(ctx.prisma, {
        userId: ctx.user.id,
        search: input?.search?.trim() || undefined,
        muscleId: input?.muscleId,
        categoryId: input?.categoryId,
        customOnly: input?.customOnly,
        cursor: input?.cursor,
        limit: input?.limit ?? 20,
      });
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
          ...globalExerciseWhere(ctx.user.id),
          name: {
            in: normalized,
            mode: "insensitive",
          },
        },
        select: { id: true, name: true, hevyId: true, wgerId: true, imageUrl: true, instructions: true },
      });

      const exactByLower = new Map(candidates.map((c) => [c.name.toLowerCase(), c]));
      const normIndex = new Map<string, typeof candidates>();
      for (const c of candidates) {
        const key = normalizeExerciseName(c.name);
        const list = normIndex.get(key) ?? [];
        list.push(c);
        normIndex.set(key, list);
      }

      const unresolved = normalized.filter((n) => !exactByLower.has(n.toLowerCase()));

      let fuzzy: typeof candidates = [];
      if (unresolved.length > 0) {
        fuzzy = await ctx.prisma.exercise.findMany({
          where: {
            ...globalExerciseWhere(ctx.user.id),
            AND: {
              OR: unresolved.map((n) => ({
                name: { contains: n, mode: "insensitive" as const },
              })),
            },
          },
          select: { id: true, name: true, hevyId: true, wgerId: true, imageUrl: true, instructions: true },
        });
      }

      const resolved: Array<{ name: string; exerciseId: string; matchedName: string }> = [];
      for (const name of normalized) {
        const exact = exactByLower.get(name.toLowerCase());
        const normMatches = normIndex.get(normalizeExerciseName(name));
        const match =
          exact ??
          normMatches?.[0] ??
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
          ...globalExerciseWhere(ctx.user.id),
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
    return ctx.prisma.category.findMany({
      where: { NOT: { name: { startsWith: "Hevy:" } } },
      orderBy: { name: "asc" },
    });
  }),

  /** Hevy logging types (weight_reps, duration, etc.) for exercises imported from Hevy-only rows. */
  hevyTypes: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.category.findMany({
      where: { name: { startsWith: "Hevy:" } },
      orderBy: { name: "asc" },
    });
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
        include: exerciseDetailInclude,
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
