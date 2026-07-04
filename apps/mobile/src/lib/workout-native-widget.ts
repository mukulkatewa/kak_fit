import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, NativeEventEmitter, NativeModules, Platform } from "react-native";
import type { WorkoutWidgetSummary } from "./workout-live-widget-state";

const OVERLAY_PROMPTED_KEY = "@kak_fit/workout_overlay_prompted";
const COMPLETE_EVENT = "KakWorkoutWidgetCompleteSet";

type NativeWorkoutWidget = {
  update?: (summary: WorkoutWidgetSummary) => void;
  clear?: () => void;
  tickRep?: () => void;
  startRestTimer?: (seconds: number) => void;
  canDrawOverlays?: () => Promise<boolean>;
  requestOverlayPermission?: () => void;
  startOverlay?: () => void;
  stopOverlay?: () => void;
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

export function updateWorkoutNativeWidget(summary: WorkoutWidgetSummary) {
  nativeModule()?.update?.(summary);
}

export function clearWorkoutNativeWidget() {
  const module = nativeModule();
  module?.clear?.();
  module?.stopOverlay?.();
}

export function tickWorkoutNativeWidgetRep() {
  nativeModule()?.tickRep?.();
}

export function workoutNativeWidgetStartRestTimer(seconds: number) {
  if (seconds <= 0) return;
  nativeModule()?.startRestTimer?.(seconds);
}

export async function ensureWorkoutFloatingWidget(summary: WorkoutWidgetSummary) {
  const module = nativeModule();
  if (!module) return;
  module.update?.(summary);

  const canDraw = await module.canDrawOverlays?.().catch(() => false);
  if (canDraw) {
    module.startOverlay?.();
    return;
  }

  const prompted = await AsyncStorage.getItem(OVERLAY_PROMPTED_KEY);
  if (prompted === "1") return;
  await AsyncStorage.setItem(OVERLAY_PROMPTED_KEY, "1");

  Alert.alert(
    "Enable workout widget",
    "Allow Kak Fit to show a small workout control box over your home screen while a workout is active.",
    [
      { text: "Not now", style: "cancel" },
      { text: "Enable", onPress: () => module.requestOverlayPermission?.() },
    ],
  );
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
