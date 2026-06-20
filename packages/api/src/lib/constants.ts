export const FREE_ROUTINE_LIMIT = 4;
export const FREE_CUSTOM_EXERCISE_LIMIT = 7;

export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0) return weight;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function setVolume(weight?: number | null, reps?: number | null): number {
  if (!weight || !reps) return 0;
  return weight * reps;
}
