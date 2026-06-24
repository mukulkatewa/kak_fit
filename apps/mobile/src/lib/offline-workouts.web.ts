import type { OfflineWorkoutMutationType } from "./offline-workouts";

export function isNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /network request failed|failed to fetch|load failed|internet|offline|econn|timeout|fetch failed/i.test(message);
}

/** Offline queue is native-only; web always hits the API directly. */
export async function enqueueWorkoutMutation(_type: OfflineWorkoutMutationType, _payload: unknown) {}

export async function getQueuedWorkoutMutationCount() {
  return 0;
}

export async function syncQueuedWorkoutMutations(_options?: {
  invalidateActiveWorkout?: () => void | Promise<void>;
}) {
  return { synced: 0, remaining: 0, syncFailed: false, dropped: 0 };
}
