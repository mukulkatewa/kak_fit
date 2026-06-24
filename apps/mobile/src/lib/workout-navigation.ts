import type { RouterOutputs } from "@kak-fit/api/router";

/** Same shape as `workout.active` and start mutation results. */
export type ActiveWorkoutData = NonNullable<RouterOutputs["workout"]["active"]>;

type ActiveWorkoutUtils = {
  workout: {
    active: {
      setData: (input: undefined, data: ActiveWorkoutData) => void;
    };
  };
};

/** Prime the active-workout cache and open the live session screen. */
export function navigateToActiveWorkout(
  utils: ActiveWorkoutUtils,
  router: { push: (href: string) => void },
  workout: ActiveWorkoutData,
) {
  utils.workout.active.setData(undefined, workout);
  router.push("/workout/active");
}
