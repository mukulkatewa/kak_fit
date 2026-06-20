import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

export const bodyMeasurementRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.bodyMeasurement.findMany({
        where: { userId: ctx.user.id },
        orderBy: { date: "desc" },
        take: input?.limit ?? 30,
      });
    }),

  chart: protectedProcedure
    .input(z.object({ field: z.enum(["weight", "bodyFat", "waist", "chest", "arms"]), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.bodyMeasurement.findMany({
        where: { userId: ctx.user.id },
        orderBy: { date: "desc" },
        take: input.limit,
      });

      return rows
        .reverse()
        .filter((r) => r[input.field] != null)
        .map((r) => ({
          date: r.date.toISOString(),
          label: r.date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          value: r[input.field]!,
        }));
    }),

  latest: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.bodyMeasurement.findFirst({
      where: { userId: ctx.user.id },
      orderBy: { date: "desc" },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        weight: z.number().positive().optional(),
        bodyFat: z.number().min(0).max(100).optional(),
        waist: z.number().positive().optional(),
        chest: z.number().positive().optional(),
        arms: z.number().positive().optional(),
        date: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.weight && !input.bodyFat && !input.waist && !input.chest && !input.arms) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Provide at least one measurement" });
      }

      return ctx.prisma.bodyMeasurement.create({
        data: {
          userId: ctx.user.id,
          date: input.date ? new Date(input.date) : new Date(),
          weight: input.weight,
          bodyFat: input.bodyFat,
          waist: input.waist,
          chest: input.chest,
          arms: input.arms,
        },
      });
    }),
});
