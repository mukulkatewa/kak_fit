import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../../.env") });

import type { WgerExerciseInfo, WgerPaginated } from "./types";
import { fetchJson } from "./fetch-ipv4";

const WGER_BASE = "https://wger.de/api/v2";
const ENGLISH_LANGUAGE = 2;
const PAGE_SIZE = 50;

async function fetchPage<T>(url: string): Promise<WgerPaginated<T>> {
  return fetchJson<WgerPaginated<T>>(url);
}

async function fetchAllPages<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let url: string | null = `${WGER_BASE}${path}`;

  while (url) {
    const page = await fetchPage<T>(url);
    items.push(...page.results);
    url = page.next;
    await new Promise((r) => setTimeout(r, 200));
  }

  return items;
}

export async function importWgerExercises() {
  const { prisma } = await import("../src/index");

  console.log("Fetching Wger reference data...");
  const [muscles, equipment, categories, exercises] = await Promise.all([
    fetchAllPages<{ id: number; name: string; name_en?: string }>("/muscle/?limit=100"),
    fetchAllPages<{ id: number; name: string }>("/equipment/?limit=100"),
    fetchAllPages<{ id: number; name: string }>("/exercisecategory/?limit=100"),
    fetchAllPages<WgerExerciseInfo>(
      `/exerciseinfo/?language=${ENGLISH_LANGUAGE}&limit=${PAGE_SIZE}`,
    ),
  ]);

  console.log(`Upserting ${muscles.length} muscles...`);
  const muscleMap = new Map<number, string>();
  for (const muscle of muscles) {
    const record = await prisma.muscle.upsert({
      where: { wgerId: muscle.id },
      create: { wgerId: muscle.id, name: muscle.name_en || muscle.name },
      update: { name: muscle.name_en || muscle.name },
    });
    muscleMap.set(muscle.id, record.id);
  }

  console.log(`Upserting ${equipment.length} equipment types...`);
  const equipmentMap = new Map<number, string>();
  for (const item of equipment) {
    const record = await prisma.equipment.upsert({
      where: { wgerId: item.id },
      create: { wgerId: item.id, name: item.name },
      update: { name: item.name },
    });
    equipmentMap.set(item.id, record.id);
  }

  console.log(`Upserting ${categories.length} categories...`);
  const categoryMap = new Map<number, string>();
  for (const category of categories) {
    const record = await prisma.category.upsert({
      where: { wgerId: category.id },
      create: { wgerId: category.id, name: category.name },
      update: { name: category.name },
    });
    categoryMap.set(category.id, record.id);
  }

  console.log(`Importing ${exercises.length} exercises...`);
  let imported = 0;

  for (const item of exercises) {
    const translation =
      item.translations.find((t) => t.language === ENGLISH_LANGUAGE) ??
      item.translations[0];

    if (!translation?.name) continue;

    const image =
      item.images.find((img) => img.is_main) ?? item.images[0] ?? null;

    const exercise = await prisma.exercise.upsert({
      where: { wgerId: item.id },
      create: {
        wgerId: item.id,
        name: translation.name,
        instructions: translation.description || null,
        imageUrl: image?.image ?? null,
        categoryId: categoryMap.get(item.category.id) ?? null,
        isCustom: false,
      },
      update: {
        name: translation.name,
        instructions: translation.description || null,
        imageUrl: image?.image ?? null,
        categoryId: categoryMap.get(item.category.id) ?? null,
      },
    });

    await prisma.exerciseMuscle.deleteMany({ where: { exerciseId: exercise.id } });
    await prisma.exerciseEquipment.deleteMany({ where: { exerciseId: exercise.id } });

    const linkedMuscles = new Set<string>();

    for (const muscle of item.muscles) {
      const muscleId = muscleMap.get(muscle.id);
      if (!muscleId || linkedMuscles.has(muscleId)) continue;
      linkedMuscles.add(muscleId);
      await prisma.exerciseMuscle.create({
        data: { exerciseId: exercise.id, muscleId, isPrimary: true },
      });
    }

    for (const muscle of item.muscles_secondary) {
      const muscleId = muscleMap.get(muscle.id);
      if (!muscleId || linkedMuscles.has(muscleId)) continue;
      linkedMuscles.add(muscleId);
      await prisma.exerciseMuscle.create({
        data: { exerciseId: exercise.id, muscleId, isPrimary: false },
      });
    }

    for (const eq of item.equipment) {
      const equipmentId = equipmentMap.get(eq.id);
      if (!equipmentId) continue;
      await prisma.exerciseEquipment.create({
        data: { exerciseId: exercise.id, equipmentId },
      });
    }

    imported += 1;
    if (imported % 50 === 0) {
      console.log(`  ${imported}/${exercises.length} exercises...`);
    }
  }

  console.log(`Done. Imported ${imported} exercises.`);
  return { imported, muscles: muscles.length, equipment: equipment.length };
}

importWgerExercises()
  .then((result) => {
    console.log("Import summary:", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Import failed:", error);
    process.exit(1);
  });
