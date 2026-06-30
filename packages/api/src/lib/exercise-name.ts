/** Normalize exercise names for cross-catalog matching (Wger ↔ Hevy). */
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Higher = preferred when multiple catalog rows share a normalized name. */
export function exerciseCatalogScore(exercise: {
  imageUrl: string | null;
  wgerId: number | null;
  hevyId: string | null;
  instructions: string | null;
}): number {
  let score = 0;
  if (exercise.imageUrl) score += 100;
  if (exercise.instructions?.trim()) score += 20;
  if (exercise.wgerId != null) score += 10;
  if (exercise.hevyId) score += 5;
  return score;
}

export function pickCanonicalExercise<
  T extends {
    id: string;
    name: string;
    imageUrl: string | null;
    wgerId: number | null;
    hevyId: string | null;
    instructions: string | null;
  },
>(exercises: T[]): T {
  return exercises.reduce((best, current) =>
    exerciseCatalogScore(current) > exerciseCatalogScore(best) ? current : best,
  );
}

export function dedupeExercisesByName<T extends Parameters<typeof pickCanonicalExercise>[0][number]>(
  exercises: T[],
): T[] {
  const groups = new Map<string, T[]>();
  for (const exercise of exercises) {
    const key = normalizeExerciseName(exercise.name);
    const list = groups.get(key) ?? [];
    list.push(exercise);
    groups.set(key, list);
  }
  return [...groups.values()].map(pickCanonicalExercise).sort((a, b) => a.name.localeCompare(b.name));
}
