import type { ActiveWorkout } from "./active-workout-cache";
import { fromKg, weightLabel, type WeightUnit } from "./units";

export type WorkoutWidgetNextSet = {
  setId: string;
  exerciseId: string;
  exerciseName: string;
  shortExerciseName: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  setLabel: string;
};

export type WorkoutWidgetSummary = {
  workoutId: string;
  workoutName: string;
  elapsedSeconds: number;
  elapsedLabel: string;
  completedSets: number;
  totalSets: number;
  progressLabel: string;
  currentExerciseName: string;
  shortExerciseName: string;
  nextSet: WorkoutWidgetNextSet | null;
  isComplete: boolean;
  remainingSets: Array<{
    setId: string;
    setNumber: number;
    reps: number;
    weight: number;
    shortExerciseName: string;
    setLabel: string;
  }>;
  defaultRestSeconds: number;
};

/** Compact exercise title for widgets/notifications. */
export function shortExerciseName(name: string, maxLen = 20): string {
  const trimmed = name.trim();
  if (trimmed.length <= maxLen) return trimmed;
  const slice = trimmed.slice(0, maxLen - 1);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > Math.floor(maxLen * 0.45)) {
    return `${slice.slice(0, lastSpace)}…`;
  }
  return `${slice}…`;
}

export function formatSetLabel(
  set: {
    setNumber: number;
    weight?: number | null;
    reps?: number | null;
  },
  weightUnit: WeightUnit = "KG",
): string {
  const weightStr =
    set.weight != null && set.weight > 0
      ? `${formatWidgetWeight(set.weight, weightUnit)}${weightLabel(weightUnit)} × `
      : "";
  const reps = set.reps != null && set.reps > 0 ? set.reps : null;
  if (weightStr && reps != null) return `Set ${set.setNumber} • ${weightStr}${reps} reps`;
  if (reps != null) return `Set ${set.setNumber} • ${reps} reps`;
  return `Set ${set.setNumber}`;
}

function formatWidgetWeight(weightKg: number, unit: WeightUnit): string {
  const value = fromKg(weightKg, unit);
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

function startedAtMs(value: ActiveWorkout["startedAt"]): number {
  if (value instanceof Date) return value.getTime();
  return new Date(value).getTime();
}

export function formatWidgetElapsedDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${safeSeconds}s`;
}

export function findNextIncompleteSet(
  workout: ActiveWorkout,
  weightUnit: WeightUnit = "KG",
): WorkoutWidgetNextSet | null {
  for (const workoutExercise of workout.exercises) {
    const nextSet = workoutExercise.sets.find((set) => !set.isCompleted);
    if (nextSet) {
      const shortName = shortExerciseName(workoutExercise.exercise.name);
      return {
        setId: nextSet.id,
        exerciseId: workoutExercise.exercise.id,
        exerciseName: workoutExercise.exercise.name,
        shortExerciseName: shortName,
        setNumber: nextSet.setNumber,
        weight: nextSet.weight ?? null,
        reps: nextSet.reps ?? null,
        setLabel: formatSetLabel(
          {
            setNumber: nextSet.setNumber,
            weight: nextSet.weight,
            reps: nextSet.reps,
          },
          weightUnit,
        ),
      };
    }
  }
  return null;
}

export function getCurrentExerciseName(workout: ActiveWorkout): string {
  const nextSet = findNextIncompleteSet(workout);
  if (nextSet) return nextSet.exerciseName;

  const lastExercise = workout.exercises.at(-1);
  return lastExercise?.exercise.name ?? "Active Workout";
}

export function buildWorkoutWidgetSummary(
  workout: ActiveWorkout,
  nowMs = Date.now(),
  defaultRestSeconds = 90,
  weightUnit: WeightUnit = "KG",
): WorkoutWidgetSummary {
  const completedSets = workout.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.isCompleted).length,
    0,
  );
  const totalSets = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedAtMs(workout.startedAt)) / 1000));
  const nextSet = findNextIncompleteSet(workout, weightUnit);
  const currentName = getCurrentExerciseName(workout);
  const remainingSets: WorkoutWidgetSummary["remainingSets"] = [];

  for (const workoutExercise of workout.exercises) {
    for (const set of workoutExercise.sets) {
      if (set.isCompleted) continue;
      const shortName = shortExerciseName(workoutExercise.exercise.name);
      remainingSets.push({
        setId: set.id,
        setNumber: set.setNumber,
        reps: set.reps ?? 1,
        weight: set.weight ?? 0,
        shortExerciseName: shortName,
        setLabel: formatSetLabel(
          {
            setNumber: set.setNumber,
            weight: set.weight,
            reps: set.reps,
          },
          weightUnit,
        ),
      });
    }
  }

  return {
    workoutId: workout.id,
    workoutName: workout.name && workout.name !== "Workout" ? workout.name : "Workout",
    elapsedSeconds,
    elapsedLabel: formatWidgetElapsedDuration(elapsedSeconds),
    completedSets,
    totalSets,
    progressLabel: `${completedSets}/${totalSets} sets`,
    currentExerciseName: currentName,
    shortExerciseName: shortExerciseName(currentName),
    nextSet,
    isComplete: totalSets > 0 && completedSets === totalSets,
    remainingSets,
    defaultRestSeconds,
  };
}

export function buildWorkoutNotificationText(summary: WorkoutWidgetSummary) {
  const title = `${summary.workoutName} • ${summary.elapsedLabel}`;
  const body = summary.nextSet
    ? `${summary.nextSet.shortExerciseName} — ${summary.nextSet.setLabel} • ${summary.progressLabel}`
    : `All sets complete • ${summary.progressLabel}`;

  return { title, body };
}

export function workoutWidgetSummaryKey(summary: WorkoutWidgetSummary): string {
  return [
    summary.workoutId,
    summary.completedSets,
    summary.totalSets,
    summary.nextSet?.setId ?? "done",
    summary.shortExerciseName,
    summary.nextSet?.setLabel ?? "",
  ].join(":");
}
