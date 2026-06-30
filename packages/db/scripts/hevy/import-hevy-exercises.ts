import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(__dirname, "../../../../.env") });

import { createHevyClient } from "./hevy-api-client";
import {
  HEVY_EQUIPMENT,
  HEVY_EXERCISE_TYPES,
  HEVY_MUSCLE_GROUPS,
  hevySlugToName,
} from "./mappings";
import { ensureHevyCategory } from "./category-helpers";
import { loadSyncState, saveSyncState } from "./sync-log";
import type { HevyExerciseTemplate, HevyImportReport } from "./types";

const ERROR_LOG = resolve(__dirname, "hevy-import-errors.log");
const CHECKPOINT_FILE = resolve(__dirname, ".hevy-import-checkpoint.json");
const SKIP_IF_SYNCED_WITHIN_DAYS = 30;

async function logError(message: string) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  await appendFile(ERROR_LOG, line, "utf8");
}

async function withDbRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const delays = [0, 2000, 5000];
  let lastError: unknown;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) {
      console.log(`  Retrying ${label}...`);
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const code = (error as { code?: string }).code;
      if (code !== "P1001" && code !== "P1017") throw error;
    }
  }
  throw lastError;
}

function printProgress(phase: string, current: number, total: number) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  process.stdout.write(`\r[${phase}] ${current}/${total} (${pct}%)   `);
  if (current >= total) process.stdout.write("\n");
}

export async function importHevyExercises(options: {
  includeCustom?: boolean;
  dryRun?: boolean;
  resume?: boolean;
  force?: boolean;
} = {}) {
  const startedAt = Date.now();
  const client = createHevyClient({ debug: process.env.HEVY_API_DEBUG === "1" });
  const { prisma } = await import("../../src/index");

  const report: HevyImportReport = {
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: "",
    durationMs: 0,
    totalFetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  };

  await writeFile(ERROR_LOG, `--- Hevy import ${report.startedAt} ---\n`, "utf8");

  console.log("Phase 1: Reference data (muscles, equipment, categories from Hevy enums)");

  const muscleIdBySlug = new Map<string, string>();
  const equipmentIdBySlug = new Map<string, string>();
  const categoryIdBySlug = new Map<string, string>();

  if (options.dryRun) {
    for (const slug of HEVY_MUSCLE_GROUPS) muscleIdBySlug.set(slug, slug);
    for (const slug of HEVY_EQUIPMENT) equipmentIdBySlug.set(slug, slug);
    for (const slug of HEVY_EXERCISE_TYPES) categoryIdBySlug.set(slug, slug);
    console.log(`  (dry-run) ${muscleIdBySlug.size} muscles, ${equipmentIdBySlug.size} equipment, ${categoryIdBySlug.size} types`);
  } else {
    for (const slug of HEVY_MUSCLE_GROUPS) {
      const name = hevySlugToName(slug);
      let record = await prisma.muscle.findFirst({ where: { name } });
      if (!record) {
        record = await withDbRetry(() => prisma.muscle.create({ data: { name } }), `muscle ${name}`);
      }
      muscleIdBySlug.set(slug, record.id);
    }
    console.log(`  ✓ ${muscleIdBySlug.size} muscles`);

    for (const slug of HEVY_EQUIPMENT) {
      const name = hevySlugToName(slug);
      let record = await prisma.equipment.findFirst({ where: { name } });
      if (!record) {
        record = await withDbRetry(
          () => prisma.equipment.create({ data: { name } }),
          `equipment ${name}`,
        );
      }
      equipmentIdBySlug.set(slug, record.id);
    }
    console.log(`  ✓ ${equipmentIdBySlug.size} equipment types`);

    for (const slug of HEVY_EXERCISE_TYPES) {
      const name = `Hevy: ${hevySlugToName(slug)}`;
      const existing = await prisma.category.findFirst({ where: { name } });
      const record =
        existing ??
        (await withDbRetry(
          () => prisma.category.create({ data: { name } }),
          `category ${name}`,
        ));
      categoryIdBySlug.set(slug, record.id);
    }
    console.log(`  ✓ ${categoryIdBySlug.size} exercise type categories`);
  }

  console.log("\nPhase 2: Fetch exercise templates from Hevy API");
  const templates = await client.paginate<HevyExerciseTemplate>(
    "/v1/exercise_templates",
    "exercise_templates",
    100,
  );
  report.totalFetched = templates.length;
  console.log(`  ✓ Fetched ${templates.length} templates (${client.requestCount} API requests)`);

  if (!options.dryRun) {
    const typeSlugs = new Set(templates.map((t) => t.type));
    for (const slug of typeSlugs) {
      await ensureHevyCategory(prisma, slug, categoryIdBySlug);
    }
    console.log(`  ✓ Ensured ${typeSlugs.size} exercise type categories from live API`);
  }

  let startIndex = 0;
  if (options.resume) {
    try {
      const cp = JSON.parse(await readFile(CHECKPOINT_FILE, "utf8")) as { index: number };
      startIndex = cp.index ?? 0;
      console.log(`  Resuming from index ${startIndex}`);
    } catch {
      /* fresh run */
    }
  }

  console.log("\nPhase 3: Upsert exercises");
  const catalog = options.includeCustom
    ? templates
    : templates.filter((t) => !t.is_custom);

  for (let i = startIndex; i < catalog.length; i++) {
    const item = catalog[i]!;
    printProgress("exercises", i + 1, catalog.length);

    if (options.dryRun) {
      report.skipped += 1;
      continue;
    }

    try {
      const existing = await prisma.exercise.findUnique({ where: { hevyId: item.id } });
      const skipFresh =
        !options.force &&
        existing?.hevyUpdatedAt &&
        Date.now() - existing.hevyUpdatedAt.getTime() < SKIP_IF_SYNCED_WITHIN_DAYS * 86_400_000;

      if (skipFresh) {
        report.skipped += 1;
        continue;
      }

      const categoryId = await ensureHevyCategory(prisma, item.type, categoryIdBySlug);
      const equipmentId = equipmentIdBySlug.get(item.equipment);

      const exercise = await withDbRetry(
        () =>
          prisma.exercise.upsert({
            where: { hevyId: item.id },
            create: {
              hevyId: item.id,
              name: item.title,
              categoryId,
              isCustom: false,
              hevyUpdatedAt: new Date(),
            },
            update: {
              name: item.title,
              categoryId,
              hevyUpdatedAt: new Date(),
            },
          }),
        item.title,
      );

      if (existing) report.updated += 1;
      else report.created += 1;

      await withDbRetry(
        () => prisma.exerciseMuscle.deleteMany({ where: { exerciseId: exercise.id } }),
        "delete muscles",
      );
      await withDbRetry(
        () => prisma.exerciseEquipment.deleteMany({ where: { exerciseId: exercise.id } }),
        "delete equipment",
      );

      const primaryId = muscleIdBySlug.get(item.primary_muscle_group);
      if (primaryId) {
        await withDbRetry(
          () =>
            prisma.exerciseMuscle.create({
              data: { exerciseId: exercise.id, muscleId: primaryId, isPrimary: true },
            }),
          "primary muscle",
        );
      }

      for (const slug of item.secondary_muscle_groups) {
        const muscleId = muscleIdBySlug.get(slug);
        if (!muscleId) continue;
        await withDbRetry(
          () =>
            prisma.exerciseMuscle.upsert({
              where: { exerciseId_muscleId: { exerciseId: exercise.id, muscleId } },
              create: { exerciseId: exercise.id, muscleId, isPrimary: false },
              update: { isPrimary: false },
            }),
          "secondary muscle",
        );
      }

      if (equipmentId) {
        await withDbRetry(
          () =>
            prisma.exerciseEquipment.create({
              data: { exerciseId: exercise.id, equipmentId },
            }),
          "equipment link",
        );
      }

      if ((i + 1) % 25 === 0) {
        await writeFile(CHECKPOINT_FILE, JSON.stringify({ index: i + 1 }), "utf8");
      }
    } catch (error) {
      report.failed += 1;
      const msg = error instanceof Error ? error.message : String(error);
      report.failures.push({ hevyId: item.id, title: item.title, error: msg });
      await logError(`${item.id} ${item.title}: ${msg}`);
    }
  }

  console.log("\nPhase 4: Media — skipped (Hevy public API does not expose images/videos)");

  report.finishedAt = new Date().toISOString();
  report.durationMs = Date.now() - startedAt;

  const syncState = await loadSyncState();
  syncState.lastFullSyncAt = report.finishedAt;
  syncState.exercisesCreated += report.created;
  syncState.exercisesUpdated += report.updated;
  syncState.exercisesSkipped += report.skipped;
  syncState.apiRequests += client.requestCount;
  if (report.failures.length) {
    syncState.errors.push(...report.failures.map((f) => `${f.hevyId}: ${f.error}`));
  }
  await saveSyncState(syncState);

  console.log("\n=== Import complete ===");
  console.log(`  Created:  ${report.created}`);
  console.log(`  Updated:  ${report.updated}`);
  console.log(`  Skipped:  ${report.skipped}`);
  console.log(`  Failed:   ${report.failed}`);
  console.log(`  Duration: ${(report.durationMs / 1000).toFixed(1)}s`);

  return report;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const includeCustom = process.argv.includes("--include-custom");
  const resume = process.argv.includes("--resume");
  const force = process.argv.includes("--force");

  await importHevyExercises({ dryRun, includeCustom, resume, force });
}

if (process.argv[1]?.includes("import-hevy-exercises")) {
  main().catch(async (error) => {
    console.error(error);
    await logError(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}