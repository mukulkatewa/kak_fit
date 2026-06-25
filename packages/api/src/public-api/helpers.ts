import type { PrismaClient } from "@kak-fit/db";
import { PublicApiError } from "./auth";

export type ExerciseNameMatch = {
  id: string;
  name: string;
  matchScore: number;
};

export function exerciseAccessWhere(userId: string) {
  return { OR: [{ isCustom: false as const }, { isCustom: true as const, userId }] };
}

function normalizeExerciseText(value: string) {
  return value.trim().toLowerCase();
}

/** Words longer than 2 chars — skips abbreviations like "db" when matching multi-word queries. */
export function significantExerciseWords(query: string) {
  return normalizeExerciseText(query)
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/g, ""))
    .filter((word) => word.length > 2);
}

export function scoreExerciseNameMatch(exerciseName: string, query: string): number {
  const nameNorm = normalizeExerciseText(exerciseName);
  const queryNorm = normalizeExerciseText(query);
  if (!nameNorm || !queryNorm) return 0;

  if (nameNorm === queryNorm) return 1000;
  if (nameNorm.includes(queryNorm)) return 800 + queryNorm.length;
  if (queryNorm.includes(nameNorm)) return 700 + nameNorm.length;

  const words = significantExerciseWords(query);
  if (words.length === 0) return 0;

  const matchedWords = words.filter((word) => nameNorm.includes(word));
  if (matchedWords.length === 0) return 0;

  const wordCoverage = matchedWords.length / words.length;
  return Math.round(100 * wordCoverage + matchedWords.length * 50);
}

async function fetchExerciseNameCandidates(prisma: PrismaClient, userId: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const where = exerciseAccessWhere(userId);
  const words = significantExerciseWords(trimmed);
  const batches = await Promise.all([
    prisma.exercise.findMany({
      where: { ...where, name: { contains: trimmed, mode: "insensitive" } },
      select: { id: true, name: true },
      take: 50,
    }),
    ...words.map((word) =>
      prisma.exercise.findMany({
        where: { ...where, name: { contains: word, mode: "insensitive" } },
        select: { id: true, name: true },
        take: 80,
      }),
    ),
  ]);

  const byId = new Map<string, { id: string; name: string }>();
  for (const batch of batches) {
    for (const exercise of batch) {
      byId.set(exercise.id, exercise);
    }
  }
  return [...byId.values()];
}

export async function rankExerciseNameMatches(
  prisma: PrismaClient,
  userId: string,
  query: string,
): Promise<ExerciseNameMatch[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const candidates = await fetchExerciseNameCandidates(prisma, userId, trimmed);
  const ranked: ExerciseNameMatch[] = [];

  for (const candidate of candidates) {
    const matchScore = scoreExerciseNameMatch(candidate.name, trimmed);
    if (matchScore > 0) {
      ranked.push({ ...candidate, matchScore });
    }
  }

  return ranked.sort(
    (a, b) => b.matchScore - a.matchScore || a.name.localeCompare(b.name),
  );
}

export async function suggestExerciseMatches(
  prisma: PrismaClient,
  userId: string,
  query: string,
  limit = 5,
): Promise<ExerciseNameMatch[]> {
  return (await rankExerciseNameMatches(prisma, userId, query)).slice(0, limit);
}

export async function resolveExercise(
  prisma: PrismaClient,
  userId: string,
  input: { exercise_template_id?: string; exercise_name?: string },
) {
  if (input.exercise_template_id) {
    const exercise = await prisma.exercise.findFirst({
      where: {
        id: input.exercise_template_id,
        ...exerciseAccessWhere(userId),
      },
    });
    if (!exercise) throw new PublicApiError(404, "Exercise not found");
    return exercise;
  }

  const name = input.exercise_name?.trim();
  if (!name) {
    throw new PublicApiError(400, "Provide exercise_template_id or exercise_name");
  }

  const exact = await prisma.exercise.findFirst({
    where: {
      ...exerciseAccessWhere(userId),
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (exact) return exact;

  const ranked = await rankExerciseNameMatches(prisma, userId, name);
  const best = ranked[0];
  if (!best) {
    throw new PublicApiError(404, `No exercise matching "${name}"`);
  }

  const exercise = await prisma.exercise.findFirst({
    where: { id: best.id, ...exerciseAccessWhere(userId) },
  });
  if (!exercise) {
    throw new PublicApiError(404, `No exercise matching "${name}"`);
  }
  return exercise;
}

export async function resolveRoutine(
  prisma: PrismaClient,
  userId: string,
  input: { routine_id?: string; routine_title?: string },
) {
  if (input.routine_id) {
    const routine = await prisma.routine.findFirst({
      where: { id: input.routine_id, userId },
    });
    if (!routine) throw new PublicApiError(404, "Routine not found");
    return routine;
  }

  const title = input.routine_title?.trim();
  if (!title) {
    throw new PublicApiError(400, "Provide routine_id or routine_title");
  }

  const routine = await prisma.routine.findFirst({
    where: { userId, name: { equals: title, mode: "insensitive" } },
    orderBy: { updatedAt: "desc" },
  });
  if (!routine) {
    throw new PublicApiError(404, `No routine matching "${title}"`);
  }
  return routine;
}

function parseSetsFromBody(raw: unknown) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [
      {
        setNumber: 1,
        targetReps: 10,
        targetWeight: undefined as number | undefined,
        targetDuration: undefined as number | undefined,
        setType: "NORMAL" as const,
      },
    ];
  }
  return raw.map((setRaw, i) => {
    const set = setRaw as Record<string, unknown>;
    return {
      setNumber: Number(set.index ?? set.setNumber ?? i + 1),
      targetWeight: set.weight_kg != null ? Number(set.weight_kg) : set.weight != null ? Number(set.weight) : undefined,
      targetReps: set.reps != null ? Number(set.reps) : 10,
      targetDuration: set.duration_seconds != null ? Number(set.duration_seconds) : undefined,
      setType: (set.type === "warmup" ? "WARMUP" : set.type === "failure" ? "FAILURE" : "NORMAL") as
        | "NORMAL"
        | "WARMUP"
        | "FAILURE"
        | "DROP",
    };
  });
}

export function parseRoutineExercisePayload(body: Record<string, unknown>) {
  const exercise = (body.exercise ?? body) as Record<string, unknown>;
  return {
    exercise_template_id: exercise.exercise_template_id as string | undefined,
    exercise_name: (exercise.exercise_name ?? exercise.title ?? exercise.name) as string | undefined,
    notes: typeof exercise.notes === "string" ? exercise.notes : undefined,
    sets: parseSetsFromBody(exercise.sets),
  };
}
