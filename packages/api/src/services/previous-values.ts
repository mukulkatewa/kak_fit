import type { PrismaClient } from "@kak-fit/db";

export type PreviousSetValues = {
  setNumber: number;
  weight: number | null;
  reps: number | null;
  duration: number | null;
};

export type PreviousExerciseSession = {
  workoutName: string | null;
  finishedAt: Date | null;
  sets: PreviousSetValues[];
};

async function fetchPreviousSession(
  prisma: PrismaClient,
  userId: string,
  exerciseId: string,
): Promise<PreviousExerciseSession | null> {
  const lastWorkout = await prisma.workout.findFirst({
    where: {
      userId,
      finishedAt: { not: null },
      exercises: { some: { exerciseId } },
    },
    orderBy: { finishedAt: "desc" },
    include: {
      exercises: {
        where: { exerciseId },
        include: {
          sets: {
            where: { isCompleted: true },
            orderBy: { setNumber: "asc" },
          },
        },
      },
    },
  });

  if (!lastWorkout) return null;

  const sets = lastWorkout.exercises[0]?.sets ?? [];
  if (sets.length === 0) return null;

  return {
    workoutName: lastWorkout.name,
    finishedAt: lastWorkout.finishedAt,
    sets: sets.map((set) => ({
      setNumber: set.setNumber,
      weight: set.weight,
      reps: set.reps,
      duration: set.duration,
    })),
  };
}

export function getSetPreviousValues(
  session: PreviousExerciseSession | null | undefined,
  setNumber: number,
): PreviousSetValues | null {
  if (!session) return null;
  return session.sets.find((s) => s.setNumber === setNumber) ?? session.sets[session.sets.length - 1] ?? null;
}

export async function getPreviousExercisePerformance(
  prisma: PrismaClient,
  userId: string,
  exerciseId: string,
) {
  const session = await fetchPreviousSession(prisma, userId, exerciseId);
  if (!session) return null;

  const best = session.sets.reduce<(typeof session.sets)[0] | null>((top, set) => {
    const vol = (set.weight ?? 0) * (set.reps ?? 0);
    const topVol = top ? (top.weight ?? 0) * (top.reps ?? 0) : 0;
    return vol > topVol ? set : top;
  }, null);

  const highlight = best ?? session.sets[session.sets.length - 1]!;

  return {
    weight: highlight.weight,
    reps: highlight.reps,
    duration: highlight.duration,
    finishedAt: session.finishedAt,
    workoutName: session.workoutName,
    sets: session.sets,
  };
}

export async function getPreviousExerciseSets(
  prisma: PrismaClient,
  userId: string,
  exerciseId: string,
) {
  return fetchPreviousSession(prisma, userId, exerciseId);
}

export async function getPreviousSetsBatch(
  prisma: PrismaClient,
  userId: string,
  exerciseIds: string[],
) {
  if (exerciseIds.length === 0) return {};

  const result = Object.fromEntries(exerciseIds.map((id) => [id, null])) as Record<
    string,
    PreviousExerciseSession | null
  >;

  const workoutExercises = await prisma.workoutExercise.findMany({
    where: {
      exerciseId: { in: exerciseIds },
      workout: { userId, finishedAt: { not: null } },
      sets: { some: { isCompleted: true } },
    },
    include: {
      sets: {
        where: { isCompleted: true },
        orderBy: { setNumber: "asc" },
        select: {
          setNumber: true,
          weight: true,
          reps: true,
          duration: true,
        },
      },
      workout: { select: { name: true, finishedAt: true } },
    },
    orderBy: { workout: { finishedAt: "desc" } },
  });

  const filled = new Set<string>();
  for (const entry of workoutExercises) {
    if (filled.has(entry.exerciseId)) continue;
    if (entry.sets.length === 0) continue;

    result[entry.exerciseId] = {
      workoutName: entry.workout.name,
      finishedAt: entry.workout.finishedAt,
      sets: entry.sets.map((set) => ({
        setNumber: set.setNumber,
        weight: set.weight,
        reps: set.reps,
        duration: set.duration,
      })),
    };
    filled.add(entry.exerciseId);
  }

  return result;
}
