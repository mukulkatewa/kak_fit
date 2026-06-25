import type { RouterOutputs } from "@kak-fit/api/router";
import { formatWeight, weightLabel, type WeightUnit } from "./units";

export type RoutineListItem = RouterOutputs["routine"]["list"][number];
export type RoutineExerciseItem = RoutineListItem["exercises"][number];

export function exerciseSummary(exercises: RoutineExerciseItem[]) {
  if (exercises.length === 0) return "No exercises";
  const names = exercises
    .slice(0, 3)
    .map((e) => e.exercise.name)
    .join(" · ");
  return names + (exercises.length > 3 ? ` +${exercises.length - 3}` : "");
}

export function formatRoutineExerciseDetail(exercise: RoutineExerciseItem, weightUnit: WeightUnit) {
  const { sets } = exercise;
  const count = sets.length;
  let setInfo = `${count} sets`;

  if (count > 0) {
    const firstDuration = sets[0]?.targetDuration;
    if (firstDuration != null && sets.every((s) => s.targetDuration != null)) {
      const allSameDuration = sets.every((s) => s.targetDuration === firstDuration);
      setInfo = allSameDuration ? `${count}×${firstDuration}s` : `${count} sets`;
    } else {
      const reps = sets.map((s) => s.targetReps).filter((r): r is number => r != null);
      if (reps.length > 0) {
        const allSameReps = reps.every((r) => r === reps[0]);
        setInfo = allSameReps ? `${count}×${reps[0]}` : `${count} sets`;
      }
    }

    const weightKg = sets.find((s) => s.targetWeight != null)?.targetWeight;
    if (weightKg != null) {
      setInfo += `, ${formatWeight(weightKg, weightUnit)}${weightLabel(weightUnit)}`;
    }
  }

  return `${exercise.exercise.name} · ${setInfo}`;
}
