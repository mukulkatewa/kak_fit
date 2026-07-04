import { useEffect } from "react";
import { useAuth } from "../lib/auth-context";
import { trpc } from "../lib/trpc";
import { workoutHistoryInfiniteOptions, WORKOUT_HISTORY_PAGE_SIZE } from "../lib/workout-history-query";
import { routineListInfiniteOptions, ROUTINE_LIST_PAGE_SIZE } from "../lib/routine-list-query";

/** Prefetch data for likely next screens after sign-in. */
export function TrpcPrefetchBootstrap() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!isAuthenticated) return;

    void utils.workout.history.prefetchInfinite(
      { limit: WORKOUT_HISTORY_PAGE_SIZE },
      workoutHistoryInfiniteOptions,
    );
    void utils.exercise.list.prefetch({ limit: 50 });
    void utils.routine.list.prefetchInfinite(
      { limit: ROUTINE_LIST_PAGE_SIZE },
      routineListInfiniteOptions,
    );
  }, [isAuthenticated, utils]);

  return null;
}
