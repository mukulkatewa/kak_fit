import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../../../.env") });

import { createHevyClient } from "./hevy-api-client";
import type { HevyExerciseTemplate, HevyPaginatedExerciseTemplates } from "./types";
import {
  HEVY_EQUIPMENT,
  HEVY_EXERCISE_TYPES,
  HEVY_MUSCLE_GROUPS,
  hevySlugToName,
} from "./mappings";

const ENDPOINTS = [
  { name: "user-info", path: "/v1/user/info", arrayKey: null },
  { name: "exercise-templates-page1", path: "/v1/exercise_templates?page=1&pageSize=5", arrayKey: "exercise_templates" },
  { name: "workouts-count", path: "/v1/workouts/count", arrayKey: null },
  { name: "routines-page1", path: "/v1/routines?page=1&pageSize=2", arrayKey: "routines" },
  { name: "routine-folders-page1", path: "/v1/routine_folders?page=1&pageSize=5", arrayKey: "routine_folders" },
] as const;

async function main() {
  console.log("=== Hevy API connectivity test ===\n");

  const client = createHevyClient({ debug: true });

  console.log("1. Authentication (GET /v1/user/info)");
  const user = await client.get<{ data: { id: string; name: string; url: string } }>("/v1/user/info");
  console.log(`   ✓ Authenticated as: ${user.data.name} (${user.data.id})`);
  await client.saveSample("user-info", user);

  console.log("\n2. Exercise catalog (GET /v1/exercise_templates)");
  const templates = await client.get<HevyPaginatedExerciseTemplates>(
    "/v1/exercise_templates?page=1&pageSize=5",
  );
  const first = templates.exercise_templates[0];
  if (!first) throw new Error("No exercise templates returned");
  console.log(`   ✓ Page 1/${templates.page_count}, sample: "${first.title}" (${first.id})`);
  console.log(`   Fields: ${Object.keys(first).join(", ")}`);
  await client.saveSample("exercise-templates-page1", templates);

  const single = await client.get<{ exercise_template: HevyExerciseTemplate }>(
    `/v1/exercise_templates/${first.id}`,
  );
  await client.saveSample("exercise-template-single", single);
  console.log(`   ✓ Single template fetch OK: ${single.exercise_template?.title ?? first.title}`);

  console.log("\n3. Endpoints NOT in Hevy public API (documented for reference):");
  const missing = [
    "/exercises",
    "/exercises/:id",
    "/muscles",
    "/equipment",
    "/categories",
    "/images",
    "/media",
  ];
  for (const ep of missing) {
    console.log(`   ✗ ${ep} — use /v1/exercise_templates instead (muscles/equipment are enum fields)`);
  }

  console.log("\n4. Derived reference data (from OpenAPI enums, not separate endpoints):");
  console.log(`   Muscles: ${HEVY_MUSCLE_GROUPS.length} (${HEVY_MUSCLE_GROUPS.slice(0, 3).map(hevySlugToName).join(", ")}…)`);
  console.log(`   Equipment: ${HEVY_EQUIPMENT.length} (${HEVY_EQUIPMENT.slice(0, 3).map(hevySlugToName).join(", ")}…)`);
  console.log(`   Exercise types: ${HEVY_EXERCISE_TYPES.length}`);

  console.log("\n5. Saving additional endpoint samples...");
  for (const ep of ENDPOINTS) {
    if (ep.name === "user-info" || ep.name === "exercise-templates-page1") continue;
    try {
      const data = await client.get(ep.path);
      const file = await client.saveSample(ep.name, data);
      console.log(`   ✓ ${ep.path} → ${file}`);
    } catch (error) {
      console.log(`   ⚠ ${ep.path}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`\n6. Rate limit / quota:`);
  console.log(`   Requests made this run: ${client.requestCount}`);
  console.log(`   Hevy does not expose quota headers; client defaults to 30 req/min.`);

  console.log("\n✓ All connectivity checks passed. Samples saved to packages/db/scripts/hevy/hevy-api-samples/");
}

main().catch((error) => {
  console.error("\n✗ Hevy API test failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
