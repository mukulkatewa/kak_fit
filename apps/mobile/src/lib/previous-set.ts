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

export function formatPreviousSet(values: PreviousSetValues | null | undefined): string {
  if (!values) return "—";
  const w = values.weight;
  const r = values.reps;
  if (w != null && r != null) return `${w} × ${r}`;
  if (w != null) return `${w} kg`;
  if (r != null) return `${r} reps`;
  return "—";
}

export function pickPreviousForSet(
  session: PreviousExerciseSession | null | undefined,
  setNumber: number,
): PreviousSetValues | null {
  if (!session?.sets.length) return null;
  return session.sets.find((s) => s.setNumber === setNumber) ?? session.sets[session.sets.length - 1] ?? null;
}
