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
      const records = await ctx.prisma.personalRecord.findMany({
        where: { userId: ctx.user.id, exerciseId: input.exerciseId },
        orderBy: { achievedAt: "desc" },
      });

      const bestByType = new Map<string, (typeof records)[number]>();
      for (const record of records) {
        if (!bestByType.has(record.type)) {
          bestByType.set(record.type, record);
        }
      }

      return Array.from(bestByType.values());
    }),
});
