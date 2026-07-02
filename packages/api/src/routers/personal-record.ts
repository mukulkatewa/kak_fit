import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

export const personalRecordRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          exerciseId: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.personalRecord.findMany({
        where: {
          userId: ctx.user.id,
          ...(input?.exerciseId ? { exerciseId: input.exerciseId } : {}),
        },
        include: {
          exercise: { select: { id: true, name: true } },
        },
        orderBy: { achievedAt: "desc" },
        take: input?.limit ?? 50,
      });
    }),

  byExercise: protectedProcedure
    .input(z.object({ exerciseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const bests = await ctx.prisma.personalRecord.groupBy({
        by: ["type"],
        where: { userId: ctx.user.id, exerciseId: input.exerciseId },
        _max: { value: true },
      });

      if (bests.length === 0) return [];

      return ctx.prisma.personalRecord.findMany({
        where: {
          userId: ctx.user.id,
          exerciseId: input.exerciseId,
          OR: bests.map((row) => ({
            type: row.type,
            value: row._max.value ?? 0,
          })),
        },
        orderBy: { achievedAt: "desc" },
      });
    }),
});
