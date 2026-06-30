import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../../../.env") });

async function main() {
  const { prisma } = await import("../../src/index");

  const [total, hevy, wger, both, hevyOnly, wgerOnly] = await Promise.all([
    prisma.exercise.count({ where: { isCustom: false } }),
    prisma.exercise.count({ where: { hevyId: { not: null }, isCustom: false } }),
    prisma.exercise.count({ where: { wgerId: { not: null }, isCustom: false } }),
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

  console.log({ total, hevy, wger, both, hevyOnly, wgerOnly });

  const dupes = await prisma.$queryRaw<{ n: string; c: number }[]>`
    SELECT lower(name) as n, count(*)::int as c
    FROM "Exercise"
    WHERE "isCustom" = false
    GROUP BY lower(name)
    HAVING count(*) > 1
    ORDER BY c DESC
    LIMIT 15
  `;
  console.log("duplicate names:", dupes);

  await prisma.$disconnect();
}

main();
