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
  addWorkoutNotificationResponseListener,
  COMPLETE_NEXT_SET_ACTION,
  consumeLaunchWorkoutNotificationResponse,
  dismissWorkoutNotification,
  NOTIFICATION_DEFAULT_ACTION,
  OPEN_WORKOUT_ACTION,
  registerWorkoutNotificationSurface,
  showWorkoutNotification,
} from "../lib/workout-live-notifications";
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
  const lastNotificationKeyRef = useRef<string | null>(null);

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

  const notificationSummary = useMemo(
    () => (activeWorkout ? buildWorkoutWidgetSummary(activeWorkout) : null),
    [activeWorkout],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      lastNotificationKeyRef.current = null;
      void dismissWorkoutNotification();
      return;
    }
    void registerWorkoutNotificationSurface();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!notificationSummary) {
      lastNotificationKeyRef.current = null;
      void dismissWorkoutNotification();
      return;
    }

    const key = workoutWidgetSummaryKey(notificationSummary);
    if (lastNotificationKeyRef.current === key) return;
    lastNotificationKeyRef.current = key;
    void showWorkoutNotification(notificationSummary);
  }, [notificationSummary]);

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
        console.error("Failed to complete workout set from notification", error);
        return;
      }
      await enqueueWorkoutMutation("updateSet", variables);
    } finally {
      void utils.workout.active.invalidate();
    }
  }, [router, updateSet, utils.workout.active]);

  useEffect(() => {
    const subscription = addWorkoutNotificationResponseListener(async (actionIdentifier) => {
      if (actionIdentifier === COMPLETE_NEXT_SET_ACTION) {
        await completeNextSet();
        return;
      }

      if (
        actionIdentifier === OPEN_WORKOUT_ACTION ||
        actionIdentifier === NOTIFICATION_DEFAULT_ACTION
      ) {
        router.push("/workout/active");
      }
    });

    if (consumeLaunchWorkoutNotificationResponse()) {
      router.push("/workout/active");
    }

    return () => subscription.remove();
  }, [completeNextSet, router]);

  return null;
}
