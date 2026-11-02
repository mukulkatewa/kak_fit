export type PreviousSetValues = {
  setNumber: number;
  weight: number | null;
  reps: number | null;
  duration: number | null;
};

export type PreviousExerciseSession = {
  workoutName: string | null;
  finishedAt: Date | null;
  sets: PreviousSetValues[];
};

export function pickPreviousForSet(
  session: PreviousExerciseSession | null | undefined,
  setNumber: number,
): PreviousSetValues | null {
  if (!session?.sets.length) return null;
  return session.sets.find((s) => s.setNumber === setNumber) ?? null;
}
