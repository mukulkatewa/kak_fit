import { TRPCError } from "@trpc/server";
import { z } from "zod";
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

const routineListInclude = {
  exercises: {
    orderBy: { order: "asc" as const },
    select: {
      id: true,
      order: true,
      restSeconds: true,
      notes: true,
      exercise: { select: { id: true, name: true } },
      sets: {
        orderBy: { setNumber: "asc" as const },
        select: {
          id: true,
          setNumber: true,
          targetWeight: true,
          targetReps: true,
          targetDuration: true,
          setType: true,
        },
      },
    },
  },
} as const;

const routineDetailInclude = {
  folder: true,
  ...routineListInclude,
} as const;

export const routineRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.routine.findMany({
      where: { userId: ctx.user.id },
      include: routineListInclude,
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
        include: routineDetailInclude,
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
        include: routineListInclude,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).max(100),
        notes: z.string().optional(),
        folderId: z.string().nullable().optional(),
        exercises: z.array(routineExerciseInput).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.routine.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Routine not found" });
      }

      // Replace the exercise tree wholesale (simplest correct edit).
      return ctx.prisma.$transaction(async (tx) => {
        await tx.routineExercise.deleteMany({ where: { routineId: input.id } });
        return tx.routine.update({
          where: { id: input.id },
          data: {
            name: input.name.trim(),
            notes: input.notes,
            ...(input.folderId !== undefined ? { folderId: input.folderId } : {}),
            exercises: {
              create: input.exercises.map((ex) => ({
                exerciseId: ex.exerciseId,
                order: ex.order,
                restSeconds: ex.restSeconds,
                notes: ex.notes,
                sets: { create: ex.sets },
              })),
            },
          },
          include: routineListInclude,
        });
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
        include: routineListInclude,
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

  renameFolder: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const folder = await ctx.prisma.routineFolder.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        select: { id: true },
      });
      if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found" });
      return ctx.prisma.routineFolder.update({
        where: { id: input.id },
        data: { name: input.name.trim() },
      });
    }),

  deleteFolder: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const folder = await ctx.prisma.routineFolder.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        select: { id: true },
      });
      if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found" });
      // Routines keep existing; their folderId is set null (schema onDelete: SetNull).
      await ctx.prisma.routineFolder.delete({ where: { id: input.id } });
      return { success: true };
    }),

  setFolder: protectedProcedure
    .input(z.object({ routineId: z.string(), folderId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const routine = await ctx.prisma.routine.findFirst({
        where: { id: input.routineId, userId: ctx.user.id },
        select: { id: true },
      });
      if (!routine) throw new TRPCError({ code: "NOT_FOUND", message: "Routine not found" });
      if (input.folderId) {
        const folder = await ctx.prisma.routineFolder.findFirst({
          where: { id: input.folderId, userId: ctx.user.id },
          select: { id: true },
        });
        if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found" });
      }
      return ctx.prisma.routine.update({
        where: { id: input.routineId },
        data: { folderId: input.folderId },
      });
    }),
});
