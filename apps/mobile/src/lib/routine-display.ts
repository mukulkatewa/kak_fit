import type { RouterOutputs } from "@kak-fit/api/router";

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

export function formatRoutineExerciseDetail(exercise: RoutineExerciseItem) {
  return exercise.exercise.name;
}
