import { useMemo } from "react";
import { trpc, queryStaleTime } from "../lib/trpc";
import {
  defaultReminderRows,
  mealTitle,
  mealWindowLabel,
  toReminderRows,
  type ReminderRowItem,
} from "../lib/meal-reminder-items";
import type { MealTypeKey } from "../lib/theme";

type NutritionDayInput = { timezoneOffsetMinutes: number; dateMs: number };

function buildDayInput(date: Date): NutritionDayInput {
  const localNoon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  return {
    timezoneOffsetMinutes: date.getTimezoneOffset(),
    dateMs: localNoon.getTime(),
  };
}

const MEAL_TYPES: MealTypeKey[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

export function parseMealParam(value: string | string[] | undefined): MealTypeKey {
  const raw = Array.isArray(value) ? value[0] : value;
  const upper = raw?.toUpperCase();
  if (upper && MEAL_TYPES.includes(upper as MealTypeKey)) {
    return upper as MealTypeKey;
  }
  const hour = new Date().getHours();
  if (hour >= 5 && hour <= 10) return "BREAKFAST";
  if (hour >= 11 && hour <= 14) return "LUNCH";
  if (hour >= 15 && hour <= 17) return "SNACK";
  return "DINNER";
}

export function useUsualMealItems(mealType: MealTypeKey) {
  const dayInput = useMemo(() => buildDayInput(new Date()), []);
  const query = trpc.nutrition.usualMealItems.useQuery(
    { mealType, ...dayInput },
    { staleTime: queryStaleTime.nutritionMeals },
  );

  const rows: ReminderRowItem[] = useMemo(() => {
    if (query.data?.items.length) {
      return toReminderRows(query.data.items);
    }
    return defaultReminderRows(mealType);
  }, [query.data, mealType]);

  const title = query.data?.title ?? mealTitle(mealType);
  const window = mealWindowLabel(mealType, query.data?.time ?? undefined);
  const planId = query.data?.planId ?? undefined;
  const protein = query.data?.protein ?? undefined;

  return {
    ...query,
    rows,
    title,
    window,
    planId,
    protein,
    mealLabel: mealTitle(mealType),
    dayInput,
  };
}
