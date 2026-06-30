import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../../../.env") });

import { importHevyExercises } from "./import-hevy-exercises";
import { loadSyncState, saveSyncState } from "./sync-log";

/**
 * Incremental Hevy sync.
 * Note: Hevy API has no `updated_since` filter on exercise_templates.
 * This re-fetches the catalog and skips exercises synced within 30 days.
 */
async function main() {
  console.log("=== Hevy incremental exercise sync ===\n");
  console.log("Hevy does not expose updated_since — skipping items synced in the last 30 days.\n");

  const state = await loadSyncState();
  const report = await importHevyExercises({ resume: true });

  state.lastIncrementalSyncAt = report.finishedAt;
  await saveSyncState(state);

  console.log("\nSync state updated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
