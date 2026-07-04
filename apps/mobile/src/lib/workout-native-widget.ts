import { Alert, NativeEventEmitter, NativeModules, Platform } from "react-native";
import type { WorkoutWidgetSummary } from "./workout-live-widget-state";

const COMPLETE_EVENT = "KakWorkoutWidgetCompleteSet";
const SKIP_REST_EVENT = "KakWorkoutWidgetSkipRest";

let overlayPromptShownThisSession = false;

type NativeWorkoutWidget = {
  update?: (summary: WorkoutWidgetSummary) => void;
  clear?: () => void;
  tickRep?: () => void;
  skipRest?: () => void;
  startRestTimer?: (seconds: number) => void;
  canDrawOverlays?: () => Promise<boolean>;
  requestOverlayPermission?: () => void;
  startOverlay?: () => void;
  stopOverlay?: () => void;
  refreshLockscreen?: () => void;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
};

function nativeModule(): NativeWorkoutWidget | null {
  if (Platform.OS !== "android") return null;
  return (NativeModules.KakWorkoutWidget as NativeWorkoutWidget | undefined) ?? null;
}

export function workoutNativeWidgetAvailable() {
  return Boolean(nativeModule());
}

/** Sync workout state to native prefs + home-screen widget (no floating overlay). */
export function updateWorkoutNativeWidget(summary: WorkoutWidgetSummary) {
  nativeModule()?.update?.(summary);
}

export function clearWorkoutNativeWidget() {
  const module = nativeModule();
  module?.clear?.();
  module?.stopOverlay?.();
}

export function showWorkoutFloatingOverlay() {
  nativeModule()?.startOverlay?.();
}

export function hideWorkoutFloatingOverlay() {
  nativeModule()?.stopOverlay?.();
}

export function refreshWorkoutNativeLockscreen() {
  nativeModule()?.refreshLockscreen?.();
}

export function tickWorkoutNativeWidgetRep() {
  nativeModule()?.tickRep?.();
}

export function skipWorkoutNativeWidgetRest() {
  nativeModule()?.skipRest?.();
}

export function workoutNativeWidgetStartRestTimer(seconds: number) {
  if (seconds <= 0) return;
  nativeModule()?.startRestTimer?.(seconds);
}

/** Start lockscreen + bottom workout bar; prompt for overlay permission when needed. */
export async function showWorkoutFloatingOverlayWhenAllowed() {
  const module = nativeModule();
  if (!module) return;

  module.startOverlay?.();

  const canDraw = await module.canDrawOverlays?.().catch(() => false);
  if (canDraw) return;

  if (overlayPromptShownThisSession) return;
  overlayPromptShownThisSession = true;

  Alert.alert(
    "Enable workout bar",
    "Allow Kak Fit to show a workout bar at the bottom of your screen (like a music mini-player). Tap Enable, then turn on \"Display over other apps\".",
    [
      { text: "Notification only", style: "cancel" },
      { text: "Enable bar", onPress: () => module.requestOverlayPermission?.() },
    ],
  );
}

export function addWorkoutWidgetSkipRestListener(listener: () => void | Promise<void>) {
  const module = nativeModule();
  if (!module) return { remove: () => undefined };
  const emitter = new NativeEventEmitter(NativeModules.KakWorkoutWidget);
  return emitter.addListener(SKIP_REST_EVENT, () => {
    void Promise.resolve(listener()).catch((error) => {
      console.error("Failed to handle workout skip rest", error);
    });
  });
}

export function addWorkoutWidgetCompleteSetListener(
  listener: (setId?: string) => void | Promise<void>,
) {
  const module = nativeModule();
  if (!module) return { remove: () => undefined };
  const emitter = new NativeEventEmitter(NativeModules.KakWorkoutWidget);
  return emitter.addListener(COMPLETE_EVENT, (payload: { setId?: string }) => {
    void Promise.resolve(listener(payload?.setId)).catch((error) => {
      console.error("Failed to handle workout widget action", error);
    });
  });
}
