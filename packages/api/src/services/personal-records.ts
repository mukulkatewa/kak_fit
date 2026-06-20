import type { PersonalRecordType, PrismaClient } from "@kak-fit/db";
import { setVolume, estimateOneRepMax } from "../lib/constants";

type CompletedSet = {
  id: string;
  weight: number | null;
  reps: number | null;
  duration: number | null;
};

type NewRecord = {
  type: PersonalRecordType;
  value: number;
  workoutSetId: string;
};

export async function syncPersonalRecords(
  prisma: PrismaClient,
  userId: string,
  exerciseId: string,
  sets: CompletedSet[],
): Promise<NewRecord[]> {
  const completed = sets.filter((s) => s.weight || s.reps || s.duration);
  if (completed.length === 0) return [];

  const existing = await prisma.personalRecord.findMany({
    where: { userId, exerciseId },
  });

  const best = {
    maxWeight: Math.max(...completed.map((s) => s.weight ?? 0), 0),
    maxReps: Math.max(...completed.map((s) => s.reps ?? 0), 0),
    maxVolume: Math.max(...completed.map((s) => setVolume(s.weight, s.reps)), 0),
    maxDuration: Math.max(...completed.map((s) => s.duration ?? 0), 0),
    max1rm: Math.max(
      ...completed.map((s) =>
        s.weight && s.reps ? estimateOneRepMax(s.weight, s.reps) : 0,
      ),
      0,
    ),
  };

  const candidates: NewRecord[] = [];

  const pushIfBetter = (
    type: PersonalRecordType,
    value: number,
    setId: string,
    currentBest: number,
  ) => {
    if (value <= 0 || value <= currentBest) return;
    candidates.push({ type, value, workoutSetId: setId });
  };

  for (const set of completed) {
    if (set.weight) {
      const current = existing.find((r) => r.type === "MAX_WEIGHT")?.value ?? 0;
      pushIfBetter("MAX_WEIGHT", set.weight, set.id, current);
    }
    if (set.reps) {
      const current = existing.find((r) => r.type === "MAX_REPS")?.value ?? 0;
      pushIfBetter("MAX_REPS", set.reps, set.id, current);
    }
    const volume = setVolume(set.weight, set.reps);
    if (volume > 0) {
      const current = existing.find((r) => r.type === "MAX_VOLUME")?.value ?? 0;
      pushIfBetter("MAX_VOLUME", volume, set.id, current);
    }
    if (set.duration) {
      const current =
        existing.find((r) => r.type === "MAX_DURATION")?.value ?? 0;
      pushIfBetter("MAX_DURATION", set.duration, set.id, current);
    }
    if (set.weight && set.reps) {
      const oneRm = estimateOneRepMax(set.weight, set.reps);
      const current =
        existing.find((r) => r.type === "ESTIMATED_1RM")?.value ?? 0;
      pushIfBetter("ESTIMATED_1RM", oneRm, set.id, current);
    }
  }

  const uniqueByType = new Map<PersonalRecordType, NewRecord>();
  for (const record of candidates) {
    const prev = uniqueByType.get(record.type);
    if (!prev || record.value > prev.value) {
      uniqueByType.set(record.type, record);
    }
  }

  const created: NewRecord[] = [];

  for (const record of uniqueByType.values()) {
    const current = existing.find((r) => r.type === record.type)?.value ?? 0;
    if (record.value <= current) continue;

    await prisma.personalRecord.create({
      data: {
        userId,
        exerciseId,
        type: record.type,
        value: record.value,
        workoutSetId: record.workoutSetId,
      },
    });
    created.push(record);
  }

  return created;
}
