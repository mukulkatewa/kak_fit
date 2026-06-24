import type { RouterOutputs } from "@kak-fit/api/router";

export type ActiveWorkout = NonNullable<RouterOutputs["workout"]["active"]>;
export type WorkoutSet = RouterOutputs["workout"]["updateSet"];
export type WorkoutExercise = RouterOutputs["workout"]["addExercise"];

export function patchSetInWorkout(workout: ActiveWorkout, updatedSet: WorkoutSet): ActiveWorkout {
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => (set.id === updatedSet.id ? { ...set, ...updatedSet } : set)),
    })),
  };
}

export function addSetToWorkout(
  workout: ActiveWorkout,
  workoutExerciseId: string,
  newSet: WorkoutSet,
): ActiveWorkout {
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.id === workoutExerciseId
        ? { ...exercise, sets: [...exercise.sets, newSet] }
        : exercise,
    ),
  };
}

export function removeSetFromWorkout(workout: ActiveWorkout, setId: string): ActiveWorkout {
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.filter((set) => set.id !== setId),
    })),
  };
}

export function patchExerciseNotes(
  workout: ActiveWorkout,
  workoutExerciseId: string,
  notes: string | null,
): ActiveWorkout {
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.id === workoutExerciseId ? { ...exercise, notes } : exercise,
    ),
  };
}

export function addExerciseToWorkout(workout: ActiveWorkout, exercise: WorkoutExercise): ActiveWorkout {
  return {
    ...workout,
    exercises: [...workout.exercises, exercise],
  };
}
