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
    const streakSince = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const [finishedWorkouts, totalWorkouts, weekWorkouts, monthPrs, nutrition] =
      await Promise.all([
        // Streak only needs recent finished dates — not the full set graph.
        ctx.prisma.workout.findMany({
          where: {
            userId: ctx.user.id,
            finishedAt: { not: null, gte: streakSince },
          },
          select: { finishedAt: true },
          orderBy: { finishedAt: "desc" },
          take: 730,
        }),
        ctx.prisma.workout.count({
          where: { userId: ctx.user.id, finishedAt: { not: null } },
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

    const finishedDates = finishedWorkouts
      .map((w) => w.finishedAt)
      .filter((d): d is Date => d !== null);

    return {
      totalWorkouts,
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
        .map((w) => {
          const volume = Math.round(
            w.exercises.reduce(
              (sum, ex) =>
                sum + ex.sets.reduce((s, set) => s + (set.weight ?? 0) * (set.reps ?? 0), 0),
              0,
            ),
          );
          const totalReps = w.exercises.reduce(
            (sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.reps ?? 0), 0),
            0,
          );
          const durationMinutes =
            w.startedAt && w.finishedAt
              ? Math.max(1, Math.round((w.finishedAt.getTime() - w.startedAt.getTime()) / 60_000))
              : 0;

          return {
            date: w.finishedAt!.toISOString(),
            label: w.finishedAt!.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            volume,
            totalReps,
            durationMinutes,
            workoutId: w.id,
            name: w.name,
          };
        });
    }),

  /** Volume per calendar day for the last 7 days (home dashboard chart). */
  weeklyVolume: protectedProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const since = new Date(today);
    since.setDate(since.getDate() - 6);

    const workouts = await ctx.prisma.workout.findMany({
      where: { userId: ctx.user.id, finishedAt: { gte: since, not: null } },
      include: { exercises: { include: { sets: { where: { isCompleted: true } } } } },
    });

    const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - i));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return { key, label: weekdayLabels[date.getDay()], value: 0 };
    });
    const byKey = new Map(days.map((d) => [d.key, d]));

    for (const w of workouts) {
      if (!w.finishedAt) continue;
      const d = new Date(w.finishedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const day = byKey.get(key);
      if (!day) continue;
      day.value += w.exercises.reduce(
        (sum, ex) =>
          sum + ex.sets.reduce((s, set) => s + (set.weight ?? 0) * (set.reps ?? 0), 0),
        0,
      );
    }

    return days.map(({ label, value }) => ({ label, value: Math.round(value) }));
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

      const all = Array.from(muscleVolume.entries())
        .map(([muscle, volume]) => ({ muscle, volume: Math.round(volume) }))
        .sort((a, b) => b.volume - a.volume);

      const max = all[0]?.volume ?? 1;
      const withIntensity = all.map((m) => ({
        ...m,
        pct: Math.round((m.volume / max) * 100),
        intensity: Math.min(1, m.volume / max),
      }));

      return {
        muscles: withIntensity.slice(0, 8),
        heatmap: withIntensity,
        totalVolume: Math.round(all.reduce((sum, m) => sum + m.volume, 0)),
      };
    }),

  /** Finished-workout dates + ids for the calendar (last ~12 months). */
  calendar: protectedProcedure.query(async ({ ctx }) => {
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const workouts = await ctx.prisma.workout.findMany({
      where: { userId: ctx.user.id, finishedAt: { gte: since, not: null } },
      select: { id: true, name: true, finishedAt: true },
      orderBy: { finishedAt: "desc" },
    });
    return workouts.map((w) => ({
      id: w.id,
      name: w.name,
      date: w.finishedAt!.toISOString(),
    }));
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
