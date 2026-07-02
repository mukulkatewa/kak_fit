import type { AcceleratedPrisma, PrismaClient } from "@kak-fit/db";

export const workoutDetailInclude = {
  exercises: {
    orderBy: { order: "asc" as const },
    include: {
      exercise: { select: { id: true, name: true, imageUrl: true, media: { take: 1, orderBy: { displayOrder: "asc" as const }, select: { storageUrl: true, thumbnailUrl: true } } } },
      sets: { orderBy: { setNumber: "asc" as const } },
    },
  },
} as const;

const workoutSummarySelect = {
  id: true,
  name: true,
  startedAt: true,
  finishedAt: true,
  notes: true,
  completedSetCount: true,
  totalVolume: true,
  _count: {
    select: {
      exercises: true,
    },
  },
} as const;

export type WorkoutHistoryInput = {
  limit?: number;
  cursor?: string;
  includeDetails?: boolean;
};

export type WorkoutSummary = {
  id: string;
  name: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  exerciseCount: number;
  setCount: number;
  volume: number;
};

export type WorkoutHistoryPage = {
  items: WorkoutSummary[];
  nextCursor: string | null;
};

type WorkoutRow = {
  id: string;
  name: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  notes: string | null;
  completedSetCount: number | null;
  totalVolume: number | null;
  _count: { exercises: number };
};

/** Uses @@index([userId, finishedAt(sort: Desc)]) for user-scoped history ordered by finishedAt DESC. */
export async function queryWorkoutHistoryPage(
  prisma: PrismaClient,
  userId: string,
  input?: WorkoutHistoryInput,
  options?: { cache?: boolean },
): Promise<WorkoutHistoryPage> {
  const limit = input?.limit ?? 20;
  const accelerated = prisma as unknown as AcceleratedPrisma;

  const cursorWorkout = input?.cursor
    ? await prisma.workout.findFirst({
        where: { id: input.cursor, userId, finishedAt: { not: null } },
        select: { id: true, finishedAt: true },
      })
    : null;

  const rows = await accelerated.workout.findMany({
    where: {
      userId,
      finishedAt: { not: null },
      ...(cursorWorkout?.finishedAt
        ? {
            OR: [
              { finishedAt: { lt: cursorWorkout.finishedAt } },
              { finishedAt: cursorWorkout.finishedAt, id: { lt: cursorWorkout.id } },
            ],
          }
        : {}),
    },
    select: workoutSummarySelect,
    orderBy: [{ finishedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(options?.cache !== false
      ? { cacheStrategy: { ttl: 60, swr: 300 } }
      : {}),
  });

  const hasMore = rows.length > limit;
  const pageRows = (hasMore ? rows.slice(0, limit) : rows) as unknown as WorkoutRow[];
  const workoutIds = pageRows.map((row) => row.id);

  const legacyIds = pageRows
    .filter((row) => row.completedSetCount == null || row.totalVolume == null)
    .map((row) => row.id);
  const batchStats =
    legacyIds.length > 0 ? await batchWorkoutSetStats(prisma, legacyIds) : new Map();

  const items = pageRows.map((row) => {
    const hasDenormStats = row.completedSetCount != null && row.totalVolume != null;
    const stat = hasDenormStats
      ? { setCount: row.completedSetCount!, volume: row.totalVolume! }
      : batchStats.get(row.id);
    return toWorkoutSummary(row, stat);
  });

  if (input?.includeDetails && workoutIds.length > 0) {
    await attachWorkoutDetails(prisma, items, workoutIds);
  }

  return {
    items,
    nextCursor: hasMore ? pageRows[pageRows.length - 1]!.id : null,
  };
}

export async function getWorkoutWithDetails(
  prisma: PrismaClient,
  userId: string,
  workoutId: string,
) {
  return prisma.workout.findFirst({
    where: { id: workoutId, userId },
    include: workoutDetailInclude,
  });
}

async function batchWorkoutSetStats(prisma: PrismaClient, workoutIds: string[]) {
  const stats = new Map<string, { setCount: number; volume: number }>();
  if (workoutIds.length === 0) return stats;

  const sets = await prisma.workoutSet.findMany({
    where: {
      isCompleted: true,
      workoutExercise: { workoutId: { in: workoutIds } },
    },
    select: {
      weight: true,
      reps: true,
      workoutExercise: { select: { workoutId: true } },
    },
  });

  for (const set of sets) {
    const workoutId = set.workoutExercise.workoutId;
    const current = stats.get(workoutId) ?? { setCount: 0, volume: 0 };
    current.setCount += 1;
    current.volume += (set.weight ?? 0) * (set.reps ?? 0);
    stats.set(workoutId, current);
  }

  return stats;
}

function toWorkoutSummary(
  row: WorkoutRow,
  stat?: { setCount: number; volume: number },
): WorkoutSummary {
  return {
    id: row.id,
    name: row.name,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    exerciseCount: row._count.exercises,
    setCount: stat?.setCount ?? 0,
    volume: stat?.volume ?? 0,
  };
}

async function attachWorkoutDetails(
  prisma: PrismaClient,
  items: WorkoutSummary[],
  workoutIds: string[],
) {
  const detailed = await prisma.workout.findMany({
    where: { id: { in: workoutIds } },
    include: workoutDetailInclude,
  });
  const byId = new Map(detailed.map((workout) => [workout.id, workout]));

  for (const item of items) {
    const workout = byId.get(item.id);
    if (!workout) continue;
    Object.assign(item, { details: workout });
  }
}
