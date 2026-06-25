import type { RouterOutputs } from "@kak-fit/api/router";
import { formatWeight, weightLabel, type WeightUnit } from "./units";

export type RoutineListItem = RouterOutputs["routine"]["list"][number];
export type RoutineExerciseItem = RoutineListItem["exercises"][number];
export type RoutineDetailExercise = RouterOutputs["routine"]["getById"]["exercises"][number];

type RoutineExerciseLike = RoutineExerciseItem | RoutineDetailExercise;

export function exerciseSummary(exercises: RoutineExerciseItem[]) {
  if (exercises.length === 0) return "No exercises";
  const names = exercises
    .slice(0, 3)
    .map((e) => e.exercise.name)
    .join(" · ");
  return names + (exercises.length > 3 ? ` +${exercises.length - 3}` : "");
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
