import type { RouterOutputs } from "@kak-fit/api/router";
import { formatWeight, weightLabel, type WeightUnit } from "./units";

type RoutineListBase = RouterOutputs["routine"]["list"][number];

export type RoutineListItem = RoutineListBase & {
  exercises?: Array<{
    id: string;
    order: number;
    exercise: { id: string; name: string; imageUrl: string | null };
    sets?: Array<{
      id: string;
      setNumber: number;
      targetWeight: number | null;
      targetReps: number | null;
      targetDuration: number | null;
      setType: string;
    }>;
  }>;
};
export type RoutineExerciseItem = NonNullable<RoutineListItem["exercises"]>[number];
export type RoutineDetailExercise = RouterOutputs["routine"]["getById"]["exercises"][number];

type RoutineExerciseLike = RoutineExerciseItem | RoutineDetailExercise;

export function exerciseSummary(exercises: RoutineExerciseItem[] | undefined) {
  const list = exercises ?? [];
  if (list.length === 0) return "No exercises";
  const names = list
    .slice(0, 3)
    .map((e) => e.exercise.name)
    .join(" · ");
  return names + (list.length > 3 ? ` +${list.length - 3}` : "");
}

export function formatRoutineExerciseDetail(
  exercise: RoutineExerciseLike,
  weightUnit: WeightUnit = "KG",
) {
  const sets = "sets" in exercise && Array.isArray(exercise.sets) ? exercise.sets : [];
  if (sets.length === 0) {
    return exercise.exercise.name;
  }

  const count = sets.length;
  const reps = sets[0]?.targetReps;
  const weightKg = sets.find((s) => s.targetWeight != null)?.targetWeight;

  if (weightKg != null) {
    const w = formatWeight(weightKg, weightUnit);
    return `${count} sets · ${w}${weightLabel(weightUnit)} × ${reps ?? "–"}`;
  }

  return `${count} sets · ${reps ?? "–"} reps`;
}
