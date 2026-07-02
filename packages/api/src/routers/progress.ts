import { Prisma } from "@kak-fit/db";
import { z } from "zod";
import { startOfUserDay } from "../lib/timezone";
import { protectedProcedure, router } from "../trpc";

function toNumber(value: bigint | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "bigint" ? Number(value) : Number(value);
}

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
  dashboard: protectedProcedure
    .input(z.object({ timezoneOffsetMinutes: z.number().int().optional() }).optional())
    .query(async ({ ctx, input }) => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const streakSince = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const startOfToday = startOfUserDay(now, input?.timezoneOffsetMinutes);

    const [finishedWorkouts, totalWorkouts, weekStats, monthPrs, nutrition] =
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
        ctx.prisma.$queryRaw<Array<{ weekWorkouts: bigint; weekVolume: number | bigint }>>(
          Prisma.sql`
            SELECT
              COUNT(DISTINCT w.id) as "weekWorkouts",
              COALESCE(SUM(COALESCE(ws.weight, 0) * COALESCE(ws.reps, 0)), 0) as "weekVolume"
            FROM "Workout" w
            LEFT JOIN "WorkoutExercise" we ON we."workoutId" = w.id
            LEFT JOIN "WorkoutSet" ws ON ws."workoutExerciseId" = we.id AND ws."isCompleted" = true
            WHERE w."userId" = ${ctx.user.id}
              AND w."finishedAt" >= ${weekStart}
              AND w."finishedAt" IS NOT NULL
          `,
        ),
        ctx.prisma.personalRecord.count({
          where: { userId: ctx.user.id, achievedAt: { gte: monthStart } },
        }),
        ctx.prisma.mealLog.count({
          where: {
            userId: ctx.user.id,
            date: { gte: startOfToday },
          },
        }),
      ]);

    const weekWorkouts = toNumber(weekStats[0]?.weekWorkouts ?? 0);
    const weekVolume = Math.round(toNumber(weekStats[0]?.weekVolume ?? 0));

    const finishedDates = finishedWorkouts
      .map((w) => w.finishedAt)
      .filter((d): d is Date => d !== null);

    return {
      totalWorkouts,
      weekWorkouts,
      weekVolume,
      streakWeeks: calcStreakWeeks(finishedDates),
      monthPrs,
      mealsLoggedToday: nutrition,
    };
  }),

  volumeHistory: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(30).default(12) }).optional())
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 12;

      const rows = await ctx.prisma.$queryRaw<
        Array<{
          id: string;
          name: string | null;
          finishedAt: Date;
          volume: number | bigint;
          totalReps: number | bigint;
          durationMinutes: number | null;
        }>
      >(Prisma.sql`
        SELECT w.id, w.name, w."finishedAt",
          COALESCE(SUM(COALESCE(ws.weight, 0) * COALESCE(ws.reps, 0)), 0) as volume,
          COALESCE(SUM(COALESCE(ws.reps, 0)), 0) as "totalReps",
          EXTRACT(EPOCH FROM (w."finishedAt" - w."startedAt")) / 60 as "durationMinutes"
        FROM "Workout" w
        LEFT JOIN "WorkoutExercise" we ON we."workoutId" = w.id
        LEFT JOIN "WorkoutSet" ws ON ws."workoutExerciseId" = we.id AND ws."isCompleted" = true
        WHERE w."userId" = ${ctx.user.id} AND w."finishedAt" IS NOT NULL
        GROUP BY w.id
        ORDER BY w."finishedAt" DESC
        LIMIT ${limit}
      `);

      return rows
        .reverse()
        .map((w) => {
          const finishedAt = w.finishedAt;
          const durationMinutes =
            w.durationMinutes != null
              ? Math.max(1, Math.round(toNumber(w.durationMinutes)))
              : 0;

          return {
            date: finishedAt.toISOString(),
            label: finishedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
            volume: Math.round(toNumber(w.volume)),
            totalReps: toNumber(w.totalReps),
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

    const rows = await ctx.prisma.$queryRaw<Array<{ day_key: string; volume: number | bigint }>>(
      Prisma.sql`
        SELECT
          to_char(w."finishedAt", 'YYYY-MM-DD') as day_key,
          COALESCE(SUM(COALESCE(ws.weight, 0) * COALESCE(ws.reps, 0)), 0) as volume
        FROM "Workout" w
        LEFT JOIN "WorkoutExercise" we ON we."workoutId" = w.id
        LEFT JOIN "WorkoutSet" ws ON ws."workoutExerciseId" = we.id AND ws."isCompleted" = true
        WHERE w."userId" = ${ctx.user.id}
          AND w."finishedAt" >= ${since}
          AND w."finishedAt" IS NOT NULL
        GROUP BY to_char(w."finishedAt", 'YYYY-MM-DD')
      `,
    );

    const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - i));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return { key, label: weekdayLabels[date.getDay()], value: 0 };
    });
    const byKey = new Map(days.map((d) => [d.key, d]));

    for (const row of rows) {
      const day = byKey.get(row.day_key);
      if (!day) continue;
      day.value += toNumber(row.volume);
    }

    return days.map(({ label, value }) => ({ label, value: Math.round(value) }));
  }),

  exerciseChart: protectedProcedure
    .input(z.object({ exerciseId: z.string(), limit: z.number().min(1).max(30).default(12) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.$queryRaw<
        Array<{ finishedAt: Date; maxWeight: number | bigint | null; volume: number | bigint | null }>
      >(Prisma.sql`
        SELECT
          w."finishedAt" as "finishedAt",
          COALESCE(MAX(COALESCE(ws.weight, 0)), 0) as "maxWeight",
          COALESCE(SUM(COALESCE(ws.weight, 0) * COALESCE(ws.reps, 0)), 0) as volume
        FROM "Workout" w
        JOIN "WorkoutExercise" we ON we."workoutId" = w.id
        LEFT JOIN "WorkoutSet" ws ON ws."workoutExerciseId" = we.id AND ws."isCompleted" = true
        WHERE w."userId" = ${ctx.user.id}
          AND w."finishedAt" IS NOT NULL
          AND we."exerciseId" = ${input.exerciseId}
        GROUP BY w.id, w."finishedAt"
        ORDER BY w."finishedAt" DESC
        LIMIT ${input.limit}
      `);

      return rows.reverse().map((row) => ({
        date: row.finishedAt.toISOString(),
        label: row.finishedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        maxWeight: toNumber(row.maxWeight),
        volume: Math.round(toNumber(row.volume)),
      }));
    }),

  muscleDistribution: protectedProcedure
    .input(z.object({ days: z.number().min(7).max(365).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - (input?.days ?? 30));

      const rows = await ctx.prisma.$queryRaw<Array<{ muscle: string; volume: number | bigint }>>(
        Prisma.sql`
          SELECT m.name as muscle, SUM(COALESCE(ws.weight, 0) * COALESCE(ws.reps, 0)) as volume
          FROM "WorkoutSet" ws
          JOIN "WorkoutExercise" we ON ws."workoutExerciseId" = we.id
          JOIN "Workout" w ON we."workoutId" = w.id
          JOIN "ExerciseMuscle" em ON we."exerciseId" = em."exerciseId" AND em."isPrimary" = true
          JOIN "Muscle" m ON em."muscleId" = m.id
          WHERE w."userId" = ${ctx.user.id}
            AND w."finishedAt" >= ${since}
            AND ws."isCompleted" = true
          GROUP BY m.name
          ORDER BY volume DESC
        `,
      );

      const all = rows.map((row) => ({
        muscle: row.muscle,
        volume: Math.round(toNumber(row.volume)),
      }));

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
      const limit = input?.limit ?? 8;

      return ctx.prisma.$queryRaw<Array<{ id: string; name: string; count: number | bigint }>>(
        Prisma.sql`
          SELECT e.id, e.name, COUNT(*) as count
          FROM "WorkoutExercise" we
          JOIN "Exercise" e ON we."exerciseId" = e.id
          JOIN "Workout" w ON we."workoutId" = w.id
          WHERE w."userId" = ${ctx.user.id} AND w."finishedAt" >= ${since}
          GROUP BY e.id, e.name
          ORDER BY count DESC
          LIMIT ${limit}
        `,
      ).then((rows) =>
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          count: toNumber(row.count),
        })),
      );
    }),
});
