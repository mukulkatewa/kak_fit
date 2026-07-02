import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../../../.env") });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { prisma } from "../../src";
import { createReport, writeReport } from "./services/ReportGenerator";
import { MediaImporter } from "./services/MediaImporter";
import { WgerClient } from "./services/WgerClient";
import type { ImportOptions } from "./types";

function readArgs(): ImportOptions {
  const args = new Set(process.argv.slice(2));
  const value = (name: string, fallback: number) => {
    const prefix = `${name}=`;
    const raw = process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
    const parsed = raw ? Number.parseInt(raw, 10) : fallback;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    concurrency: value("--concurrency", Number.parseInt(process.env.WGER_MEDIA_CONCURRENCY ?? "6", 10) || 6),
    force: args.has("--force"),
    dryRun: args.has("--dry-run"),
    limit: process.argv.some((arg) => arg.startsWith("--limit=")) ? value("--limit", 0) : undefined,
    retries: value("--retries", 3),
  };
}

async function main() {
  const startedMs = Date.now();
  const options = readArgs();
  const report = createReport();
  const client = new WgerClient();

  console.log("Fetching Wger exercise metadata...");
  const sourceExercises = await client.fetchSourceExercises();
  console.log(`Fetched ${sourceExercises.size} Wger exercises.`);

  console.log("Fetching Wger image/video references...");
  const media = await client.fetchMedia(sourceExercises);
  console.log(`Found ${media.length} media references.`);

  const importer = new MediaImporter(prisma, options, report);
  await importer.import(media);

  const reportPath = await writeReport(report, startedMs);
  console.log("Wger media import complete.");
  console.log(JSON.stringify(report, null, 2));
  console.log(`Report written to ${reportPath}`);
}

main()
  .catch((error) => {
    console.error("Wger media import failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
