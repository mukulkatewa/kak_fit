import type { PrismaClient } from "@prisma/client";
import { ExerciseMatcher } from "../../wger-media/services/ExerciseMatcher";
import { MediaDownloader } from "../../wger-media/services/MediaDownloader";
import { MediaRepository } from "../../wger-media/services/MediaRepository";
import { StorageUploader } from "../../wger-media/services/StorageUploader";
import type { ImportOptions, ImportReport, WgerMediaItem } from "../../wger-media/types";
import { FREE_EXERCISE_DB_SOURCE, imageUrlForFreeExerciseDbPath, type FreeExerciseDbExercise } from "./FreeExerciseDbClient";

export type FreeExerciseDbImportOptions = ImportOptions & {
  fillExisting: boolean;
};

async function runPool<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]!, index);
    }
  });
  await Promise.all(workers);
}

export class FreeExerciseDbMediaImporter {
  private matcher: ExerciseMatcher;
  private downloader: MediaDownloader;
  private repository: MediaRepository;
  private uploader = new StorageUploader();
  private matchedExercises = new Set<string>();
  private manualReviewExercises = new Set<string | number>();

  constructor(
    private prisma: PrismaClient,
    private options: FreeExerciseDbImportOptions,
    private report: ImportReport,
  ) {
    this.matcher = new ExerciseMatcher(prisma);
    this.downloader = new MediaDownloader(options.retries);
    this.repository = new MediaRepository(prisma);
  }

  async import(exercises: FreeExerciseDbExercise[]) {
    await this.matcher.load();
    const limited = this.options.limit ? exercises.slice(0, this.options.limit) : exercises;
    this.report.exercisesSeen = limited.length;

    let processed = 0;
    await runPool(limited, this.options.concurrency, async (exercise) => {
      await this.processExercise(exercise).catch((error) => {
        this.report.errors.push({
          exercise: exercise.name,
          stage: "process",
          message: error instanceof Error ? error.message : String(error),
        });
      });
      processed += 1;
      if (processed % 25 === 0 || processed === limited.length) {
        console.log(
          `[free-exercise-db-media] processed ${processed}/${limited.length} matched=${this.report.matched} uploaded=${this.report.imagesUploaded} skipped=${this.report.skippedExisting} failed=${this.report.failedDownloads + this.report.failedUploads}`,
        );
      }
    });
  }

  private async processExercise(sourceExercise: FreeExerciseDbExercise) {
    const match = this.matcher.match(sourceExercise);
    if (match.status !== "matched") {
      this.manualReviewExercises.add(sourceExercise.id);
      this.report.manualReview = this.manualReviewExercises.size;
      this.report.errors.push({
        exercise: sourceExercise.name,
        stage: "match",
        message: `${match.reason}; confidence=${match.confidence}`,
      });
      return;
    }

    this.matchedExercises.add(match.exerciseId);
    this.report.matched = this.matchedExercises.size;
    if (this.options.dryRun) return;

    const existingImages = await this.repository.countImages(match.exerciseId);
    if (existingImages > 0 && !this.options.fillExisting && !this.options.force) {
      this.report.skippedExisting += sourceExercise.images.length;
      return;
    }

    for (const [index, imagePath] of sourceExercise.images.entries()) {
      const item: WgerMediaItem = {
        sourceExercise,
        type: "IMAGE",
        originalUrl: imageUrlForFreeExerciseDbPath(imagePath),
        mimeType: "image/jpeg",
        displayOrder: existingImages + index,
        source: FREE_EXERCISE_DB_SOURCE,
      };
      await this.processImage(match.exerciseId, item);
    }
  }

  private async processImage(exerciseId: string, item: WgerMediaItem) {
    const exists = await this.repository.exists(exerciseId, item.originalUrl);
    if (exists && !this.options.force) {
      this.report.duplicateMedia += 1;
      this.report.skippedExisting += 1;
      return;
    }

    let downloaded;
    try {
      downloaded = await this.downloader.download(item.originalUrl);
      this.report.imagesDownloaded += 1;
    } catch (error) {
      this.report.failedDownloads += 1;
      this.report.errors.push({
        url: item.originalUrl,
        exercise: item.sourceExercise.name,
        stage: "download",
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    let upload;
    try {
      upload = await this.uploader.upload({
        bytes: downloaded.bytes,
        originalUrl: item.originalUrl,
        contentType: downloaded.mimeType ?? item.mimeType,
        type: item.type,
        source: FREE_EXERCISE_DB_SOURCE,
      });
      this.report.imagesUploaded += 1;
    } catch (error) {
      this.report.failedUploads += 1;
      this.report.errors.push({
        url: item.originalUrl,
        exercise: item.sourceExercise.name,
        stage: "upload",
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const repo = new MediaRepository(tx as PrismaClient);
      await repo.upsertMedia({
        exerciseId,
        item,
        storageUrl: upload.storageUrl,
        fileSize: downloaded.fileSize,
        mimeType: downloaded.mimeType ?? item.mimeType,
        force: this.options.force,
        source: FREE_EXERCISE_DB_SOURCE,
      });
    });
  }
}
