import { useLocalSearchParams, useRouter } from "expo-router";
import { MealLogSheet } from "../src/components/meal-log-sheet";
import { parseMealParam, useUsualMealItems } from "../src/hooks/use-usual-meal-items";

export default function MealReminderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: string }>();
  const mealType = parseMealParam(params.meal);
  const { planId } = useUsualMealItems(mealType);

  return (
    <MealLogSheet
      mealType={mealType}
      planId={planId}
      initialSegment="USUAL"
      presentation="screen"
      onClose={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)/nutrition");
      }}
    />
  );
}
