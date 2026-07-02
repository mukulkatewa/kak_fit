import type { PrismaClient } from "@prisma/client";
import { ExerciseMatcher } from "./ExerciseMatcher";
import { MediaDownloader } from "./MediaDownloader";
import { MediaRepository } from "./MediaRepository";
import { StorageUploader } from "./StorageUploader";
import { maybeTranscodeVideo } from "./MediaTranscoder";
import type { ImportOptions, ImportReport, WgerMediaItem } from "../types";

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

export class MediaImporter {
  private matcher: ExerciseMatcher;
  private downloader: MediaDownloader;
  private repository: MediaRepository;
  private uploader = new StorageUploader();
  private matchedExercises = new Set<string>();
  private manualReviewExercises = new Set<number>();

  constructor(
    private prisma: PrismaClient,
    private options: ImportOptions,
    private report: ImportReport,
  ) {
    this.matcher = new ExerciseMatcher(prisma);
    this.downloader = new MediaDownloader(options.retries);
    this.repository = new MediaRepository(prisma);
  }

  async import(items: WgerMediaItem[]) {
    await this.matcher.load();
    const limited = this.options.limit ? items.slice(0, this.options.limit) : items;
    this.report.exercisesSeen = new Set(limited.map((item) => item.sourceExercise.id)).size;

    let processed = 0;
    await runPool(limited, this.options.concurrency, async (item) => {
      await this.processItem(item).catch((error) => {
        this.report.errors.push({
          url: item.originalUrl,
          exercise: item.sourceExercise.name,
          stage: "process",
          message: error instanceof Error ? error.message : String(error),
        });
      });
      processed += 1;
      if (processed % 25 === 0 || processed === limited.length) {
        console.log(
          `[wger-media] processed ${processed}/${limited.length} matched=${this.report.matched} uploaded=${this.report.imagesUploaded + this.report.videosUploaded} skipped=${this.report.skippedExisting} failed=${this.report.failedDownloads + this.report.failedUploads}`,
        );
      }
    });
  }

  private async processItem(item: WgerMediaItem) {
    const match = this.matcher.match(item.sourceExercise);
    if (match.status !== "matched") {
      this.manualReviewExercises.add(item.sourceExercise.id);
      this.report.manualReview = this.manualReviewExercises.size;
      this.report.errors.push({
        url: item.originalUrl,
        exercise: item.sourceExercise.name,
        stage: "match",
        message: `${match.reason}; confidence=${match.confidence}`,
      });
      return;
    }
    this.matchedExercises.add(match.exerciseId);
    this.report.matched = this.matchedExercises.size;

    if (this.options.dryRun) return;

    const exists = await this.repository.exists(match.exerciseId, item.originalUrl);
    if (exists && !this.options.force) {
      this.report.duplicateMedia += 1;
      this.report.skippedExisting += 1;
      return;
    }

    let downloaded;
    try {
      downloaded = await this.downloader.download(item.originalUrl);
      if (item.type === "IMAGE") this.report.imagesDownloaded += 1;
      else this.report.videosDownloaded += 1;
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

    if (item.type === "VIDEO") {
      try {
        const video = await maybeTranscodeVideo(downloaded.bytes, downloaded.mimeType ?? item.mimeType ?? null);
        downloaded = { bytes: video.bytes, mimeType: video.mimeType, fileSize: video.fileSize };
      } catch (error) {
        this.report.errors.push({
          url: item.originalUrl,
          exercise: item.sourceExercise.name,
          stage: "transcode",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    let upload;
    try {
      upload = await this.uploader.upload({
        bytes: downloaded.bytes,
        originalUrl: item.originalUrl,
        contentType: downloaded.mimeType ?? item.mimeType,
        type: item.type,
      });
      if (item.type === "IMAGE") this.report.imagesUploaded += 1;
      else this.report.videosUploaded += 1;
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
        exerciseId: match.exerciseId,
        item,
        storageUrl: upload.storageUrl,
        fileSize: downloaded.fileSize,
        mimeType: downloaded.mimeType ?? item.mimeType,
        force: this.options.force,
      });
    });
  }
}
