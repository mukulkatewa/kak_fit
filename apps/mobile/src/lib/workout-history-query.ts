import type { RouterOutputs } from "@kak-fit/api/router";
import { queryStaleTime, trpc } from "./trpc";

export type WorkoutHistoryItem = RouterOutputs["workout"]["history"]["items"][number];

export const WORKOUT_HISTORY_PAGE_SIZE = 20;

export const workoutHistoryInfiniteOptions = {
  getNextPageParam: (lastPage: RouterOutputs["workout"]["history"]) =>
    lastPage.nextCursor ?? undefined,
  staleTime: queryStaleTime.workoutHistory,
} as const;

export function useWorkoutHistoryInfinite(limit = WORKOUT_HISTORY_PAGE_SIZE) {
  return trpc.workout.history.useInfiniteQuery({ limit }, workoutHistoryInfiniteOptions);
}

export function flattenFinishedWorkouts(
  pages: RouterOutputs["workout"]["history"][] | undefined,
): WorkoutHistoryItem[] {
  return (pages?.flatMap((page) => page.items) ?? []).filter((w) => w.finishedAt);
}
