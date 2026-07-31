import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  addMealReminderResponseListener,
  consumeLaunchMealReminderResponse,
  mealReminderPath,
} from "../lib/meal-plan-notifications";
import { useAuth } from "../lib/auth-context";

export function MealReminderNotificationBridge() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    const launchMeal = consumeLaunchMealReminderResponse();
    if (launchMeal) {
      router.push(mealReminderPath(launchMeal) as never);
    }

    const subscription = addMealReminderResponseListener((mealType) => {
      router.push(mealReminderPath(mealType) as never);
    });

    return () => subscription.remove();
  }, [isAuthenticated, router]);

  return null;
}
