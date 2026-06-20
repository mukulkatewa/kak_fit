import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { syncPersonalRecords } from "../services/personal-records";
import { protectedProcedure, router } from "../trpc";

const workoutSetInput = z.object({
  setNumber: z.number().int().positive(),
  weight: z.number().optional(),
  reps: z.number().int().optional(),
  duration: z.number().int().optional(),
  notes: z.string().optional(),
  setType: z.enum(["NORMAL", "WARMUP", "DROP", "FAILURE"]).optional(),
  isCompleted: z.boolean().default(false),
});

const workoutExerciseInput = z.object({
  exerciseId: z.string(),
  order: z.number().int().nonnegative(),
  notes: z.string().optional(),
  sets: z.array(workoutSetInput).min(1),
});

const workoutDetailInclude = {
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

export const workoutRouter = router({
  active: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.workout.findFirst({
      where: { userId: ctx.user.id, finishedAt: null },
      include: workoutDetailInclude,
      orderBy: { startedAt: "desc" },
    });
  }),

  history: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).default(20),
          cursor: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const workouts = await ctx.prisma.workout.findMany({
        where: { userId: ctx.user.id, finishedAt: { not: null } },
        include: {
          exercises: {
            include: {
              exercise: { select: { name: true } },
              sets: { where: { isCompleted: true } },
            },
          },
        },
        orderBy: { finishedAt: "desc" },
        take: input?.limit ?? 20,
        ...(input?.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
      });

      return workouts.map((workout) => ({
        id: workout.id,
        name: workout.name,
        startedAt: workout.startedAt,
        finishedAt: workout.finishedAt,
        exerciseCount: workout.exercises.length,
        setCount: workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0),
        volume: workout.exercises.reduce(
          (sum, ex) =>
            sum +
            ex.sets.reduce(
              (s, set) => s + (set.weight ?? 0) * (set.reps ?? 0),
              0,
            ),
          0,
        ),
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const workout = await ctx.prisma.workout.findFirst({
        where: { id: input.id, userId: ctx.user.id },
        include: workoutDetailInclude,
      });

      if (!workout) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workout not found" });
      }

      return workout;
    }),

  startEmpty: protectedProcedure
    .input(z.object({ name: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.workout.findFirst({
        where: { userId: ctx.user.id, finishedAt: null },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Finish your active workout first",
        });
      }

      return ctx.prisma.workout.create({
        data: {
          userId: ctx.user.id,
          name: input?.name ?? "Workout",
        },
        include: workoutDetailInclude,
      });
    }),

  startFromRoutine: protectedProcedure
    .input(z.object({ routineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.workout.findFirst({
        where: { userId: ctx.user.id, finishedAt: null },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Finish your active workout first",
        });
      }

      const routine = await ctx.prisma.routine.findFirst({
        where: { id: input.routineId, userId: ctx.user.id },
        include: {
          exercises: { include: { sets: true }, orderBy: { order: "asc" } },
        },
      });

      if (!routine) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Routine not found" });
      }

      return ctx.prisma.workout.create({
        data: {
          userId: ctx.user.id,
          name: routine.name,
          exercises: {
            create: routine.exercises.map((ex) => ({
              exerciseId: ex.exerciseId,
              order: ex.order,
              notes: ex.notes,
              sets: {
                create: ex.sets.map((set) => ({
                  setNumber: set.setNumber,
                  weight: set.targetWeight,
                  reps: set.targetReps,
                  duration: set.targetDuration,
                  setType: set.setType,
                  isCompleted: false,
                })),
              },
            })),
          },
        },
        include: workoutDetailInclude,
      });
    }),

  addExercise: protectedProcedure
    .input(
      z.object({
        workoutId: z.string(),
        exerciseId: z.string(),
        sets: z.array(workoutSetInput).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workout = await ctx.prisma.workout.findFirst({
        where: {
          id: input.workoutId,
          userId: ctx.user.id,
          finishedAt: null,
        },
        include: { exercises: true },
      });

      if (!workout) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Active workout not found",
        });
      }

      const order = workout.exercises.length;

      return ctx.prisma.workoutExercise.create({
        data: {
          workoutId: workout.id,
          exerciseId: input.exerciseId,
          order,
          sets: { create: input.sets },
        },
        include: {
          exercise: true,
          sets: { orderBy: { setNumber: "asc" } },
        },
      });
    }),

  updateSet: protectedProcedure
    .input(
      z.object({
        setId: z.string(),
        weight: z.number().optional(),
        reps: z.number().int().optional(),
        duration: z.number().int().optional(),
        notes: z.string().optional(),
        setType: z.enum(["NORMAL", "WARMUP", "DROP", "FAILURE"]).optional(),
        isCompleted: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const set = await ctx.prisma.workoutSet.findFirst({
        where: {
          id: input.setId,
          workoutExercise: {
            workout: { userId: ctx.user.id, finishedAt: null },
          },
        },
      });

      if (!set) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Set not found" });
      }

      return ctx.prisma.workoutSet.update({
        where: { id: input.setId },
        data: {
          weight: input.weight,
          reps: input.reps,
          duration: input.duration,
          notes: input.notes,
          setType: input.setType,
          isCompleted: input.isCompleted,
        },
      });
    }),

  addSet: protectedProcedure
    .input(z.object({ workoutExerciseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const exercise = await ctx.prisma.workoutExercise.findFirst({
        where: {
          id: input.workoutExerciseId,
          workout: { userId: ctx.user.id, finishedAt: null },
        },
        include: { sets: { orderBy: { setNumber: "desc" }, take: 1 } },
      });

      if (!exercise) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Exercise not found" });
      }

      const lastSet = exercise.sets[0];

      return ctx.prisma.workoutSet.create({
        data: {
          workoutExerciseId: exercise.id,
          setNumber: (lastSet?.setNumber ?? 0) + 1,
          weight: lastSet?.weight,
          reps: lastSet?.reps,
          duration: lastSet?.duration,
        },
      });
    }),

  deleteSet: protectedProcedure
    .input(z.object({ setId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const set = await ctx.prisma.workoutSet.findFirst({
        where: {
          id: input.setId,
          workoutExercise: {
            workout: { userId: ctx.user.id, finishedAt: null },
          },
        },
      });

      if (!set) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Set not found" });
      }

      await ctx.prisma.workoutSet.delete({ where: { id: input.setId } });
      return { success: true };
    }),

  finish: protectedProcedure
    .input(
      z.object({
        workoutId: z.string(),
        name: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workout = await ctx.prisma.workout.findFirst({
        where: {
          id: input.workoutId,
          userId: ctx.user.id,
          finishedAt: null,
        },
        include: {
          exercises: {
            include: { sets: { where: { isCompleted: true } } },
          },
        },
      });

      if (!workout) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Active workout not found",
        });
      }

      const finished = await ctx.prisma.workout.update({
        where: { id: workout.id },
        data: {
          finishedAt: new Date(),
          name: input.name ?? workout.name,
          notes: input.notes,
        },
        include: workoutDetailInclude,
      });

      const newRecords = [];

      for (const exercise of workout.exercises) {
        const records = await syncPersonalRecords(
          ctx.prisma,
          ctx.user.id,
          exercise.exerciseId,
          exercise.sets,
        );
        newRecords.push(...records.map((r) => ({ ...r, exerciseId: exercise.exerciseId })));
      }

      return { workout: finished, newRecords };
    }),

  cancel: protectedProcedure
    .input(z.object({ workoutId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const workout = await ctx.prisma.workout.findFirst({
        where: {
          id: input.workoutId,
          userId: ctx.user.id,
          finishedAt: null,
        },
      });

      if (!workout) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workout not found" });
      }

      await ctx.prisma.workout.delete({ where: { id: workout.id } });
      return { success: true };
    }),
});
