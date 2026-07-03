import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildFallbackMealPlan,
  calculateNutritionTargets,
  type NutritionProfileInput,
} from "./nutrition-planner";

const profile: NutritionProfileInput = {
  age: 25,
  sex: "male",
  heightCm: 175,
  weightKg: 75,
  goal: "gain_muscle",
  activityLevel: "moderate",
  dietPreference: "Indian home food",
  cookingAccess: "stove",
  availableFoods: ["roti", "rice", "dal", "curd", "banana", "chana"],
  avoidances: [],
  recentWorkoutCount: 4,
};

describe("nutrition planner", () => {
  it("calculates bounded targets from user profile and workouts", () => {
    const targets = calculateNutritionTargets(profile);
    assert.equal(targets.calories, 2875);
    assert.equal(targets.protein, 135);
    assert.ok(targets.carbs > 0);
    assert.ok(targets.fat > 0);
  });

  it("builds a four-meal fallback plan from available foods", () => {
    const targets = calculateNutritionTargets(profile);
    const plan = buildFallbackMealPlan(profile, targets);
    assert.equal(plan.meals.length, 4);
    assert.deepEqual(plan.meals.map((meal) => meal.mealType), ["BREAKFAST", "LUNCH", "SNACK", "DINNER"]);
    assert.ok(plan.meals.every((meal) => meal.items.length >= 1));
    assert.ok(plan.meals.some((meal) => meal.items.some((item) => item.name === "dal" || item.name === "curd" || item.name === "chana")));
  });
});
