import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../../.env") });
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { prisma } from "@kak-fit/db";
import { sendDailyExerciseReminders } from "../src/services/daily-exercise-reminders";

function intArg(name: string, fallback?: number) {
  const prefix = `${name}=`;
  const raw = process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const report = await sendDailyExerciseReminders(prisma, {
    dryRun: args.has("--dry-run"),
    limit: intArg("--limit"),
    concurrency: intArg("--concurrency"),
  });

  console.log(JSON.stringify(report, null, 2));

  if (report.failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Daily exercise reminders failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
