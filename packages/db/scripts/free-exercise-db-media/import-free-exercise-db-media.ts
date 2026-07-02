import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../../../.env") });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { prisma } from "../../src";
import { createReport, writeReport } from "../wger-media/services/ReportGenerator";
import type { ImportOptions } from "../wger-media/types";
import { FreeExerciseDbClient } from "./services/FreeExerciseDbClient";
import { FreeExerciseDbMediaImporter, type FreeExerciseDbImportOptions } from "./services/FreeExerciseDbMediaImporter";

function readArgs(): FreeExerciseDbImportOptions {
  const args = new Set(process.argv.slice(2));
  const value = (name: string, fallback: number) => {
    const prefix = `${name}=`;
    const raw = process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
    const parsed = raw ? Number.parseInt(raw, 10) : fallback;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const base: ImportOptions = {
    concurrency: value("--concurrency", Number.parseInt(process.env.FREE_EXERCISE_DB_MEDIA_CONCURRENCY ?? "8", 10) || 8),
    force: args.has("--force"),
    dryRun: args.has("--dry-run"),
    limit: process.argv.some((arg) => arg.startsWith("--limit=")) ? value("--limit", 0) : undefined,
    retries: value("--retries", 3),
  };

  return { ...base, fillExisting: args.has("--fill-existing") };
}

async function main() {
  const startedMs = Date.now();
  const options = readArgs();
  const report = createReport();
  const client = new FreeExerciseDbClient();

  console.log("Fetching free-exercise-db metadata...");
  const exercises = await client.fetchExercises();
  console.log(`Fetched ${exercises.length} free-exercise-db exercises with images.`);

  const importer = new FreeExerciseDbMediaImporter(prisma, options, report);
  await importer.import(exercises);

  const reportPath = await writeReport(report, startedMs, "free-exercise-db-media-import");
  console.log("free-exercise-db media import complete.");
  console.log(JSON.stringify(report, null, 2));
  console.log(`Report written to ${reportPath}`);
}

main()
  .catch((error) => {
    console.error("free-exercise-db media import failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
