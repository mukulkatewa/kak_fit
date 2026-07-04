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
  removePendingWorkoutWidgetSyncSetId,
  setWorkoutNativeWidgetControlsVisible,
  tickWorkoutNativeWidgetRep,
  updateWorkoutNativeWidget,
  workoutNativeWidgetStartRestTimer,
} from "../lib/workout-native-widget";
import {
  buildWorkoutWidgetSummary,
  findNextIncompleteSet,
  workoutWidgetSummaryKey,
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
import type { WeightUnit } from "../lib/units";

const BACKGROUND_WIDGET_DELAY_MS = 300;

function isAppInForeground(state = AppState.currentState) {
  return state === "active";
}

function isAppMinimized(state: AppStateStatus) {
  // Only true background — not "inactive" (notification shade, dialogs) to avoid widget flash.
  return state === "background";
}

export function WorkoutLiveNotificationBridge() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const activeRef = useRef<ActiveWorkout | null | undefined>(undefined);
  const widgetSummaryRef = useRef<ReturnType<typeof buildWorkoutWidgetSummary> | null>(null);
  const backgroundWidgetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsVisibleRef = useRef(false);
  const lastNativeSummaryKeyRef = useRef<string | null>(null);
  const { defaultRestSeconds, weightUnit } = useUserPreferences();
  const defaultRestSecondsRef = useRef(defaultRestSeconds);
  const weightUnitRef = useRef<WeightUnit>(weightUnit);
  defaultRestSecondsRef.current = defaultRestSeconds;
  weightUnitRef.current = weightUnit;

  const { data: activeWorkout } = trpc.workout.active.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: queryStaleTime.workoutActive,
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
        ? buildWorkoutWidgetSummary(activeWorkout, Date.now(), defaultRestSeconds, weightUnit)
        : null,
    [activeWorkout, defaultRestSeconds, weightUnit],
  );

  widgetSummaryRef.current = widgetSummary;

  const buildFreshSummary = useCallback(() => {
    const workout = activeRef.current;
    if (!workout) return null;
    return buildWorkoutWidgetSummary(
      workout,
      Date.now(),
      defaultRestSecondsRef.current,
      weightUnitRef.current,
    );
  }, []);

  const pushNativeWorkoutState = useCallback(
    (options?: { forceElapsed?: boolean }) => {
      const summary = buildFreshSummary();
      if (!summary) return;

      const key = workoutWidgetSummaryKey(summary);
      if (!options?.forceElapsed && key === lastNativeSummaryKeyRef.current) return;

      lastNativeSummaryKeyRef.current = key;
      updateWorkoutNativeWidget(summary);
    },
    [buildFreshSummary],
  );

  const setControlsVisibleState = useCallback((visible: boolean) => {
    if (controlsVisibleRef.current === visible) return;
    controlsVisibleRef.current = visible;
    setWorkoutNativeWidgetControlsVisible(visible);
  }, []);

  const showBackgroundWidgetControls = useCallback(() => {
    if (!widgetSummaryRef.current || isAppInForeground()) return;
    pushNativeWorkoutState({ forceElapsed: true });
    setControlsVisibleState(true);
  }, [pushNativeWorkoutState, setControlsVisibleState]);

  const hideForegroundWidgetControls = useCallback(() => {
    if (backgroundWidgetTimerRef.current) {
      clearTimeout(backgroundWidgetTimerRef.current);
      backgroundWidgetTimerRef.current = null;
    }
    setControlsVisibleState(false);
  }, [setControlsVisibleState]);

  const syncWidgetVisibility = useCallback(
    (nextState: AppStateStatus) => {
      if (Platform.OS !== "android" || !widgetSummaryRef.current) return;

      if (isAppInForeground(nextState)) {
        hideForegroundWidgetControls();
        return;
      }

      if (!isAppMinimized(nextState)) return;

      if (controlsVisibleRef.current) {
        pushNativeWorkoutState({ forceElapsed: true });
        return;
      }

      if (backgroundWidgetTimerRef.current) {
        clearTimeout(backgroundWidgetTimerRef.current);
      }
      backgroundWidgetTimerRef.current = setTimeout(() => {
        backgroundWidgetTimerRef.current = null;
        showBackgroundWidgetControls();
      }, BACKGROUND_WIDGET_DELAY_MS);
    },
    [hideForegroundWidgetControls, pushNativeWorkoutState, showBackgroundWidgetControls],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      hideForegroundWidgetControls();
      lastNativeSummaryKeyRef.current = null;
      clearWorkoutNativeWidget();
      void dismissWorkoutNotification();
    }
  }, [hideForegroundWidgetControls, isAuthenticated]);

  useEffect(() => {
    if (!widgetSummary) {
      hideForegroundWidgetControls();
      lastNativeSummaryKeyRef.current = null;
      clearWorkoutNativeWidget();
      if (Platform.OS !== "android") void dismissWorkoutNotification();
      return;
    }

    pushNativeWorkoutState();
    if (Platform.OS === "android") {
      if (isAppMinimized(AppState.currentState)) {
        syncWidgetVisibility(AppState.currentState);
      } else if (isAppInForeground()) {
        hideForegroundWidgetControls();
      }
    }

    if (Platform.OS === "ios" && !isAppInForeground()) {
      void requestWorkoutNotificationPermissionOnce().then(() =>
        showWorkoutNotification(widgetSummary),
      );
    }
  }, [hideForegroundWidgetControls, pushNativeWorkoutState, syncWidgetVisibility, widgetSummary]);

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
      if (alreadyCompleted) {
        if (setIdFromWidget) removePendingWorkoutWidgetSyncSetId(setIdFromWidget);
        return;
      }

      const variables = { setId: targetSetId, isCompleted: true };

      utils.workout.active.setData(undefined, (current) =>
        current ? applySetPatchToWorkout(current, targetSetId, { isCompleted: true }) : current,
      );

      const restSeconds = defaultRestSecondsRef.current;
      if (restSeconds > 0) {
        useRestTimer.getState().start(restSeconds);
        if (!setIdFromWidget) {
          workoutNativeWidgetStartRestTimer(restSeconds);
        }
      }

      try {
        await updateSet.mutateAsync(variables);
        if (setIdFromWidget) removePendingWorkoutWidgetSyncSetId(setIdFromWidget);
      } catch (error) {
        if (!isNetworkError(error)) {
          console.error("Failed to complete workout set from widget", error);
          return;
        }
        await enqueueWorkoutMutation("updateSet", variables);
        if (setIdFromWidget) removePendingWorkoutWidgetSyncSetId(setIdFromWidget);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, utils.workout.active],
  );

  const flushPendingWidgetSyncRef = useRef<(() => Promise<void>) | undefined>(undefined);

  useEffect(() => {
    flushPendingWidgetSyncRef.current = async () => {
      const pendingSetIds = await getPendingWorkoutWidgetSyncSetIds();
      if (pendingSetIds.length === 0) return;

      for (const setId of pendingSetIds) {
        await completeSetById(setId);
      }
      clearPendingWorkoutWidgetSyncSetIds();
      await utils.workout.active.invalidate();
    };
  }, [completeSetById, utils.workout.active]);

  useEffect(() => {
    if (!widgetSummary) return;

    const handleAppState = (nextState: AppStateStatus) => {
      syncWidgetVisibility(nextState);
      if (isAppInForeground(nextState)) {
        void flushPendingWidgetSyncRef.current?.();
      }
    };

    if (isAppInForeground()) {
      void flushPendingWidgetSyncRef.current?.();
    }

    const subscription = AppState.addEventListener("change", handleAppState);
    return () => {
      subscription.remove();
      if (backgroundWidgetTimerRef.current) {
        clearTimeout(backgroundWidgetTimerRef.current);
        backgroundWidgetTimerRef.current = null;
      }
    };
  }, [syncWidgetVisibility, widgetSummary]);

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
