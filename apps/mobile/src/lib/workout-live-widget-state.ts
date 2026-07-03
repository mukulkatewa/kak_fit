import type { ActiveWorkout } from "./active-workout-cache";

export type WorkoutWidgetNextSet = {
  setId: string;
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
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
  nextSet: WorkoutWidgetNextSet | null;
  isComplete: boolean;
};

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

export function findNextIncompleteSet(workout: ActiveWorkout): WorkoutWidgetNextSet | null {
  for (const workoutExercise of workout.exercises) {
    const nextSet = workoutExercise.sets.find((set) => !set.isCompleted);
    if (nextSet) {
      return {
        setId: nextSet.id,
        exerciseId: workoutExercise.exercise.id,
        exerciseName: workoutExercise.exercise.name,
        setNumber: nextSet.setNumber,
        weight: nextSet.weight ?? null,
        reps: nextSet.reps ?? null,
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
): WorkoutWidgetSummary {
  const completedSets = workout.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.filter((set) => set.isCompleted).length,
    0,
  );
  const totalSets = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedAtMs(workout.startedAt)) / 1000));
  const nextSet = findNextIncompleteSet(workout);

  return {
    workoutId: workout.id,
    workoutName: workout.name && workout.name !== "Workout" ? workout.name : "Workout",
    elapsedSeconds,
    elapsedLabel: formatWidgetElapsedDuration(elapsedSeconds),
    completedSets,
    totalSets,
    progressLabel: `${completedSets}/${totalSets} sets`,
    currentExerciseName: getCurrentExerciseName(workout),
    nextSet,
    isComplete: totalSets > 0 && completedSets === totalSets,
  };
}

export function buildWorkoutNotificationText(summary: WorkoutWidgetSummary) {
  const title = `${summary.workoutName} • ${summary.elapsedLabel}`;
  const body = summary.nextSet
    ? `Next: ${summary.nextSet.exerciseName} set ${summary.nextSet.setNumber} • ${summary.progressLabel}`
    : `All sets complete • ${summary.progressLabel}`;

  return { title, body };
}

export function workoutWidgetSummaryKey(summary: WorkoutWidgetSummary): string {
  return [
    summary.workoutId,
    summary.completedSets,
    summary.totalSets,
    summary.nextSet?.setId ?? "done",
    summary.currentExerciseName,
  ].join(":");
}
