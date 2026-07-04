import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const CHANNEL_ID = "meal-plan";
const PROMPTED_KEY = "@kak_fit/meal_notification_prompted";

export type MealReminderPlan = {
  id: string;
  date: string | Date;
  meals: Array<{ mealType: string; title: string; time: string; protein?: number | null }>;
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

function triggerDateForMeal(planDate: string | Date, time: string) {
  const date = new Date(planDate);
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  date.setHours(Number.isFinite(hours) ? hours : 9, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return date;
}

export async function scheduleMealPlanNotifications(plan: MealReminderPlan) {
  if (!notificationsAvailable()) return;
  const permitted = await requestMealReminderPermissionOnce();
  if (!permitted) return;

  // Cancel ALL previously-scheduled meal-plan notifications (not just those with the
  // current plan.id) so regenerated plans don't leave orphaned notifications behind.
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
        data: { kind: "mealPlan", planId: plan.id, mealType: meal.mealType },
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
