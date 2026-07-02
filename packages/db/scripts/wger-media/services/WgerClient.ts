import { fetchJson } from "../../fetch-ipv4";
import { withRetry } from "../utils/retryDownload";
import type { WgerMediaItem, WgerSourceExercise } from "../types";

const WGER_BASE = "https://wger.de/api/v2";
const ENGLISH_LANGUAGE = 2;
const PAGE_SIZE = 100;

type WgerPage<T> = { next: string | null; results: T[] };

type WgerExerciseInfo = {
  id: number;
  category?: { id: number; name: string } | null;
  muscles?: Array<{ name?: string; name_en?: string }>;
  muscles_secondary?: Array<{ name?: string; name_en?: string }>;
  equipment?: Array<{ name?: string }>;
  images?: Array<{ image?: string; is_main?: boolean; uuid?: string }>;
  videos?: Array<{ video?: string; is_main?: boolean; duration?: number }>;
  translations?: Array<{ language: number; name: string; description?: string }>;
};

function nameFrom(value: { name?: string; name_en?: string }): string | null {
  return value.name_en || value.name || null;
}

function numberFromUnknown(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return null;
}

function mediaExerciseId(item: Record<string, unknown>): number | null {
  return (
    numberFromUnknown(item.exercise_base) ??
    numberFromUnknown(item.exercise) ??
    numberFromUnknown(item.exercise_id) ??
    numberFromUnknown(item.exerciseBase) ??
    null
  );
}

export class WgerClient {
  private async fetchPage<T>(url: string): Promise<WgerPage<T>> {
    return withRetry(() => fetchJson<WgerPage<T>>(url), {
      retries: 3,
      baseDelayMs: 750,
      label: `Wger page ${url}`,
    });
  }

  private async fetchAllPages<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    let url: string | null = path.startsWith("http") ? path : `${WGER_BASE}${path}`;
    while (url) {
      const page = await this.fetchPage<T>(url);
      items.push(...page.results);
      url = page.next;
    }
    return items;
  }

  async fetchSourceExercises(): Promise<Map<number, WgerSourceExercise>> {
    const rows = await this.fetchAllPages<WgerExerciseInfo>(`/exerciseinfo/?language=${ENGLISH_LANGUAGE}&limit=${PAGE_SIZE}`);
    const map = new Map<number, WgerSourceExercise>();

    for (const row of rows) {
      const translation = row.translations?.find((item) => item.language === ENGLISH_LANGUAGE) ?? row.translations?.[0];
      if (!translation?.name) continue;
      map.set(row.id, {
        id: row.id,
        name: translation.name,
        category: row.category?.name ?? null,
        primaryMuscles: (row.muscles ?? []).map(nameFrom).filter((v): v is string => Boolean(v)),
        secondaryMuscles: (row.muscles_secondary ?? []).map(nameFrom).filter((v): v is string => Boolean(v)),
        equipment: (row.equipment ?? []).map((item) => item.name).filter((v): v is string => Boolean(v)),
      });
    }

    return map;
  }

  async fetchMedia(sourceExercises: Map<number, WgerSourceExercise>): Promise<WgerMediaItem[]> {
    const media: WgerMediaItem[] = [];
    const seen = new Set<string>();

    const add = (item: WgerMediaItem) => {
      const key = `${item.type}:${item.sourceExercise.id}:${item.originalUrl}`;
      if (seen.has(key)) return;
      seen.add(key);
      media.push(item);
    };

    // exerciseinfo carries canonical image/video references for many Wger rows.
    const infoRows = await this.fetchAllPages<WgerExerciseInfo>(`/exerciseinfo/?language=${ENGLISH_LANGUAGE}&limit=${PAGE_SIZE}`);
    for (const row of infoRows) {
      const sourceExercise = sourceExercises.get(row.id);
      if (!sourceExercise) continue;
      (row.images ?? []).forEach((image, index) => {
        if (!image.image) return;
        add({ sourceExercise, type: "IMAGE", originalUrl: image.image, displayOrder: image.is_main ? 0 : index + 1 });
      });
      (row.videos ?? []).forEach((video, index) => {
        if (!video.video) return;
        add({
          sourceExercise,
          type: "VIDEO",
          originalUrl: video.video,
          duration: video.duration ?? null,
          displayOrder: video.is_main ? 0 : index + 1,
        });
      });
    }

    await this.tryFetchEndpoint("/exerciseimage/?limit=100", "IMAGE", sourceExercises, add);
    await this.tryFetchEndpoint("/video/?limit=100", "VIDEO", sourceExercises, add);
    await this.tryFetchEndpoint("/exercisevideo/?limit=100", "VIDEO", sourceExercises, add);

    return media.sort((a, b) => a.sourceExercise.name.localeCompare(b.sourceExercise.name) || a.displayOrder - b.displayOrder);
  }

  private async tryFetchEndpoint(
    path: string,
    type: "IMAGE" | "VIDEO",
    sourceExercises: Map<number, WgerSourceExercise>,
    add: (item: WgerMediaItem) => void,
  ): Promise<void> {
    let rows: Array<Record<string, unknown>>;
    try {
      rows = await this.fetchAllPages<Record<string, unknown>>(path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("404")) return;
      throw error;
    }

    for (const row of rows) {
      const id = mediaExerciseId(row);
      if (id == null) continue;
      const sourceExercise = sourceExercises.get(id);
      if (!sourceExercise) continue;
      const originalUrl = type === "IMAGE" ? String(row.image ?? "") : String(row.video ?? row.file ?? "");
      if (!originalUrl || originalUrl === "null") continue;
      add({
        sourceExercise,
        type,
        originalUrl,
        thumbnailUrl: typeof row.thumbnail === "string" ? row.thumbnail : null,
        width: numberFromUnknown(row.width),
        height: numberFromUnknown(row.height),
        duration: numberFromUnknown(row.duration),
        displayOrder: numberFromUnknown(row.id) ?? 0,
      });
    }
  }
}
