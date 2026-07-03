import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";

export const MealTypeSchema = z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]);

export const PlannedFoodItemSchema = z.object({
  name: z.string().min(1).max(120),
  amount: z.string().min(1).max(80),
  calories: z.number().min(0).max(2500),
  protein: z.number().min(0).max(300),
  carbs: z.number().min(0).max(500),
  fat: z.number().min(0).max(250),
});

export const PlannedMealSchema = z.object({
  mealType: MealTypeSchema,
  title: z.string().min(1).max(120),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  calories: z.number().min(0).max(4000),
  protein: z.number().min(0).max(400),
  carbs: z.number().min(0).max(800),
  fat: z.number().min(0).max(400),
  prepMinutes: z.number().int().min(0).max(180),
  items: z.array(PlannedFoodItemSchema).min(1).max(8),
  instructions: z.string().min(1).max(500),
  swapIdeas: z.array(z.string().min(1).max(120)).min(1).max(4),
});

export const MealPlanPayloadSchema = z.object({
  meals: z.array(PlannedMealSchema).length(4),
  notes: z.string().min(1).max(800),
});

export type PlannedMeal = z.infer<typeof PlannedMealSchema>;
export type MealPlanPayload = z.infer<typeof MealPlanPayloadSchema>;

export type NutritionProfileInput = {
  age: number;
  sex: "male" | "female" | "other";
  heightCm: number;
  weightKg: number;
  goal: "lose_fat" | "maintain" | "gain_muscle";
  activityLevel: "low" | "moderate" | "high";
  dietPreference: string;
  cookingAccess: string;
  availableFoods: string[];
  avoidances: string[];
  recentWorkoutCount: number;
};

export type NutritionTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const MEAL_DISTRIBUTION: Record<PlannedMeal["mealType"], number> = {
  BREAKFAST: 0.25,
  LUNCH: 0.35,
  DINNER: 0.3,
  SNACK: 0.1,
};

const DEFAULT_TIMES: Record<PlannedMeal["mealType"], string> = {
  BREAKFAST: "08:00",
  LUNCH: "13:00",
  SNACK: "17:00",
  DINNER: "20:30",
};

const MEAL_TITLES: Record<PlannedMeal["mealType"], string> = {
  BREAKFAST: "Simple breakfast plate",
  LUNCH: "Main lunch bowl",
  SNACK: "Protein snack",
  DINNER: "Light dinner plate",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

function normalizeFoodList(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, 40);
}

export function calculateNutritionTargets(profile: NutritionProfileInput): NutritionTargets {
  const sexOffset = profile.sex === "male" ? 5 : profile.sex === "female" ? -161 : -78;
  const bmr = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + sexOffset;
  const workoutBoost = Math.min(0.12, profile.recentWorkoutCount * 0.015);
  const activityMultiplier =
    profile.activityLevel === "high" ? 1.65 : profile.activityLevel === "moderate" ? 1.45 : 1.3;
  const maintenance = bmr * (activityMultiplier + workoutBoost);
  const goalMultiplier =
    profile.goal === "lose_fat" ? 0.85 : profile.goal === "gain_muscle" ? 1.1 : 1;
  const minimumCalories = profile.sex === "female" ? 1200 : 1400;
  const calories = roundTo(clamp(maintenance * goalMultiplier, minimumCalories, 5000), 25);

  const proteinPerKg = profile.goal === "maintain" ? 1.6 : 1.8;
  const protein = Math.round(clamp(profile.weightKg * proteinPerKg, 45, 260));
  const fat = Math.round(clamp((calories * 0.25) / 9, 35, 160));
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return { calories, protein, carbs, fat };
}

function mealTotals(items: z.infer<typeof PlannedFoodItemSchema>[]) {
  return items.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function normalizePlan(payload: MealPlanPayload): MealPlanPayload {
  const order: PlannedMeal["mealType"][] = ["BREAKFAST", "LUNCH", "SNACK", "DINNER"];
  const byType = new Map(payload.meals.map((meal) => [meal.mealType, meal]));
  return {
    notes: payload.notes,
    meals: order.map((mealType) => {
      const meal = byType.get(mealType)!;
      const totals = mealTotals(meal.items);
      return {
        ...meal,
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein),
        carbs: Math.round(totals.carbs),
        fat: Math.round(totals.fat),
        prepMinutes: Math.round(meal.prepMinutes),
      };
    }),
  };
}

function extractJson(text: string) {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("Model did not return JSON");
  return text.slice(first, last + 1);
}

function contentText(response: unknown) {
  const content = (response as { output?: { message?: { content?: Array<{ text?: string }> } } }).output?.message?.content ?? [];
  return content.map((part) => part.text ?? "").join("\n").trim();
}

const BEDROCK_TIMEOUT_MS = 12_000;
let bedrockClient: BedrockRuntimeClient | null = null;
let bedrockClientRegion: string | null = null;

function getBedrockClient() {
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  if (!bedrockClient || bedrockClientRegion !== region) {
    bedrockClient = new BedrockRuntimeClient({ region });
    bedrockClientRegion = region;
  }
  return bedrockClient;
}

function buildPrompt(profile: NutritionProfileInput, targets: NutritionTargets, swapMealType?: PlannedMeal["mealType"]) {
  const availableFoods = normalizeFoodList(profile.availableFoods).join(", ");
  const avoidances = normalizeFoodList(profile.avoidances).join(", ") || "none";
  const swapInstruction = swapMealType
    ? `Regenerate only the ${swapMealType} idea, but still return all four meals.`
    : "Create all four meals.";

  return `You are a practical nutrition planner for a fitness app. Return ONLY valid JSON. No markdown.

User:
- age: ${profile.age}
- sex: ${profile.sex}
- heightCm: ${profile.heightCm}
- weightKg: ${profile.weightKg}
- goal: ${profile.goal}
- activity: ${profile.activityLevel}
- diet: ${profile.dietPreference}
- cooking access: ${profile.cookingAccess}
- available foods: ${availableFoods}
- avoidances/allergies: ${avoidances}
- recent workouts last 14 days: ${profile.recentWorkoutCount}

Daily targets calculated by backend:
- calories: ${targets.calories}
- protein: ${targets.protein}g
- carbs: ${targets.carbs}g
- fat: ${targets.fat}g

Rules:
- Use only available foods, normal pantry basics, water, salt, and basic spices.
- Never include avoidances/allergies.
- Prefer low-cost, locally realistic meals.
- Keep each meal simple and easy to cook.
- Total daily calories must be within 10% of target.
- Total daily protein must be within 15% of target.
- ${swapInstruction}

JSON schema:
{
  "notes": "short practical note",
  "meals": [
    {
      "mealType": "BREAKFAST|LUNCH|SNACK|DINNER",
      "title": "meal title",
      "time": "HH:MM",
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0,
      "prepMinutes": 0,
      "items": [
        { "name": "food", "amount": "portion", "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }
      ],
      "instructions": "one sentence",
      "swapIdeas": ["idea 1", "idea 2"]
    }
  ]
}`;
}

function fallbackMeal(mealType: PlannedMeal["mealType"], foods: string[], targets: NutritionTargets): PlannedMeal {
  const ratio = MEAL_DISTRIBUTION[mealType];
  const mealCalories = Math.round(targets.calories * ratio);
  const mealProtein = Math.round(targets.protein * ratio);
  const mealCarbs = Math.round(targets.carbs * ratio);
  const mealFat = Math.round(targets.fat * ratio);
  const primary = foods[0] ?? "rice";
  const proteinFood = foods.find((food) => /dal|curd|milk|paneer|egg|chicken|fish|soy|chana|peanut/i.test(food)) ?? primary;
  const carbFood = foods.find((food) => /rice|roti|chapati|bread|potato|banana|oats/i.test(food)) ?? primary;
  const vegFood = foods.find((food) => /sabzi|vegetable|spinach|tomato|onion|cucumber|fruit/i.test(food)) ?? foods[1] ?? primary;
  const items = [
    {
      name: proteinFood,
      amount: "1 serving",
      calories: Math.round(mealCalories * 0.45),
      protein: Math.round(mealProtein * 0.65),
      carbs: Math.round(mealCarbs * 0.25),
      fat: Math.round(mealFat * 0.45),
    },
    {
      name: carbFood,
      amount: "1 serving",
      calories: Math.round(mealCalories * 0.4),
      protein: Math.round(mealProtein * 0.2),
      carbs: Math.round(mealCarbs * 0.65),
      fat: Math.round(mealFat * 0.2),
    },
    {
      name: vegFood,
      amount: "1 bowl",
      calories: Math.round(mealCalories * 0.15),
      protein: Math.round(mealProtein * 0.15),
      carbs: Math.round(mealCarbs * 0.1),
      fat: Math.round(mealFat * 0.35),
    },
  ];
  return {
    mealType,
    title: MEAL_TITLES[mealType],
    time: DEFAULT_TIMES[mealType],
    calories: mealCalories,
    protein: mealProtein,
    carbs: mealCarbs,
    fat: mealFat,
    prepMinutes: mealType === "SNACK" ? 5 : 20,
    items,
    instructions: "Keep portions simple and adjust salt/spices to taste.",
    swapIdeas: foods.slice(0, 3).map((food) => `Use ${food} as the main item`),
  };
}

export function buildFallbackMealPlan(profile: NutritionProfileInput, targets: NutritionTargets): MealPlanPayload {
  const foods = normalizeFoodList(profile.availableFoods);
  return normalizePlan({
    notes: "Plan generated from your available foods. Add more foods for better options.",
    meals: ["BREAKFAST", "LUNCH", "SNACK", "DINNER"].map((mealType) =>
      fallbackMeal(mealType as PlannedMeal["mealType"], foods, targets),
    ),
  });
}

export async function generateNovaMealPlan(
  profile: NutritionProfileInput,
  targets: NutritionTargets,
  options?: { swapMealType?: PlannedMeal["mealType"] },
): Promise<{ payload: MealPlanPayload; source: string }> {
  const modelId = process.env.BEDROCK_NOVA_MODEL_ID?.trim() || "amazon.nova-lite-v1:0";
  const prompt = buildPrompt(profile, targets, options?.swapMealType);

  try {
    const client = getBedrockClient();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BEDROCK_TIMEOUT_MS);
    const response = await client.send(
      new ConverseCommand({
        modelId,
        messages: [{ role: "user", content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 3000, temperature: 0.35, topP: 0.9 },
      }),
      { abortSignal: controller.signal },
    ).finally(() => clearTimeout(timeout));
    const raw = contentText(response);
    const parsed = JSON.parse(extractJson(raw)) as unknown;
    return { payload: normalizePlan(MealPlanPayloadSchema.parse(parsed)), source: modelId };
  } catch (error) {
    console.error("[nutrition-planner] Bedrock plan generation failed", error);
    return { payload: buildFallbackMealPlan(profile, targets), source: "fallback" };
  }
}
