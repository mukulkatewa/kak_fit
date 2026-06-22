import * as SQLite from "expo-sqlite";
import { createTRPCClient } from "./trpc";

type OfflineWorkoutMutationType = "updateSet" | "updateExerciseNotes" | "finishWorkout";

type OfflineWorkoutMutation = {
  id: number;
  type: OfflineWorkoutMutationType;
  payload: string;
  createdAt: number;
};

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
      if (item.type === "updateSet") {
        await client.workout.updateSet.mutate(payload);
      } else if (item.type === "updateExerciseNotes") {
        await client.workout.updateExerciseNotes.mutate(payload);
      } else if (item.type === "finishWorkout") {
        await client.workout.finish.mutate(payload);
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
