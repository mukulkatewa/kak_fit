import type { PrismaClient } from "@kak-fit/db";
import { PublicApiError } from "./auth";

export async function resolveExercise(
  prisma: PrismaClient,
  userId: string,
  input: { exercise_template_id?: string; exercise_name?: string },
) {
  if (input.exercise_template_id) {
    const exercise = await prisma.exercise.findFirst({
      where: {
        id: input.exercise_template_id,
        OR: [{ isCustom: false }, { isCustom: true, userId }],
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
      OR: [{ isCustom: false }, { isCustom: true, userId }],
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (exact) return exact;

  const fuzzy = await prisma.exercise.findFirst({
    where: {
      OR: [{ isCustom: false }, { isCustom: true, userId }],
      name: { contains: name, mode: "insensitive" },
    },
    orderBy: { name: "asc" },
  });
  if (!fuzzy) {
    throw new PublicApiError(404, `No exercise matching "${name}"`);
  }
  return fuzzy;
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
