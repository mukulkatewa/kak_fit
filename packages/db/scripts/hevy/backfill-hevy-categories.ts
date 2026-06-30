/**
 * Fast fix: assign missing Hevy exercise-type categories without full re-import.
 * Usage: DATABASE_URL="$DIRECT_URL" tsx scripts/hevy/backfill-hevy-categories.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../../../.env") });

import { createHevyClient } from "./hevy-api-client";
import { ensureHevyCategory } from "./category-helpers";

async function main() {
  const { prisma } = await import("../../src/index");
  const client = createHevyClient();
  const cache = new Map<string, string>();

  const templates = await client.paginate<{
    id: string;
    title: string;
    type: string;
    is_custom: boolean;
  }>("/v1/exercise_templates", "exercise_templates", 100);

  const byHevyId = new Map(
    templates.filter((t) => !t.is_custom).map((t) => [t.id, t]),
  );

  const missing = await prisma.exercise.findMany({
    where: { hevyId: { not: null }, categoryId: null, isCustom: false },
    select: { id: true, hevyId: true, name: true },
  });

  console.log(`Fixing ${missing.length} exercises without category...`);

  let fixed = 0;
  for (const ex of missing) {
    const template = ex.hevyId ? byHevyId.get(ex.hevyId) : undefined;
    if (!template) {
      console.warn(`  skip ${ex.hevyId} ${ex.name} — not in Hevy global catalog`);
      continue;
    }
    const categoryId = await ensureHevyCategory(prisma, template.type, cache);
    await prisma.exercise.update({
      where: { id: ex.id },
      data: { categoryId, hevyUpdatedAt: new Date() },
    });
    fixed += 1;
    console.log(`  ✓ ${ex.name} → ${template.type}`);
  }

  console.log(`\nDone. Fixed ${fixed}/${missing.length}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
