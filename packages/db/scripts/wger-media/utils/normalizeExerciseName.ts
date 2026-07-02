export function normalizeExerciseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[()\[\]{}]/g, " ")
    .replace(/[\-_\/\\]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
