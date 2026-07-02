import type { RouterOutputs } from "@kak-fit/api/router";

type ExerciseUtils = {
  exercise: {
    detailPage: {
      prefetch: (input: { id: string; chartLimit: number }) => Promise<unknown>;
    };
  };
};

type ExerciseRouter = {
  push: (href: { pathname: "/exercise/[id]"; params: { id: string } }) => void;
};

export type ExerciseListItem = RouterOutputs["exercise"]["list"][number];

export function openExerciseDetail(
  utils: ExerciseUtils,
  router: ExerciseRouter,
  exerciseId: string,
) {
  void utils.exercise.detailPage.prefetch({ id: exerciseId, chartLimit: 12 });
  router.push({ pathname: "/exercise/[id]", params: { id: exerciseId } });
}
