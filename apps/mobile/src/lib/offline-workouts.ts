import * as SQLite from "expo-sqlite";
import { createTRPCClient } from "./trpc";

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
};

/** Mutations that change workout structure — refetch active workout after sync. */
const STRUCTURAL_MUTATIONS = new Set<OfflineWorkoutMutationType>([
  "addSet",
  "deleteSet",
  "addExercise",
  "finishWorkout",
]);

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  dbPromise ??= SQLite.openDatabaseAsync("kak-fit-offline.db").then(async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS offline_workout_mutations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    return db;
  });
  return dbPromise;
}

export function isNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /network request failed|failed to fetch|load failed|internet|offline|econn|timeout|fetch failed/i.test(message);
}

export async function enqueueWorkoutMutation(type: OfflineWorkoutMutationType, payload: unknown) {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO offline_workout_mutations (type, payload, created_at) VALUES (?, ?, ?)",
    type,
    JSON.stringify(payload),
    Date.now(),
  );
}

export async function getQueuedWorkoutMutationCount() {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM offline_workout_mutations",
  );
  return row?.count ?? 0;
}

async function removeQueuedMutation(id: number) {
  const db = await getDb();
  await db.runAsync("DELETE FROM offline_workout_mutations WHERE id = ?", id);
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

export async function syncQueuedWorkoutMutations() {
  const db = await getDb();
  const queued = await db.getAllAsync<OfflineWorkoutMutation>(
    "SELECT id, type, payload, created_at as createdAt FROM offline_workout_mutations ORDER BY id ASC",
  );
  if (queued.length === 0) return { synced: 0, remaining: 0 };

  const client = createTRPCClient();
  let synced = 0;

  for (const item of queued) {
    const payload = JSON.parse(item.payload) as never;
    try {
      await applyQueuedMutation(client, item.type, payload);
      if (STRUCTURAL_MUTATIONS.has(item.type)) {
        await client.workout.active.query();
      }
      await removeQueuedMutation(item.id);
      synced += 1;
    } catch (error) {
      if (isNetworkError(error)) break;
      await removeQueuedMutation(item.id);
    }
  }

  return { synced, remaining: await getQueuedWorkoutMutationCount() };
}
