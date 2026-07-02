import type { MediaType } from "@prisma/client";

export type ImportOptions = {
  concurrency: number;
  force: boolean;
  dryRun: boolean;
  limit?: number;
  retries: number;
};

export type WgerSourceExercise = {
  id: number;
  name: string;
  category?: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
};

export type WgerMediaItem = {
  sourceExercise: WgerSourceExercise;
  type: MediaType;
  originalUrl: string;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  displayOrder: number;
};

export type MatchResult =
  | { status: "matched"; exerciseId: string; confidence: number; reason: string }
  | { status: "manual_review"; confidence: number; reason: string; candidates: Array<{ id: string; name: string; confidence: number }> };

export type ImportReport = {
  exercisesSeen: number;
  matched: number;
  manualReview: number;
  imagesDownloaded: number;
  videosDownloaded: number;
  imagesUploaded: number;
  videosUploaded: number;
  failedDownloads: number;
  failedUploads: number;
  duplicateMedia: number;
  skippedExisting: number;
  errors: Array<{ url?: string; exercise?: string; stage: string; message: string }>;
  startedAt: string;
  finishedAt?: string;
  executionTimeMs?: number;
};
