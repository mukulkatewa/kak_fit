import * as Network from "expo-network";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useAuth } from "../lib/auth-context";
import { syncQueuedWorkoutMutations } from "../lib/offline-workouts";
import { trpc } from "../lib/trpc";

const SYNC_INTERVAL_MS = 20_000;

export function OfflineWorkoutSync() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const syncingRef = useRef(false);

  const syncNow = useCallback(async () => {
    if (!isAuthenticated || syncingRef.current) return;
    syncingRef.current = true;
    try {
      const network = await Network.getNetworkStateAsync();
      if (network.isConnected === false || network.isInternetReachable === false) return;

      const result = await syncQueuedWorkoutMutations({
        invalidateActiveWorkout: () => utils.workout.active.invalidate(),
      });
      if (result.synced > 0 || result.dropped > 0) {
        await Promise.all([
          utils.workout.active.invalidate(),
          utils.workout.history.invalidate(),
          utils.personalRecord.list.invalidate(),
          utils.progress.dashboard.invalidate(),
        ]);
      }
    } finally {
      syncingRef.current = false;
    }
  }, [isAuthenticated, utils]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    void syncNow();
    const interval = setInterval(() => void syncNow(), SYNC_INTERVAL_MS);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncNow();
    });

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [isAuthenticated, syncNow]);

  return null;
}
