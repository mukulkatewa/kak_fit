import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function calcStreakWeeks(workoutDates: Date[]) {
  if (workoutDates.length === 0) return 0;

  const weeks = new Set(
    workoutDates.map((d) => {
      const w = startOfWeek(d);
      return w.toISOString().slice(0, 10);
    }),
  );

  let streak = 0;
  let cursor = startOfWeek(new Date());

  while (weeks.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 7);
  }

  return streak;
}

export const progressRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [workouts, weekWorkouts, monthPrs, nutrition] = await Promise.all([
      ctx.prisma.workout.findMany({
        where: { userId: ctx.user.id, finishedAt: { not: null } },
        select: { finishedAt: true, exercises: { include: { sets: { where: { isCompleted: true } } } } },
        orderBy: { finishedAt: "desc" },
      }),
      ctx.prisma.workout.findMany({
        where: { userId: ctx.user.id, finishedAt: { gte: weekStart } },
        include: { exercises: { include: { sets: { where: { isCompleted: true } } } } },
      }),
      ctx.prisma.personalRecord.count({
        where: { userId: ctx.user.id, achievedAt: { gte: monthStart } },
      }),
      ctx.prisma.mealLog.count({
        where: {
          userId: ctx.user.id,
          date: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
        },
      }),
    ]);

    const weekVolume = weekWorkouts.reduce((sum, w) => {
      return (
        sum +
        w.exercises.reduce(
          (es, ex) =>
            es + ex.sets.reduce((ss, s) => ss + (s.weight ?? 0) * (s.reps ?? 0), 0),
          0,
        )
      );
    }, 0);

    const finishedDates = workouts
      .map((w) => w.finishedAt)
      .filter((d): d is Date => d !== null);

    return {
      totalWorkouts: workouts.length,
      weekWorkouts: weekWorkouts.length,
      weekVolume: Math.round(weekVolume),
      streakWeeks: calcStreakWeeks(finishedDates),
      monthPrs,
      mealsLoggedToday: nutrition,
    };
  }),

  volumeHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(30).default(12) }).optional())
    .query(async ({ ctx, input }) => {
      const workouts = await ctx.prisma.workout.findMany({
        where: { userId: ctx.user.id, finishedAt: { not: null } },
        include: { exercises: { include: { sets: { where: { isCompleted: true } } } } },
        orderBy: { finishedAt: "desc" },
        take: input?.limit ?? 12,
      });

      return workouts
        .reverse()
        .map((w) => ({
          date: w.finishedAt!.toISOString(),
          label: w.finishedAt!.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          volume: Math.round(
            w.exercises.reduce(
              (sum, ex) =>
                sum + ex.sets.reduce((s, set) => s + (set.weight ?? 0) * (set.reps ?? 0), 0),
              0,
            ),
          ),
          workoutId: w.id,
          name: w.name,
        }));
    }),

  exerciseChart: protectedProcedure
    .input(z.object({ exerciseId: z.string(), limit: z.number().min(1).max(30).default(12) }))
    .query(async ({ ctx, input }) => {
      const workouts = await ctx.prisma.workout.findMany({
        where: {
          userId: ctx.user.id,
          finishedAt: { not: null },
          exercises: { some: { exerciseId: input.exerciseId } },
        },
        include: {
          exercises: {
            where: { exerciseId: input.exerciseId },
            include: { sets: { where: { isCompleted: true } } },
          },
        },
        orderBy: { finishedAt: "desc" },
        take: input.limit,
      });

      return workouts
        .reverse()
        .map((w) => {
          const sets = w.exercises[0]?.sets ?? [];
          const maxWeight = sets.reduce((max, s) => Math.max(max, s.weight ?? 0), 0);
          const totalVolume = sets.reduce((v, s) => v + (s.weight ?? 0) * (s.reps ?? 0), 0);
          return {
            date: w.finishedAt!.toISOString(),
            label: w.finishedAt!.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            maxWeight,
            volume: Math.round(totalVolume),
          };
        });
    }),

  muscleDistribution: protectedProcedure
    .input(z.object({ days: z.number().min(7).max(365).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - (input?.days ?? 30));

      const sets = await ctx.prisma.workoutSet.findMany({
        where: {
          isCompleted: true,
          workoutExercise: {
            workout: { userId: ctx.user.id, finishedAt: { gte: since } },
          },
        },
        include: {
          workoutExercise: {
            include: {
              exercise: {
                include: { muscles: { where: { isPrimary: true }, include: { muscle: true } } },
              },
            },
          },
        },
      });

      const muscleVolume = new Map<string, number>();

      for (const set of sets) {
        const vol = (set.weight ?? 0) * (set.reps ?? 0);
        const muscles = set.workoutExercise.exercise.muscles;
        if (muscles.length === 0) continue;
        const name = muscles[0]!.muscle.name;
        muscleVolume.set(name, (muscleVolume.get(name) ?? 0) + vol);
      }

      const sorted = Array.from(muscleVolume.entries())
        .map(([muscle, volume]) => ({ muscle, volume: Math.round(volume) }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 8);

      const max = sorted[0]?.volume ?? 1;
      return sorted.map((m) => ({ ...m, pct: Math.round((m.volume / max) * 100) }));
    }),

  topExercises: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(8) }).optional())
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const exercises = await ctx.prisma.workoutExercise.findMany({
        where: { workout: { userId: ctx.user.id, finishedAt: { gte: since } } },
        include: { exercise: { select: { id: true, name: true } } },
      });

      const counts = new Map<string, { id: string; name: string; count: number }>();
      for (const ex of exercises) {
        const cur = counts.get(ex.exerciseId) ?? {
          id: ex.exercise.id,
          name: ex.exercise.name,
          count: 0,
        };
        cur.count += 1;
        counts.set(ex.exerciseId, cur);
      }

      return Array.from(counts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, input?.limit ?? 8);
    }),
});
