import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { FREE_ROUTINE_LIMIT } from "../lib/constants";
import { protectedProcedure, router } from "../trpc";

const setInput = z.object({
  setNumber: z.number().int().positive(),
  targetWeight: z.number().optional(),
  targetReps: z.number().int().optional(),
  targetDuration: z.number().int().optional(),
});

const routineExerciseInput = z.object({
  exerciseId: z.string(),
  order: z.number().int().nonnegative(),
  restSeconds: z.number().int().optional(),
  notes: z.string().optional(),
  sets: z.array(setInput).min(1),
});

const routineInclude = {
  folder: true,
  exercises: {
    orderBy: { order: "asc" as const },
    include: {
      exercise: {
        include: {
          muscles: { include: { muscle: true } },
          category: true,
        },
      },
      sets: { orderBy: { setNumber: "asc" as const } },
    },
  },
} as const;

export const routineRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.routine.findMany({
      where: { userId: ctx.user.id },
      include: routineInclude,
      orderBy: { updatedAt: "desc" },
    });
  }),

  folders: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.routineFolder.findMany({
      where: { userId: ctx.user.id },
      include: { routines: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const routine = await ctx.prisma.routine.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        include: routineInclude,
      });

      if (!routine) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Routine not found" });
      }

      return routine;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100),
        notes: z.string().optional(),
        folderId: z.string().optional(),
        exercises: z.array(routineExerciseInput).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.subscriptionTier === "FREE") {
        const count = await ctx.prisma.routine.count({
          where: { userId: ctx.user.id },
        });
        if (count >= FREE_ROUTINE_LIMIT) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Free plan allows ${FREE_ROUTINE_LIMIT} routines`,
          });
        }
      }

      return ctx.prisma.routine.create({
        data: {
          userId: ctx.user.id,
          name: input.name.trim(),
          notes: input.notes,
          folderId: input.folderId,
          exercises: {
            create: input.exercises.map((ex) => ({
              exerciseId: ex.exerciseId,
              order: ex.order,
              restSeconds: ex.restSeconds,
              notes: ex.notes,
              sets: {
                create: ex.sets,
              },
            })),
          },
        },
        include: routineInclude,
      });
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.prisma.routine.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        include: {
          exercises: { include: { sets: true } },
        },
      });

      if (!source) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Routine not found" });
      }

      if (ctx.user.subscriptionTier === "FREE") {
        const count = await ctx.prisma.routine.count({
          where: { userId: ctx.user.id },
        });
        if (count >= FREE_ROUTINE_LIMIT) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Free plan allows ${FREE_ROUTINE_LIMIT} routines`,
          });
        }
      }

      return ctx.prisma.routine.create({
        data: {
          userId: ctx.user.id,
          name: `${source.name} (Copy)`,
          notes: source.notes,
          folderId: source.folderId,
          exercises: {
            create: source.exercises.map((ex) => ({
              exerciseId: ex.exerciseId,
              order: ex.order,
              restSeconds: ex.restSeconds,
              notes: ex.notes,
              sets: {
                create: ex.sets.map((set) => ({
                  setNumber: set.setNumber,
                  targetWeight: set.targetWeight,
                  targetReps: set.targetReps,
                  targetDuration: set.targetDuration,
                  setType: set.setType,
                })),
              },
            })),
          },
        },
        include: routineInclude,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const routine = await ctx.prisma.routine.findFirst({
        where: { id: input.id, userId: ctx.user.id },
      });

      if (!routine) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Routine not found" });
      }

      await ctx.prisma.routine.delete({ where: { id: input.id } });
      return { success: true };
    }),

  createFolder: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.routineFolder.create({
        data: { userId: ctx.user.id, name: input.name.trim() },
      });
    }),
});
