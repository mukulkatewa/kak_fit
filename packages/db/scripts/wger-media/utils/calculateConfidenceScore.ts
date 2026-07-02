import { normalizeExerciseName } from "./normalizeExerciseName";

export type MatchMetadata = {
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  category?: string | null;
};

function normalizedSet(values: string[]): Set<string> {
  return new Set(values.map(normalizeExerciseName).filter(Boolean));
}

function scoreOverlap(candidate: Set<string>, source: Set<string>, pointsPerHit: number, max: number): number {
  if (candidate.size === 0 || source.size === 0) return 0;
  let hits = 0;
  for (const item of source) if (candidate.has(item)) hits += 1;
  return Math.min(max, hits * pointsPerHit);
}

export function calculateConfidenceScore(candidate: MatchMetadata, source: MatchMetadata): number {
  let score = 0;
  score += scoreOverlap(normalizedSet(candidate.primaryMuscles), normalizedSet(source.primaryMuscles), 40, 40);
  score += scoreOverlap(normalizedSet(candidate.secondaryMuscles), normalizedSet(source.secondaryMuscles), 9, 18);
  score += scoreOverlap(normalizedSet(candidate.equipment), normalizedSet(source.equipment), 12, 24);

  const candidateCategory = candidate.category ? normalizeExerciseName(candidate.category) : "";
  const sourceCategory = source.category ? normalizeExerciseName(source.category) : "";
  if (candidateCategory && sourceCategory && candidateCategory === sourceCategory) score += 18;

  return Math.min(100, score);
}
