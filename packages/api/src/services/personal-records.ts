import type { PersonalRecordType, PrismaClient } from "@kak-fit/db";
import { estimateOneRepMax, setVolume } from "../lib/constants";

export type CompletedSet = {
  id: string;
  weight: number | null;
  reps: number | null;
  duration: number | null;
};

export type NewRecord = {
  type: PersonalRecordType;
  value: number;
  workoutSetId: string;
};

type BestRecord = { value: number; setId: string };

const EMPTY_BEST: Record<PersonalRecordType, BestRecord> = {
  MAX_WEIGHT: { value: 0, setId: "" },
  MAX_REPS: { value: 0, setId: "" },
  MAX_VOLUME: { value: 0, setId: "" },
  MAX_DURATION: { value: 0, setId: "" },
  ESTIMATED_1RM: { value: 0, setId: "" },
};

/** Single-pass O(n) best-record scan — used by full recalc and benchmarks. */
export function computeBestRecords(sets: CompletedSet[]): Record<PersonalRecordType, BestRecord> {
  const best: Record<PersonalRecordType, BestRecord> = {
    MAX_WEIGHT: { ...EMPTY_BEST.MAX_WEIGHT },
    MAX_REPS: { ...EMPTY_BEST.MAX_REPS },
    MAX_VOLUME: { ...EMPTY_BEST.MAX_VOLUME },
    MAX_DURATION: { ...EMPTY_BEST.MAX_DURATION },
    ESTIMATED_1RM: { ...EMPTY_BEST.ESTIMATED_1RM },
  };

  for (const set of sets) {
    if (set.weight && set.weight > best.MAX_WEIGHT.value) {
      best.MAX_WEIGHT = { value: set.weight, setId: set.id };
    }
    if (set.reps && set.reps > best.MAX_REPS.value) {
      best.MAX_REPS = { value: set.reps, setId: set.id };
    }
    const volume = setVolume(set.weight, set.reps);
    if (volume > best.MAX_VOLUME.value) {
      best.MAX_VOLUME = { value: volume, setId: set.id };
    }
    if (set.duration && set.duration > best.MAX_DURATION.value) {
      best.MAX_DURATION = { value: set.duration, setId: set.id };
    }
    if (set.weight && set.reps) {
      const oneRm = estimateOneRepMax(set.weight, set.reps);
      if (oneRm > best.ESTIMATED_1RM.value) {
        best.ESTIMATED_1RM = { value: oneRm, setId: set.id };
      }
    }
  }

  return best;
}

function bestRecordsToRows(
  userId: string,
  exerciseId: string,
  best: Record<PersonalRecordType, BestRecord>,
): Array<{
  userId: string;
  exerciseId: string;
  type: PersonalRecordType;
  value: number;
  workoutSetId: string;
}> {
  return (Object.entries(best) as [PersonalRecordType, BestRecord][])
    .filter(([, record]) => record.value > 0 && record.setId)
    .map(([type, record]) => ({
      userId,
      exerciseId,
      type,
      value: record.value,
      workoutSetId: record.setId,
    }));
}

async function fetchCurrentPrMaxMap(
  prisma: PrismaClient,
  userId: string,
  exerciseId: string,
): Promise<Map<PersonalRecordType, number>> {
  const grouped = await prisma.personalRecord.groupBy({
    by: ["type"],
    where: { userId, exerciseId },
    _max: { value: true },
  });

  return new Map(
    grouped.map((row) => [row.type, row._max.value ?? 0]),
  );
}

/** Build PR candidates for one completed set against current bests. */
export function buildIncrementalCandidates(
  set: CompletedSet,
  currentBest: Map<PersonalRecordType, number>,
): NewRecord[] {
  const candidates: NewRecord[] = [];

  if (set.weight && set.weight > (currentBest.get("MAX_WEIGHT") ?? 0)) {
    candidates.push({ type: "MAX_WEIGHT", value: set.weight, workoutSetId: set.id });
  }
  if (set.reps && set.reps > (currentBest.get("MAX_REPS") ?? 0)) {
    candidates.push({ type: "MAX_REPS", value: set.reps, workoutSetId: set.id });
  }
  const volume = setVolume(set.weight, set.reps);
  if (volume > (currentBest.get("MAX_VOLUME") ?? 0)) {
    candidates.push({ type: "MAX_VOLUME", value: volume, workoutSetId: set.id });
  }
  if (set.duration && set.duration > (currentBest.get("MAX_DURATION") ?? 0)) {
    candidates.push({ type: "MAX_DURATION", value: set.duration, workoutSetId: set.id });
  }
  if (set.weight && set.reps) {
    const oneRm = estimateOneRepMax(set.weight, set.reps);
    if (oneRm > (currentBest.get("ESTIMATED_1RM") ?? 0)) {
      candidates.push({ type: "ESTIMATED_1RM", value: oneRm, workoutSetId: set.id });
    }
  }

  return candidates;
}

/**
 * Smart PR update — only inserts when the set could break a record.
 * O(1) DB reads + O(1) writes for typical updates.
 */
export async function updatePersonalRecordsIncremental(
  prisma: PrismaClient,
  userId: string,
  exerciseId: string,
  newSet: CompletedSet,
): Promise<NewRecord[]> {
  if (!newSet.weight && !newSet.reps && !newSet.duration) {
    return [];
  }

  const currentBest = await fetchCurrentPrMaxMap(prisma, userId, exerciseId);
  const candidates = buildIncrementalCandidates(newSet, currentBest);

  if (candidates.length === 0) {
    return [];
  }

  await prisma.personalRecord.createMany({
    data: candidates.map((record) => ({
      userId,
      exerciseId,
      type: record.type,
      value: record.value,
      workoutSetId: record.workoutSetId,
    })),
  });

  return candidates;
}

export function needsFullPersonalRecordRecalc(
  before: { weight: number | null; reps: number | null; duration: number | null; isCompleted: boolean },
  after: { weight: number | null; reps: number | null; duration: number | null; isCompleted: boolean },
): boolean {
  if (!after.isCompleted) return true;
  if (!before.isCompleted) return false;

  return (
    (after.weight ?? 0) < (before.weight ?? 0) ||
    (after.reps ?? 0) < (before.reps ?? 0) ||
    (after.duration ?? 0) < (before.duration ?? 0)
  );
}

export async function syncPersonalRecords(
  prisma: PrismaClient,
  userId: string,
  exerciseId: string,
  sets: CompletedSet[],
): Promise<NewRecord[]> {
  const completed = sets.filter((s) => s.weight || s.reps || s.duration);
  if (completed.length === 0) return [];

  const currentBest = await fetchCurrentPrMaxMap(prisma, userId, exerciseId);
  const created: NewRecord[] = [];

  for (const set of completed) {
    const candidates = buildIncrementalCandidates(set, currentBest);
    for (const record of candidates) {
      const previous = currentBest.get(record.type) ?? 0;
      if (record.value <= previous) continue;
      currentBest.set(record.type, record.value);
      created.push(record);
    }
  }

  if (created.length === 0) return [];

  await prisma.personalRecord.createMany({
    data: created.map((record) => ({
      userId,
      exerciseId,
      type: record.type,
      value: record.value,
      workoutSetId: record.workoutSetId,
    })),
  });

  return created;
}

/** Rebuild PRs for one exercise after edits that may lower or remove prior bests. */
export async function recalculatePersonalRecordsForExercise(
  prisma: PrismaClient,
  userId: string,
  exerciseId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.personalRecord.deleteMany({ where: { userId, exerciseId } });

    const sets = await tx.workoutSet.findMany({
      where: {
        isCompleted: true,
        workoutExercise: {
          exerciseId,
          workout: { userId, finishedAt: { not: null } },
        },
      },
      select: { id: true, weight: true, reps: true, duration: true },
    });

    if (sets.length === 0) return;

    const records = bestRecordsToRows(userId, exerciseId, computeBestRecords(sets));
    if (records.length > 0) {
      await tx.personalRecord.createMany({ data: records });
    }
  });
}
