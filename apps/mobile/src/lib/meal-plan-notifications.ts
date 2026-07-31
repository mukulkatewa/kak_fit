import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const CHANNEL_ID = "meal-plan";
const PROMPTED_KEY = "@kak_fit/meal_notification_prompted";

export type MealReminderPlan = {
  id: string;
  date: string | Date;
  meals: Array<{ mealType: string; title: string; time: string; protein?: number | null }>;
};

export type MealReminderNotificationData = {
  kind: "mealPlan";
  screen: "meal-reminder";
  planId: string;
  mealType: string;
  title?: string;
  protein?: number | null;
};

function notificationsAvailable() {
  return Platform.OS !== "web";
}

function allowsNotifications(settings: Notifications.NotificationPermissionsStatus) {
  return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

async function registerChannel() {
  if (!notificationsAvailable()) return;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Meal reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: false,
      enableVibrate: true,
      description: "Planned meal reminders for today.",
    });
  }
}

export async function requestMealReminderPermissionOnce() {
  if (!notificationsAvailable()) return false;
  await registerChannel();
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

function notificationId(planId: string, mealType: string) {
  return `meal-plan-${planId}-${mealType}`;
}

/** Used when a reminder comes from logging history rather than a saved plan. */
const ADHOC_PLAN_KEY = "adhoc";

function snoozeNotificationId(planId: string, mealType: string) {
  return `meal-plan-snooze-${planId}-${mealType}`;
}

function triggerDateForMeal(planDate: string | Date, time: string) {
  const date = new Date(planDate);
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  date.setHours(Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return date;
}

function mealReminderData(
  planId: string,
  meal: { mealType: string; title: string; protein?: number | null },
): MealReminderNotificationData {
  return {
    kind: "mealPlan",
    screen: "meal-reminder",
    planId,
    mealType: meal.mealType,
    title: meal.title,
    protein: meal.protein ?? null,
  };
}

export async function scheduleMealPlanNotifications(plan: MealReminderPlan) {
  if (!notificationsAvailable()) return;
  const permitted = await requestMealReminderPermissionOnce();
  if (!permitted) return;

  const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    allScheduled
      .filter((n) => n.content.data != null && (n.content.data as { kind?: string }).kind === "mealPlan")
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => undefined)),
  );

  const now = Date.now();
  for (const meal of plan.meals) {
    const date = triggerDateForMeal(plan.date, meal.time);
    if (date.getTime() <= now + 60_000) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: notificationId(plan.id, meal.mealType),
      content: {
        title: meal.title,
        body: meal.protein ? `Time to eat. This meal adds ${Math.round(meal.protein)}g protein.` : "Time for your planned meal.",
        data: mealReminderData(plan.id, meal),
        sound: false,
        interruptionLevel: "passive",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: CHANNEL_ID,
      },
    });
  }
}

/**
 * Reschedules a meal reminder. `planId` is optional: reminders can also be
 * driven by logging history rather than a generated meal plan, and snoozing
 * must still work for those — otherwise the button silently does nothing.
 */
export async function snoozeMealReminder(input: {
  planId?: string | null;
  mealType: string;
  title: string;
  protein?: number | null;
  minutes?: number;
}) {
  if (!notificationsAvailable()) return;
  const permitted = await requestMealReminderPermissionOnce();
  if (!permitted) return;

  const planKey = input.planId ?? ADHOC_PLAN_KEY;
  const minutes = input.minutes ?? 30;
  const identifier = snoozeNotificationId(planKey, input.mealType);
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);

  const date = new Date(Date.now() + minutes * 60_000);
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: input.title,
      body: input.protein
        ? `Snoozed reminder — ${Math.round(input.protein)}g protein when you're ready.`
        : "Snoozed meal reminder.",
      data: mealReminderData(planKey, {
        mealType: input.mealType,
        title: input.title,
        protein: input.protein,
      }),
      sound: false,
      interruptionLevel: "passive",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: CHANNEL_ID,
    },
  });
}

export function mealReminderPath(mealType: string) {
  return `/meal-reminder?meal=${encodeURIComponent(mealType)}`;
}

export function addMealReminderResponseListener(listener: (mealType: string) => void | Promise<void>) {
  if (!notificationsAvailable()) return { remove: () => undefined };
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Partial<MealReminderNotificationData>;
    if (data?.kind !== "mealPlan" || data.screen !== "meal-reminder" || !data.mealType) return;
    void Promise.resolve(listener(data.mealType)).catch((error) => {
      console.error("Failed to handle meal reminder notification", error);
    });
  });
}

export function consumeLaunchMealReminderResponse() {
  if (!notificationsAvailable()) return null;
  const lastResponse = Notifications.getLastNotificationResponse();
  const data = lastResponse?.notification.request.content.data as Partial<MealReminderNotificationData> | undefined;
  if (data?.kind !== "mealPlan" || data.screen !== "meal-reminder" || !data.mealType) {
    return null;
  }
  Notifications.clearLastNotificationResponse();
  return data.mealType;
}

export function mealReminderDeepLink(mealType: string) {
  return Linking.createURL(mealReminderPath(mealType));
}
