import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  enqueueWorkoutMutation,
  isNetworkError,
  syncQueuedWorkoutMutations,
} from "../lib/offline-workouts";
import { applySetPatchToWorkout, patchSetInWorkout, type ActiveWorkout } from "../lib/active-workout-cache";
import { useAuth } from "../lib/auth-context";
import { queryStaleTime, trpc } from "../lib/trpc";
import {
  addWorkoutWidgetCompleteSetListener,
  clearWorkoutNativeWidget,
  ensureWorkoutFloatingWidget,
  updateWorkoutNativeWidget,
} from "../lib/workout-native-widget";
import {
  buildWorkoutWidgetSummary,
  findNextIncompleteSet,
  workoutWidgetSummaryKey,
} from "../lib/workout-live-widget-state";

export function WorkoutLiveNotificationBridge() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const activeRef = useRef<ActiveWorkout | null | undefined>(undefined);
  const lastWidgetKeyRef = useRef<string | null>(null);

  const { data: activeWorkout } = trpc.workout.active.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: queryStaleTime.workoutActive,
    refetchInterval: 30_000,
    retry: false,
  });

  activeRef.current = activeWorkout;

  const updateSet = trpc.workout.updateSet.useMutation({
    onSuccess: (updatedSet) => {
      utils.workout.active.setData(undefined, (current) =>
        current ? patchSetInWorkout(current, updatedSet) : current,
      );
      void utils.workout.history.invalidate();
      void utils.personalRecord.list.invalidate();
    },
  });

  const widgetSummary = useMemo(
    () => (activeWorkout ? buildWorkoutWidgetSummary(activeWorkout) : null),
    [activeWorkout],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      lastWidgetKeyRef.current = null;
      clearWorkoutNativeWidget();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!widgetSummary) {
      lastWidgetKeyRef.current = null;
      clearWorkoutNativeWidget();
      return;
    }

    const key = workoutWidgetSummaryKey(widgetSummary);
    if (lastWidgetKeyRef.current === key) return;
    lastWidgetKeyRef.current = key;
    updateWorkoutNativeWidget(widgetSummary);
    void ensureWorkoutFloatingWidget(widgetSummary);
  }, [widgetSummary]);

  const completeNextSet = useCallback(async () => {
    let workout = activeRef.current;
    if (!workout) {
      const fetched = await utils.workout.active.fetch().catch(() => null);
      workout = fetched ?? undefined;
    }
    if (!workout) return;

    const nextSet = findNextIncompleteSet(workout);
    if (!nextSet) {
      router.push("/workout/active");
      return;
    }

    const variables = { setId: nextSet.setId, isCompleted: true };
    utils.workout.active.setData(undefined, (current) =>
      current ? applySetPatchToWorkout(current, nextSet.setId, { isCompleted: true }) : current,
    );

    try {
      await updateSet.mutateAsync(variables);
      await syncQueuedWorkoutMutations({
        invalidateActiveWorkout: () => utils.workout.active.invalidate(),
      });
    } catch (error) {
      if (!isNetworkError(error)) {
        console.error("Failed to complete workout set from widget", error);
        return;
      }
      await enqueueWorkoutMutation("updateSet", variables);
    } finally {
      void utils.workout.active.invalidate();
    }
  }, [router, updateSet, utils.workout.active]);

  useEffect(() => {
    const subscription = addWorkoutWidgetCompleteSetListener(async () => {
      await completeNextSet();
    });

    return () => subscription.remove();
  }, [completeNextSet]);

  return null;
}
