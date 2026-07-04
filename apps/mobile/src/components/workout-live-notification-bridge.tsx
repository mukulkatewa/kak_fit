import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  enqueueWorkoutMutation,
  isNetworkError,
} from "../lib/offline-workouts";
import { applySetPatchToWorkout, patchSetInWorkout, type ActiveWorkout } from "../lib/active-workout-cache";
import { useAuth } from "../lib/auth-context";
import { queryStaleTime, trpc } from "../lib/trpc";
import {
  addWorkoutWidgetCompleteSetListener,
  clearWorkoutNativeWidget,
  hideWorkoutFloatingOverlay,
  showWorkoutFloatingOverlayWhenAllowed,
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

function isAppInForeground(state = AppState.currentState) {
  return state === "active";
}

export function WorkoutLiveNotificationBridge() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const activeRef = useRef<ActiveWorkout | null | undefined>(undefined);
  const lastWidgetKeyRef = useRef<string | null>(null);
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
    () => (activeWorkout ? buildWorkoutWidgetSummary(activeWorkout) : null),
    [activeWorkout],
  );

  widgetSummaryRef.current = widgetSummary;

  const hideBackgroundControls = useCallback(() => {
    hideWorkoutFloatingOverlay();
    void dismissWorkoutNotification();
  }, []);

  const showBackgroundControls = useCallback(async () => {
    const summary = widgetSummaryRef.current;
    if (!summary) return;
    await requestWorkoutNotificationPermissionOnce();
    await showWorkoutNotification(summary);
    await showWorkoutFloatingOverlayWhenAllowed();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      lastWidgetKeyRef.current = null;
      clearWorkoutNativeWidget();
      void dismissWorkoutNotification();
    }
  }, [isAuthenticated]);

  // Keep native widget data fresh without showing the floating overlay in foreground.
  useEffect(() => {
    if (!widgetSummary) {
      lastWidgetKeyRef.current = null;
      clearWorkoutNativeWidget();
      void dismissWorkoutNotification();
      return;
    }

    const key = workoutWidgetSummaryKey(widgetSummary);
    if (lastWidgetKeyRef.current === key) return;
    lastWidgetKeyRef.current = key;
    updateWorkoutNativeWidget(widgetSummary);

    if (!isAppInForeground()) {
      void showBackgroundControls();
    }
  }, [widgetSummary, showBackgroundControls]);

  // Floating overlay + lockscreen notification only while the app is minimized.
  useEffect(() => {
    if (!widgetSummary) return;

    const handleAppState = (nextState: AppStateStatus) => {
      if (isAppInForeground(nextState)) {
        hideBackgroundControls();
        return;
      }
      void showBackgroundControls();
    };

    if (isAppInForeground()) {
      hideBackgroundControls();
    } else {
      void showBackgroundControls();
    }

    const subscription = AppState.addEventListener("change", handleAppState);
    return () => {
      subscription.remove();
      hideBackgroundControls();
    };
  }, [widgetSummary, hideBackgroundControls, showBackgroundControls]);

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
  }, [router, updateSet, utils.workout.active]);

  useEffect(() => {
    const subscription = addWorkoutWidgetCompleteSetListener(async () => {
      await completeNextSet();
    });

    const notificationSubscription = addWorkoutNotificationResponseListener(async (actionIdentifier) => {
      if (actionIdentifier === COMPLETE_NEXT_SET_ACTION) {
        tickWorkoutNativeWidgetRep();
        return;
      }
      if (
        actionIdentifier === OPEN_WORKOUT_ACTION ||
        actionIdentifier === NOTIFICATION_DEFAULT_ACTION
      ) {
        router.push("/workout/active");
      }
    });

    return () => {
      subscription.remove();
      notificationSubscription.remove();
    };
  }, [completeNextSet, router]);

  return null;
}
