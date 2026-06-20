import type { AppRouter } from "@kak-fit/api/router";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { createTRPCReact } from "@trpc/react-query";

type TrpcUtils = ReturnType<ReturnType<typeof createTRPCReact<AppRouter>>["useUtils"]>;

export async function resolveExerciseIds(
  utils: TrpcUtils,
  names: string[],
): Promise<Array<{ exerciseId: string; name: string }>> {
  const resolved: Array<{ exerciseId: string; name: string }> = [];

  for (const name of names) {
    const results = await utils.exercise.list.fetch({ search: name, limit: 5 });
    const match =
      results.find((e) => e.name.toLowerCase() === name.toLowerCase()) ??
      results.find((e) => e.name.toLowerCase().includes(name.toLowerCase())) ??
      results[0];

    if (match) {
      resolved.push({ exerciseId: match.id, name: match.name });
    }
  }

  return resolved;
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
