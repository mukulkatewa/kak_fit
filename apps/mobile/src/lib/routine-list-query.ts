import type { RouterOutputs } from "@kak-fit/api/router";
import { queryStaleTime, trpc } from "./trpc";

export type RoutineListItem = RouterOutputs["routine"]["list"]["routines"][number];

export const ROUTINE_LIST_PAGE_SIZE = 50;

export const routineListInfiniteOptions = {
  getNextPageParam: (lastPage: RouterOutputs["routine"]["list"]) =>
    lastPage.nextCursor ?? undefined,
  staleTime: queryStaleTime.routineList,
} as const;

export function useRoutineListInfinite(limit = ROUTINE_LIST_PAGE_SIZE) {
  return trpc.routine.list.useInfiniteQuery({ limit }, routineListInfiniteOptions);
}

export function flattenRoutines(
  pages: RouterOutputs["routine"]["list"][] | undefined,
): RoutineListItem[] {
  return pages?.flatMap((page) => page.routines) ?? [];
}
