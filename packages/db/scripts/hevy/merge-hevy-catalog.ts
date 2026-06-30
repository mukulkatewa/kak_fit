import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(__dirname, "../../../../.env") });

import { normalizeExerciseName } from "../../../api/src/lib/exercise-name";

const LOG = resolve(__dirname, "hevy-merge.log");

type ExerciseRow = {
  id: string;
  name: string;
  hevyId: string | null;
  wgerId: number | null;
  imageUrl: string | null;
  instructions: string | null;
  categoryId: string | null;
  muscles: { muscleId: string; isPrimary: boolean }[];
  equipment: { equipmentId: string }[];
};

async function log(line: string) {
  console.log(line);
  await appendFile(LOG, `${line}\n`, "utf8");
}

async function withDbRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const delays = [0, 2000, 5000];
  let lastError: unknown;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await new Promise((r) => setTimeout(r, delays[attempt]));
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

function pickWgerTarget(candidates: ExerciseRow[]): ExerciseRow {
  return candidates.reduce((best, cur) => {
    const score = (e: ExerciseRow) =>
      (e.imageUrl ? 100 : 0) + (e.instructions?.trim() ? 20 : 0) + ((e.wgerId ?? 0) > 0 ? 10 : 0);
    return score(cur) > score(best) ? cur : best;
  });
}

async function main() {
  const { prisma } = await import("../../src/index");
  await appendFile(LOG, `--- merge ${new Date().toISOString()} ---\n`, "utf8");

  const all = await prisma.exercise.findMany({
    where: { isCustom: false },
    include: {
      muscles: { select: { muscleId: true, isPrimary: true } },
      equipment: { select: { equipmentId: true } },
    },
  });

  const wgerByNorm = new Map<string, ExerciseRow[]>();
  const hevyRows: ExerciseRow[] = [];

  for (const row of all) {
    const exercise: ExerciseRow = {
      id: row.id,
      name: row.name,
      hevyId: row.hevyId,
      wgerId: row.wgerId,
      imageUrl: row.imageUrl,
      instructions: row.instructions,
      categoryId: row.categoryId,
      muscles: row.muscles,
      equipment: row.equipment,
    };
    if (row.hevyId && !row.wgerId) {
      hevyRows.push(exercise);
      continue;
    }
    if (row.wgerId != null) {
      const key = normalizeExerciseName(row.name);
      const list = wgerByNorm.get(key) ?? [];
      list.push(exercise);
      wgerByNorm.set(key, list);
    }
  }

  await log(`Hevy-only rows to map: ${hevyRows.length}`);
  await log(`Wger normalized groups: ${wgerByNorm.size}`);

  let linked = 0;
  let keptHevyOnly = 0;

  for (const hevy of hevyRows) {
    const key = normalizeExerciseName(hevy.name);
    const wgerCandidates = wgerByNorm.get(key);

    if (!wgerCandidates?.length) {
      keptHevyOnly += 1;
      continue;
    }

    const target = pickWgerTarget(wgerCandidates);
    const hevyId = hevy.hevyId!;

    await withDbRetry(
      () =>
        prisma.$transaction(async (tx) => {
          for (const muscle of hevy.muscles) {
            await tx.exerciseMuscle.upsert({
              where: {
                exerciseId_muscleId: { exerciseId: target.id, muscleId: muscle.muscleId },
              },
              create: {
                exerciseId: target.id,
                muscleId: muscle.muscleId,
                isPrimary: muscle.isPrimary,
              },
              update: {},
            });
          }

          for (const eq of hevy.equipment) {
            await tx.exerciseEquipment.upsert({
              where: {
                exerciseId_equipmentId: { exerciseId: target.id, equipmentId: eq.equipmentId },
              },
              create: { exerciseId: target.id, equipmentId: eq.equipmentId },
              update: {},
            });
          }

          await tx.exercise.delete({ where: { id: hevy.id } });

          await tx.exercise.update({
            where: { id: target.id },
            data: { hevyId, hevyUpdatedAt: new Date() },
          });
        }),
      `link ${hevy.name}`,
    );

    linked += 1;
    await log(`  linked: "${hevy.name}" → Wger "${target.name}" (hevyId ${hevyId})`);
  }

  await log(`\n=== Merge complete ===`);
  await log(`  Linked to Wger:     ${linked}`);
  await log(`  Hevy-only kept:     ${keptHevyOnly}`);

  const [total, both, hevyOnly, wgerOnly] = await Promise.all([
    prisma.exercise.count({ where: { isCustom: false } }),
    prisma.exercise.count({
      where: { hevyId: { not: null }, wgerId: { not: null }, isCustom: false },
    }),
    prisma.exercise.count({
      where: { hevyId: { not: null }, wgerId: null, isCustom: false },
    }),
    prisma.exercise.count({
      where: { wgerId: { not: null }, hevyId: null, isCustom: false },
    }),
  ]);

  await log(`  Catalog total:      ${total}`);
  await log(`  Wger+Hevy linked:   ${both}`);
  await log(`  Hevy-only:          ${hevyOnly}`);
  await log(`  Wger-only:          ${wgerOnly}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
