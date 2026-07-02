import { fetchJson } from "../../fetch-ipv4";
import { withRetry } from "../../wger-media/utils/retryDownload";
import type { WgerSourceExercise } from "../../wger-media/types";

export const FREE_EXERCISE_DB_SOURCE = "free-exercise-db";
export const FREE_EXERCISE_DB_RAW_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";
const FREE_EXERCISE_DB_DIST = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

type FreeExerciseDbRow = {
  id?: string;
  name?: string;
  equipment?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  category?: string | null;
  images?: string[];
};

export type FreeExerciseDbExercise = WgerSourceExercise & {
  freeExerciseDbId: string;
  images: string[];
};

function normalizeImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images.filter((image): image is string => typeof image === "string" && image.trim().length > 0);
}

function rawImageUrl(imagePath: string): string {
  const encoded = imagePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${FREE_EXERCISE_DB_RAW_BASE}/${encoded}`;
}

export function imageUrlForFreeExerciseDbPath(imagePath: string): string {
  return rawImageUrl(imagePath);
}

export class FreeExerciseDbClient {
  async fetchExercises(): Promise<FreeExerciseDbExercise[]> {
    const rows = await withRetry(() => fetchJson<FreeExerciseDbRow[]>(FREE_EXERCISE_DB_DIST), {
      retries: 3,
      baseDelayMs: 750,
      label: "free-exercise-db exercises.json",
    });

    return rows
      .filter((row) => row.id && row.name && normalizeImages(row.images).length > 0)
      .map((row) => ({
        id: row.id!,
        freeExerciseDbId: row.id!,
        name: row.name!,
        category: row.category ?? null,
        primaryMuscles: row.primaryMuscles ?? [],
        secondaryMuscles: row.secondaryMuscles ?? [],
        equipment: row.equipment ? [row.equipment] : [],
        images: normalizeImages(row.images),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
