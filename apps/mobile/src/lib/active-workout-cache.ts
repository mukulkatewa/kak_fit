import type { RouterOutputs } from "@kak-fit/api/router";

export type ActiveWorkout = NonNullable<RouterOutputs["workout"]["active"]>;
export type WorkoutSet = RouterOutputs["workout"]["updateSet"];
export type WorkoutExercise = RouterOutputs["workout"]["addExercise"];
type WorkoutSetRow = ActiveWorkout["exercises"][number]["sets"][number];

export type SetUpdatePatch = {
  weight?: number;
  reps?: number;
  duration?: number;
  notes?: string;
  setType?: WorkoutSetRow["setType"];
  isCompleted?: boolean;
  rpe?: number | null;
};

export function applySetPatchToWorkout(
  workout: ActiveWorkout,
  setId: string,
  patch: SetUpdatePatch,
): ActiveWorkout {
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)),
    })),
  };
}

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

export function createOptimisticAddedSet(
  workout: ActiveWorkout,
  workoutExerciseId: string,
): WorkoutSetRow {
  const exercise = workout.exercises.find((item) => item.id === workoutExerciseId);
  const lastSet = exercise?.sets[exercise.sets.length - 1];
  return {
    id: `offline-set-${Date.now()}`,
    workoutExerciseId,
    setNumber: (lastSet?.setNumber ?? 0) + 1,
    weight: lastSet?.weight != null && lastSet.weight > 0 ? lastSet.weight : null,
    reps: lastSet?.reps != null && lastSet.reps > 0 ? lastSet.reps : null,
    duration: lastSet?.duration ?? null,
    rpe: lastSet?.rpe ?? null,
    notes: lastSet?.notes ?? null,
    setType: lastSet?.setType ?? "NORMAL",
    isCompleted: false,
  };
}

type AddExerciseVariables = {
  workoutId: string;
  exerciseId: string;
  sets: Array<{
    setNumber: number;
    isCompleted?: boolean;
    weight?: number;
    reps?: number;
    duration?: number;
    notes?: string;
    setType?: WorkoutSetRow["setType"];
  }>;
};

export function createOptimisticExercise(
  workout: ActiveWorkout,
  input: AddExerciseVariables,
  meta?: { name: string; imageUrl: string | null },
): WorkoutExercise {
  const workoutExerciseId = `offline-ex-${Date.now()}`;
  return {
    id: workoutExerciseId,
    workoutId: input.workoutId,
    exerciseId: input.exerciseId,
    order: workout.exercises.length,
    notes: null,
    restSeconds: null,
    supersetGroup: null,
    exercise: {
      id: input.exerciseId,
      name: meta?.name ?? "Exercise",
      imageUrl: meta?.imageUrl ?? null,
    },
    sets: input.sets.map((set, index) => ({
      id: `offline-set-${Date.now()}-${index}`,
      workoutExerciseId,
      setNumber: set.setNumber,
      weight: set.weight ?? null,
      reps: set.reps ?? null,
      duration: set.duration ?? null,
      rpe: null,
      notes: set.notes ?? null,
      setType: set.setType ?? "NORMAL",
      isCompleted: set.isCompleted ?? false,
    })),
  } as WorkoutExercise;
}

export function reorderExercisesInWorkout(
  workout: ActiveWorkout,
  orderedWorkoutExerciseIds: string[],
): ActiveWorkout {
  const byId = new Map(workout.exercises.map((exercise) => [exercise.id, exercise]));
  const exercises = orderedWorkoutExerciseIds
    .map((id) => byId.get(id))
    .filter((exercise): exercise is ActiveWorkout["exercises"][number] => exercise != null)
    .map((exercise, order) => ({ ...exercise, order }));
  return { ...workout, exercises };
}
