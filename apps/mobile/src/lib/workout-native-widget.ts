import { NativeEventEmitter, NativeModules, Platform } from "react-native";
import type { WorkoutWidgetSummary } from "./workout-live-widget-state";

const COMPLETE_EVENT = "KakWorkoutWidgetCompleteSet";
const SKIP_REST_EVENT = "KakWorkoutWidgetSkipRest";

type NativeWorkoutWidget = {
  update?: (summary: WorkoutWidgetSummary) => void;
  clear?: () => void;
  tickRep?: () => void;
  skipRest?: () => void;
  startRestTimer?: (seconds: number) => void;
  refreshLockscreen?: () => void;
  setControlsVisible?: (visible: boolean) => void;
  canDrawOverlays?: () => Promise<boolean>;
  openOverlaySettings?: () => void;
  getPendingSyncSetIds?: () => Promise<string[]>;
  clearPendingSyncSetIds?: () => void;
  removePendingSyncSetId?: (setId: string) => void;
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

/** Sync workout state to native prefs + home-screen widget. */
export function updateWorkoutNativeWidget(summary: WorkoutWidgetSummary) {
  nativeModule()?.update?.(summary);
}

/** Stop the foreground notification service and clear shared prefs. */
export function clearWorkoutNativeWidget() {
  nativeModule()?.clear?.();
}

/** Show or hide floating overlay + home-screen widget action buttons (background only). */
export function setWorkoutNativeWidgetControlsVisible(visible: boolean) {
  nativeModule()?.setControlsVisible?.(visible);
}

/** Refresh lockscreen notification + notification shade (runs while workout is active). */
export function refreshWorkoutNativeLockscreen() {
  nativeModule()?.refreshLockscreen?.();
}

export async function canDrawWorkoutOverlay() {
  const module = nativeModule();
  if (!module?.canDrawOverlays) return false;
  try {
    return (await module.canDrawOverlays()) === true;
  } catch {
    return false;
  }
}

export function openWorkoutOverlaySettings() {
  nativeModule()?.openOverlaySettings?.();
}

export async function getPendingWorkoutWidgetSyncSetIds() {
  const module = nativeModule();
  if (!module?.getPendingSyncSetIds) return [] as string[];
  try {
    return (await module.getPendingSyncSetIds()) ?? [];
  } catch {
    return [];
  }
}

export function clearPendingWorkoutWidgetSyncSetIds() {
  nativeModule()?.clearPendingSyncSetIds?.();
}

export function removePendingWorkoutWidgetSyncSetId(setId: string) {
  if (!setId) return;
  nativeModule()?.removePendingSyncSetId?.(setId);
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
