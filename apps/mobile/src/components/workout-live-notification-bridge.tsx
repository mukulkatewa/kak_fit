import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import {
  enqueueWorkoutMutation,
  isNetworkError,
} from "../lib/offline-workouts";
import { applySetPatchToWorkout, patchSetInWorkout, type ActiveWorkout } from "../lib/active-workout-cache";
import { useAuth } from "../lib/auth-context";
import { queryStaleTime, trpc } from "../lib/trpc";
import {
  addWorkoutWidgetCompleteSetListener,
  addWorkoutWidgetSkipRestListener,
  clearWorkoutNativeWidget,
  clearPendingWorkoutWidgetSyncSetIds,
  getPendingWorkoutWidgetSyncSetIds,
  refreshWorkoutNativeLockscreen,
  tickWorkoutNativeWidgetRep,
  updateWorkoutNativeWidget,
  workoutNativeWidgetStartRestTimer,
} from "../lib/workout-native-widget";
import {
  buildWorkoutWidgetSummary,
  findNextIncompleteSet,
} from "../lib/workout-live-widget-state";
import {
  COMPLETE_NEXT_SET_ACTION,
  dismissWorkoutNotification,
  NOTIFICATION_DEFAULT_ACTION,
  OPEN_WORKOUT_ACTION,
  addWorkoutNotificationResponseListener,
  requestWorkoutNotificationPermissionOnce,
  showWorkoutNotification,
} from "../lib/workout-live-notifications";
import { useRestTimer } from "../lib/rest-timer";
import { useUserPreferences } from "../lib/use-preferences";

function isAppInForeground(state = AppState.currentState) {
  return state === "active";
}

export function WorkoutLiveNotificationBridge() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const activeRef = useRef<ActiveWorkout | null | undefined>(undefined);
  const widgetSummaryRef = useRef<ReturnType<typeof buildWorkoutWidgetSummary> | null>(null);
  const { defaultRestSeconds } = useUserPreferences();
  const defaultRestSecondsRef = useRef(defaultRestSeconds);
  defaultRestSecondsRef.current = defaultRestSeconds;

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
    },
  });

  const widgetSummary = useMemo(
    () =>
      activeWorkout
        ? buildWorkoutWidgetSummary(activeWorkout, Date.now(), defaultRestSeconds)
        : null,
    [activeWorkout, defaultRestSeconds],
  );

  widgetSummaryRef.current = widgetSummary;

  // ─── Clear auth state ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) {
      clearWorkoutNativeWidget();
      void dismissWorkoutNotification();
    }
  }, [isAuthenticated]);

  // ─── Keep native widget / notification in sync with workout state ────────────
  // The foreground service runs continuously while the workout is active.
  // We never stop it here — only clear() stops it (when widgetSummary → null).
  // This removes the "stop-then-restart" race that caused the widget to disappear.
  useEffect(() => {
    if (!widgetSummary) {
      clearWorkoutNativeWidget();
      if (Platform.OS !== "android") void dismissWorkoutNotification();
      return;
    }

    updateWorkoutNativeWidget(widgetSummary);
    refreshWorkoutNativeLockscreen();

    // iOS: also post a local notification for lockscreen controls
    if (Platform.OS === "ios" && !isAppInForeground()) {
      void requestWorkoutNotificationPermissionOnce().then(() =>
        showWorkoutNotification(widgetSummary),
      );
    }
  }, [widgetSummary]);

  // ─── Flush sets completed natively when app comes to foreground ──────────────
  // Kept separate from the sync effect so mutation-reference churn doesn't
  // unsubscribe/resubscribe the AppState listener on every set completion.
  const completeSetById = useCallback(
    async (setIdFromWidget?: string) => {
      let workout = activeRef.current;
      if (!workout) {
        const fetched = await utils.workout.active.fetch().catch(() => null);
        workout = fetched ?? undefined;
      }
      if (!workout) return;

      const targetSetId = setIdFromWidget ?? findNextIncompleteSet(workout)?.setId;
      if (!targetSetId) {
        router.push("/workout/active");
        return;
      }

      const alreadyCompleted = workout.exercises.some((exercise) =>
        exercise.sets.some((set) => set.id === targetSetId && set.isCompleted),
      );
      if (alreadyCompleted) return;

      const variables = { setId: targetSetId, isCompleted: true };

      utils.workout.active.setData(undefined, (current) =>
        current ? applySetPatchToWorkout(current, targetSetId, { isCompleted: true }) : current,
      );

      const restSeconds = defaultRestSecondsRef.current;
      if (restSeconds > 0) {
        useRestTimer.getState().start(restSeconds);
        workoutNativeWidgetStartRestTimer(restSeconds);
      }

      try {
        await updateSet.mutateAsync(variables);
      } catch (error) {
        if (!isNetworkError(error)) {
          console.error("Failed to complete workout set from widget", error);
          return;
        }
        await enqueueWorkoutMutation("updateSet", variables);
      }
    },
    // Intentionally exclude `updateSet` from deps — mutation reference churn
    // would re-subscribe AppState listeners on every set completion.
    // completeSetById reads the latest updateSet via closure but the stable
    // function reference prevents the listener-teardown/rebuild race.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, utils.workout.active],
  );

  const flushPendingWidgetSyncRef = useRef<(() => Promise<void>) | undefined>(undefined);

  useEffect(() => {
    flushPendingWidgetSyncRef.current = async () => {
      const pendingSetIds = await getPendingWorkoutWidgetSyncSetIds();
      for (const setId of pendingSetIds) {
        await completeSetById(setId);
      }
      clearPendingWorkoutWidgetSyncSetIds();
      await utils.workout.active.invalidate();
    };
  }, [completeSetById, utils.workout.active]);

  // AppState listener: only flush pending native completions on foreground.
  // No hide/show of the service here — the service keeps running while active.
  useEffect(() => {
    if (!widgetSummary) return;

    const flush = () => {
      void flushPendingWidgetSyncRef.current?.();
    };

    const handleAppState = (nextState: AppStateStatus) => {
      if (isAppInForeground(nextState)) flush();
    };

    // Flush immediately if we're already in foreground
    if (isAppInForeground()) flush();

    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
    // widgetSummary in deps: re-subscribe only when workout starts/ends,
    // not on every mutation (see flushPendingWidgetSyncRef pattern above).
  }, [widgetSummary]);

  // ─── Native event listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const subscription = addWorkoutWidgetCompleteSetListener(async (setId) => {
      await completeSetById(setId);
    });

    const skipRestSubscription = addWorkoutWidgetSkipRestListener(() => {
      useRestTimer.getState().stop();
    });

    const notificationSubscription =
      Platform.OS === "ios"
        ? addWorkoutNotificationResponseListener(async (actionIdentifier) => {
            if (actionIdentifier === COMPLETE_NEXT_SET_ACTION) {
              tickWorkoutNativeWidgetRep();
              await completeSetById();
              return;
            }
            if (
              actionIdentifier === OPEN_WORKOUT_ACTION ||
              actionIdentifier === NOTIFICATION_DEFAULT_ACTION
            ) {
              router.push("/workout/active");
            }
          })
        : { remove: () => undefined };

    return () => {
      subscription.remove();
      skipRestSubscription.remove();
      notificationSubscription.remove();
    };
  }, [completeSetById, router]);

  return null;
}
