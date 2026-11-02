import * as SQLite from "expo-sqlite";
import { createTRPCClient } from "./trpc";
import { isNetworkError } from "./network-errors";
export { isNetworkError } from "./network-errors";

export type OfflineWorkoutMutationType =
  | "updateSet"
  | "updateExerciseNotes"
  | "finishWorkout"
  | "addSet"
  | "deleteSet"
  | "addExercise";

type OfflineWorkoutMutation = {
  id: number;
  type: OfflineWorkoutMutationType;
  payload: string;
  createdAt: number;
  retryCount: number;
  status: "pending" | "failed";
};

export type QueuedMutation = OfflineWorkoutMutation;

export type SyncQueuedWorkoutResult = {
  synced: number;
  remaining: number;
  syncFailed: boolean;
  failed: number;
};

/** Mutations that change workout structure — refetch active workout after sync. */
const STRUCTURAL_MUTATIONS = new Set<OfflineWorkoutMutationType>([
  "addSet",
  "deleteSet",
  "addExercise",
]);

const MAX_SYNC_RETRIES = 3;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
// Singleton TRPC client — avoid creating a new one per sync cycle.
let trpcClientSingleton: ReturnType<typeof createTRPCClient> | null = null;
function getTrpcClient() {
  trpcClientSingleton ??= createTRPCClient();
  return trpcClientSingleton;
}

async function ensureSchema(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS offline_workout_mutations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending'
    );
  `);

  const columns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(offline_workout_mutations)",
  );
  if (!columns.some((column) => column.name === "retry_count")) {
    await db.execAsync(
      "ALTER TABLE offline_workout_mutations ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0",
    );
  }
  if (!columns.some((column) => column.name === "status")) {
    await db.execAsync(
      "ALTER TABLE offline_workout_mutations ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'",
    );
  }
}

function getDb() {
  dbPromise ??= SQLite.openDatabaseAsync("kak-fit-offline.db").then(async (db) => {
    await ensureSchema(db);
    return db;
  });
  return dbPromise;
}

export async function enqueueWorkoutMutation(type: OfflineWorkoutMutationType, payload: unknown) {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO offline_workout_mutations (type, payload, created_at, retry_count) VALUES (?, ?, ?, 0)",
    type,
    JSON.stringify(payload),
    Date.now(),
  );
}

export async function getQueuedWorkoutMutationCount() {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM offline_workout_mutations WHERE status = 'pending'",
  );
  return row?.count ?? 0;
}

export async function hasPendingFinishWorkout() {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM offline_workout_mutations WHERE status = 'pending' AND type = 'finishWorkout'",
  );
  return (row?.count ?? 0) > 0;
}

export async function clearPendingFinishWorkout() {
  const db = await getDb();
  await db.runAsync(
    "DELETE FROM offline_workout_mutations WHERE type = 'finishWorkout' AND status = 'pending'",
  );
}

export async function getPendingNotesExerciseIds() {
  const db = await getDb();
  const rows = await db.getAllAsync<{ payload: string }>(
    "SELECT payload FROM offline_workout_mutations WHERE status = 'pending' AND type = 'updateExerciseNotes'",
  );
  return rows.map((row) => (JSON.parse(row.payload) as { workoutExerciseId: string }).workoutExerciseId);
}

export async function getFailedMutations(): Promise<QueuedMutation[]> {
  const db = await getDb();
  return db.getAllAsync<QueuedMutation>(
    "SELECT id, type, payload, created_at as createdAt, retry_count as retryCount, status FROM offline_workout_mutations WHERE status = ? ORDER BY created_at ASC",
    "failed",
  );
}

export async function retryFailedMutations(): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE offline_workout_mutations SET status = ?, retry_count = 0 WHERE status = ?",
    "pending",
    "failed",
  );
}

async function removeQueuedMutation(id: number) {
  const db = await getDb();
  await db.runAsync("DELETE FROM offline_workout_mutations WHERE id = ?", id);
}

async function incrementRetryCount(id: number, retryCount: number) {
  const db = await getDb();
  await db.runAsync(
    "UPDATE offline_workout_mutations SET retry_count = ? WHERE id = ?",
    retryCount,
    id,
  );
}

async function applyQueuedMutation(
  client: ReturnType<typeof createTRPCClient>,
  type: OfflineWorkoutMutationType,
  payload: never,
) {
  switch (type) {
    case "updateSet":
      return client.workout.updateSet.mutate(payload);
    case "updateExerciseNotes":
      return client.workout.updateExerciseNotes.mutate(payload);
    case "finishWorkout":
      return client.workout.finish.mutate(payload);
    case "addSet":
      return client.workout.addSet.mutate(payload);
    case "deleteSet":
      return client.workout.deleteSet.mutate(payload);
    case "addExercise":
      return client.workout.addExercise.mutate(payload);
    default:
      throw new Error(`Unknown offline mutation: ${type satisfies never}`);
  }
}

export async function syncQueuedWorkoutMutations(options?: {
  invalidateActiveWorkout?: () => void | Promise<void>;
}): Promise<SyncQueuedWorkoutResult> {
  const db = await getDb();
  const queued = await db.getAllAsync<OfflineWorkoutMutation>(
    "SELECT id, type, payload, created_at as createdAt, retry_count as retryCount, status FROM offline_workout_mutations WHERE status = 'pending' ORDER BY id ASC",
  );
  if (queued.length === 0) {
    return { synced: 0, remaining: 0, syncFailed: false, failed: 0 };
  }

  const client = getTrpcClient();
  let synced = 0;
  let syncFailed = false;
  let failed = 0;

  for (const item of queued) {
    const payload = JSON.parse(item.payload) as never;
    try {
      await applyQueuedMutation(client, item.type, payload);
      if (item.type === "finishWorkout") {
        await options?.invalidateActiveWorkout?.();
      } else if (STRUCTURAL_MUTATIONS.has(item.type)) {
        await client.workout.active.query();
      }
      await removeQueuedMutation(item.id);
      synced += 1;
    } catch (error) {
      if (isNetworkError(error)) break;

      const nextRetryCount = item.retryCount + 1;
      syncFailed = true;

      if (nextRetryCount > MAX_SYNC_RETRIES) {
        await db.runAsync(
          "UPDATE offline_workout_mutations SET status = ? WHERE id = ?",
          "failed",
          item.id,
        );
        failed += 1;
        console.error(
          "[Offline] Mutation marked failed after max retries:",
          item.id,
          item.type,
          error,
        );
      } else {
        await incrementRetryCount(item.id, nextRetryCount);
      }
    }
  }

  return {
    synced,
    remaining: await getQueuedWorkoutMutationCount(),
    syncFailed,
    failed,
  };
}
