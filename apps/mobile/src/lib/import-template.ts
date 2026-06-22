import type { AppRouter } from "@kak-fit/api/router";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { createTRPCReact } from "@trpc/react-query";

type TrpcUtils = ReturnType<ReturnType<typeof createTRPCReact<AppRouter>>["useUtils"]>;

export async function resolveExerciseIds(
  utils: TrpcUtils,
  names: string[],
): Promise<Array<{ exerciseId: string; name: string }>> {
  if (names.length === 0) return [];

  // Single batched round-trip instead of one search per exercise name.
  const resolved = await utils.exercise.resolveByNames.fetch({ names });
  return resolved.map((r) => ({ exerciseId: r.exerciseId, name: r.matchedName }));
}

export function buildRoutinePayload(
  name: string,
  exercises: Array<{ exerciseId: string }>,
) {
  return {
    name,
    exercises: exercises.map((ex, index) => ({
      exerciseId: ex.exerciseId,
      order: index,
      sets: Array.from({ length: 3 }, (_, i) => ({ setNumber: i + 1, targetReps: 10 })),
    })),
  };
}
