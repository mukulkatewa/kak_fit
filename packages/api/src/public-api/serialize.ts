export function parsePage(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? "10") || 10));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function paginated<T>(items: T[], page: number, pageSize: number, total: number) {
  return {
    page,
    page_size: pageSize,
    page_count: Math.max(1, Math.ceil(total / pageSize)),
    total_count: total,
    data: items,
  };
}

export function toIso(d: Date | null | undefined) {
  return d ? d.toISOString() : null;
}

export function dateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function parseDateParam(value: string): Date {
  const d = new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid date");
  }
  return d;
}

const SET_TYPE_MAP = {
  NORMAL: "normal",
  WARMUP: "warmup",
  DROP: "drop_set",
  FAILURE: "failure",
} as const;

const SET_TYPE_REVERSE: Record<string, "NORMAL" | "WARMUP" | "DROP" | "FAILURE"> = {
  normal: "NORMAL",
  warmup: "WARMUP",
  drop_set: "DROP",
  drop: "DROP",
  failure: "FAILURE",
};

export function serializeSetType(type: string) {
  return SET_TYPE_MAP[type as keyof typeof SET_TYPE_MAP] ?? "normal";
}

export function parseSetType(type: string | undefined) {
  if (!type) return "NORMAL" as const;
  return SET_TYPE_REVERSE[type.toLowerCase()] ?? "NORMAL";
}

type WorkoutWithDetails = {
  id: string;
  name: string | null;
  notes: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  exercises: Array<{
    id: string;
    order: number;
    notes: string | null;
    exercise: { id: string; name: string };
    sets: Array<{
      id: string;
      setNumber: number;
      weight: number | null;
      reps: number | null;
      duration: number | null;
      rpe: number | null;
      notes: string | null;
      setType: string;
      isCompleted: boolean;
    }>;
  }>;
};

export function serializeWorkout(workout: WorkoutWithDetails) {
  const end = workout.finishedAt ?? workout.startedAt;
  const durationMinutes = Math.max(
    1,
    Math.round((end.getTime() - workout.startedAt.getTime()) / 60000),
  );

  return {
    id: workout.id,
    title: workout.name ?? "Workout",
    description: workout.notes,
    start_time: toIso(workout.startedAt),
    end_time: toIso(workout.finishedAt),
    duration_minutes: durationMinutes,
    exercises: workout.exercises.map((ex) => ({
      index: ex.order,
      exercise_template_id: ex.exercise.id,
      exercise_name: ex.exercise.name,
      notes: ex.notes,
      sets: ex.sets.map((set) => ({
        id: set.id,
        index: set.setNumber,
        weight_kg: set.weight,
        reps: set.reps,
        duration_seconds: set.duration,
        rpe: set.rpe,
        notes: set.notes,
        type: serializeSetType(set.setType),
        is_completed: set.isCompleted,
      })),
    })),
  };
}

export function serializeRoutine(routine: {
  id: string;
  name: string;
  notes: string | null;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  exercises: Array<{
    order: number;
    notes: string | null;
    restSeconds: number | null;
    exercise: { id: string; name: string };
    sets: Array<{
      setNumber: number;
      targetWeight: number | null;
      targetReps: number | null;
      targetDuration: number | null;
      setType: string;
    }>;
  }>;
}) {
  return {
    id: routine.id,
    title: routine.name,
    notes: routine.notes,
    folder_id: routine.folderId,
    created_at: toIso(routine.createdAt),
    updated_at: toIso(routine.updatedAt),
    exercises: routine.exercises.map((ex) => ({
      index: ex.order,
      exercise_template_id: ex.exercise.id,
      exercise_name: ex.exercise.name,
      notes: ex.notes,
      rest_seconds: ex.restSeconds,
      sets: ex.sets.map((set) => ({
        index: set.setNumber,
        weight_kg: set.targetWeight,
        reps: set.targetReps,
        duration_seconds: set.targetDuration,
        type: serializeSetType(set.setType),
      })),
    })),
  };
}

export function serializeExerciseTemplate(exercise: {
  id: string;
  name: string;
  instructions: string | null;
  imageUrl: string | null;
  isCustom: boolean;
  hevyId?: string | null;
  wgerId?: number | null;
  category: { name: string } | null;
  muscles: Array<{ muscle: { name: string }; isPrimary: boolean }>;
  equipment?: Array<{ equipment: { name: string } }>;
}) {
  const hevyType = exercise.category?.name?.startsWith("Hevy:")
    ? exercise.category.name.replace(/^Hevy:\s*/, "")
    : null;

  return {
    id: exercise.id,
    title: exercise.name,
    instructions: exercise.instructions,
    image_url: exercise.imageUrl,
    is_custom: exercise.isCustom,
    hevy_id: exercise.hevyId ?? null,
    wger_id: exercise.wgerId ?? null,
    category: exercise.category?.name?.startsWith("Hevy:") ? null : exercise.category?.name ?? null,
    exercise_type: hevyType,
    equipment: exercise.equipment?.map((e) => e.equipment.name) ?? [],
    primary_muscles: exercise.muscles.filter((m) => m.isPrimary).map((m) => m.muscle.name),
    secondary_muscles: exercise.muscles.filter((m) => !m.isPrimary).map((m) => m.muscle.name),
  };
}

export function serializeMeasurement(m: {
  id: string;
  date: Date;
  weight: number | null;
  bodyFat: number | null;
  waist: number | null;
  chest: number | null;
  arms: number | null;
}) {
  return {
    id: m.id,
    date: dateOnly(m.date),
    weight_kg: m.weight,
    body_fat_percentage: m.bodyFat,
    waist_cm: m.waist,
    chest_cm: m.chest,
    arms_cm: m.arms,
  };
}
