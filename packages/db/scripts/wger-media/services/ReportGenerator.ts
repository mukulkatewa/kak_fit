import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ImportReport } from "../types";

export function createReport(): ImportReport {
  return {
    exercisesSeen: 0,
    matched: 0,
    manualReview: 0,
    imagesDownloaded: 0,
    videosDownloaded: 0,
    imagesUploaded: 0,
    videosUploaded: 0,
    failedDownloads: 0,
    failedUploads: 0,
    duplicateMedia: 0,
    skippedExisting: 0,
    errors: [],
    startedAt: new Date().toISOString(),
  };
}

export async function writeReport(report: ImportReport, startedMs: number, prefix = "wger-media-import"): Promise<string> {
  report.finishedAt = new Date().toISOString();
  report.executionTimeMs = Date.now() - startedMs;
  const dir = resolve(process.cwd(), "../../results");
  await mkdir(dir, { recursive: true });
  const path = resolve(dir, `${prefix}-${Date.now()}.json`);
  await writeFile(path, JSON.stringify(report, null, 2));
  return path;
}
