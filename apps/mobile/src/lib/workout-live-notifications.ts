import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  buildWorkoutNotificationText,
  type WorkoutWidgetSummary,
} from "./workout-live-widget-state";

export const WORKOUT_NOTIFICATION_CATEGORY = "active-workout-controls";
export const WORKOUT_NOTIFICATION_CHANNEL_ID = "active-workout";
export const WORKOUT_NOTIFICATION_ID = "active-workout-live";
export const COMPLETE_NEXT_SET_ACTION = "COMPLETE_NEXT_SET";
export const OPEN_WORKOUT_ACTION = "OPEN_WORKOUT";

const PROMPTED_KEY = "@kak_fit/workout_notification_prompted";
let registered = false;

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
    }),
  });
}

function notificationsAvailable() {
  return Platform.OS !== "web";
}

function allowsNotifications(settings: Notifications.NotificationPermissionsStatus) {
  return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function registerWorkoutNotificationSurface() {
  if (!notificationsAvailable() || registered) return;
  registered = true;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(WORKOUT_NOTIFICATION_CHANNEL_ID, {
      name: "Active workout",
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: false,
      enableVibrate: false,
      vibrationPattern: [],
      description: "Current workout progress and quick set controls.",
    });
  }

  await Notifications.setNotificationCategoryAsync(WORKOUT_NOTIFICATION_CATEGORY, [
    {
      identifier: COMPLETE_NEXT_SET_ACTION,
      buttonTitle: "Tick rep",
      options: { opensAppToForeground: true, isAuthenticationRequired: false },
    },
    {
      identifier: OPEN_WORKOUT_ACTION,
      buttonTitle: "Open",
      options: { opensAppToForeground: true, isAuthenticationRequired: false },
    },
  ]);
}

export async function hasWorkoutNotificationPermission() {
  if (!notificationsAvailable()) return false;
  const settings = await Notifications.getPermissionsAsync();
  return allowsNotifications(settings);
}

export async function requestWorkoutNotificationPermissionOnce() {
  if (!notificationsAvailable()) return false;
  await registerWorkoutNotificationSurface();

  const existing = await Notifications.getPermissionsAsync();
  if (allowsNotifications(existing)) return true;

  const prompted = await AsyncStorage.getItem(PROMPTED_KEY);
  if (prompted === "1") return false;

  await AsyncStorage.setItem(PROMPTED_KEY, "1");
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: false },
  });
  return allowsNotifications(requested);
}

export async function showWorkoutNotification(summary: WorkoutWidgetSummary) {
  if (!notificationsAvailable()) return;
  await registerWorkoutNotificationSurface();
  if (!(await hasWorkoutNotificationPermission())) return;

  const copy = buildWorkoutNotificationText(summary);
  await Notifications.dismissNotificationAsync(WORKOUT_NOTIFICATION_ID).catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier: WORKOUT_NOTIFICATION_ID,
    content: {
      title: copy.title,
      body: copy.body,
      subtitle: summary.progressLabel,
      categoryIdentifier: WORKOUT_NOTIFICATION_CATEGORY,
      data: {
        kind: "activeWorkout",
        workoutId: summary.workoutId,
        url: Linking.createURL("/workout/active"),
      },
      sound: false,
      sticky: true,
      autoDismiss: false,
      color: "#0A84FF",
      priority: Notifications.AndroidNotificationPriority.HIGH,
      interruptionLevel: "active",
    },
    trigger: Platform.OS === "android" ? { channelId: WORKOUT_NOTIFICATION_CHANNEL_ID } : null,
  });
}

export async function dismissWorkoutNotification() {
  if (!notificationsAvailable()) return;
  await Notifications.dismissNotificationAsync(WORKOUT_NOTIFICATION_ID).catch(() => undefined);
}

export const NOTIFICATION_DEFAULT_ACTION = Notifications.DEFAULT_ACTION_IDENTIFIER;

export function addWorkoutNotificationResponseListener(
  listener: (actionIdentifier: string) => void | Promise<void>,
) {
  if (!notificationsAvailable()) return { remove: () => undefined };
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.kind !== "activeWorkout") return;
    void Promise.resolve(listener(response.actionIdentifier)).catch((error) => {
      console.error("Failed to handle workout notification action", error);
    });
  });
}

/** Returns true when the app was opened from an active-workout notification. */
export function consumeLaunchWorkoutNotificationResponse() {
  if (!notificationsAvailable()) return false;
  const lastResponse = Notifications.getLastNotificationResponse();
  if (lastResponse?.notification.request.content.data?.kind !== "activeWorkout") {
    return false;
  }
  Notifications.clearLastNotificationResponse();
  return true;
}
