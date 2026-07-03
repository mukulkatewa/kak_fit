import { Prisma } from "@kak-fit/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { fetchExternal } from "../fetch-external";
import { startOfUserDay } from "../lib/timezone";
import {
  MealPlanPayloadSchema,
  MealTypeSchema,
  calculateNutritionTargets,
  generateNovaMealPlan,
  type MealPlanPayload,
  type NutritionProfileInput,
} from "../services/nutrition-planner";
import { protectedProcedure, router } from "../trpc";

const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";
const DAY_MS = 24 * 60 * 60 * 1000;

/** USDA nutrient IDs (FoodData Central) */
const NUTRIENT_IDS = {
  calories: 1008,
  protein: 1003,
  carbs: 1005,
  fat: 1004,
  fiber: 1079,
} as const;

type UsdaNutrient = {
  nutrientId?: number;
  nutrientName?: string;
  value?: number;
  unitName?: string;
};

type UsdaFood = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  foodNutrients?: UsdaNutrient[];
};

function getApiKey() {
  return process.env.USDA_API_KEY?.trim() || null;
}

function extractNutrients(food: UsdaFood) {
  const nutrients = food.foodNutrients ?? [];

  const byId = (id: number) =>
    nutrients.find((n) => n.nutrientId === id)?.value ?? 0;

  const byName = (fragment: string) =>
    nutrients.find((n) => n.nutrientName?.toLowerCase().includes(fragment))?.value ?? 0;

  return {
    calories: byId(NUTRIENT_IDS.calories) || byName("energy"),
    protein: byId(NUTRIENT_IDS.protein) || byName("protein"),
    carbs: byId(NUTRIENT_IDS.carbs) || byName("carbohydrate"),
    fat: byId(NUTRIENT_IDS.fat) || byName("lipid") || byName("fat"),
    fiber: byId(NUTRIENT_IDS.fiber) || byName("fiber"),
  };
}

async function fetchUsdaFoodDetail(fdcId: number, apiKey: string): Promise<UsdaFood | null> {
  const url = `${USDA_BASE}/food/${fdcId}?api_key=${apiKey}`;
  const response = await fetchExternal(url);
  if (!response.ok) return null;
  return response.json<UsdaFood>();
}

async function searchUsda(query: string, apiKey: string): Promise<UsdaFood[]> {
  const params = new URLSearchParams({
    api_key: apiKey,
    query,
    pageSize: "20",
    dataType: "Foundation,SR Legacy,Survey (FNDDS),Branded",
  });

  const response = await fetchExternal(`${USDA_BASE}/foods/search?${params}`);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `USDA API error (${response.status}). ${body.slice(0, 120)}`,
    });
  }

  const data = await response.json<{ foods?: UsdaFood[] }>();
  return data.foods ?? [];
}

const DEFAULT_TARGETS = {
  calories: 2500,
  protein: 180,
  carbs: 250,
  fat: 80,
};

export type FoodSearchResult = {
  id: string | null;
  fdcId: number;
  name: string;
  brand: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: "local" | "usda";
};

const timezoneOffsetInput = z.object({
  timezoneOffsetMinutes: z.number().int().optional(),
});

const searchFoodsInput = z.object({ query: z.string().min(2).max(100) });

const searchFoodsUsdaInput = z.object({
  query: z.string().min(2).max(100),
  excludeNames: z.array(z.string()).optional(),
});

const USDA_SEARCH_TIMEOUT_MS = 3000;

async function queryLocalFoods(
  ctx: { prisma: import("@kak-fit/db").PrismaClient; user: { id: string } },
  query: string,
): Promise<FoodSearchResult[]> {
  const local = await ctx.prisma.food.findMany({
    where: {
      name: { contains: query, mode: "insensitive" },
      OR: [{ isCustom: false }, { isCustom: true, userId: ctx.user.id }],
    },
    take: 8,
    orderBy: { name: "asc" },
  });

  return local.map(toLocalResult);
}

async function queryUsdaFoods(
  query: string,
  apiKey: string,
  options?: { excludeNames?: Set<string>; limit?: number },
): Promise<FoodSearchResult[]> {
  const seen = new Set(options?.excludeNames ?? []);
  const limit = options?.limit ?? 20;

  const usdaFoods = await searchUsda(query, apiKey);
  const results: FoodSearchResult[] = [];
  const pendingDetail: UsdaFood[] = [];

  for (const food of usdaFoods) {
    if (results.length + pendingDetail.length >= limit) break;
    const key = food.description.toLowerCase();
    if (seen.has(key)) continue;

    const nutrients = extractNutrients(food);
    if (nutrients.calories === 0 && nutrients.protein === 0) {
      pendingDetail.push(food);
    } else {
      results.push(toUsdaResult(food, nutrients));
    }
    seen.add(key);
  }

  if (pendingDetail.length > 0) {
    const detailNutrients = await fetchUsdaDetailsInParallel(pendingDetail, apiKey, 3);
    for (const food of pendingDetail) {
      if (results.length >= limit) break;
      const nutrients = detailNutrients.get(food.fdcId) ?? extractNutrients(food);
      results.push(toUsdaResult(food, nutrients));
    }
  }

  return results;
}

async function searchFoodsMerged(
  ctx: { prisma: import("@kak-fit/db").PrismaClient; user: { id: string } },
  query: string,
): Promise<FoodSearchResult[]> {
  const localResults = await queryLocalFoods(ctx, query);
  const apiKey = getApiKey();

  if (!apiKey) {
    if (localResults.length === 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "USDA_API_KEY is missing on the server. Add it to .env and restart the API.",
      });
    }
    return localResults;
  }

  const seen = new Set(localResults.map((r) => r.name.toLowerCase()));
  const remaining = Math.max(0, 20 - localResults.length);

  try {
    const usdaResults = await Promise.race([
      queryUsdaFoods(query, apiKey, { excludeNames: seen, limit: remaining }),
      new Promise<FoodSearchResult[]>((_, reject) => {
        setTimeout(() => reject(new Error("USDA timeout")), USDA_SEARCH_TIMEOUT_MS);
      }),
    ]);
    return [...localResults, ...usdaResults].slice(0, 20);
  } catch (err) {
    if (localResults.length > 0) return localResults;
    const msg = err instanceof Error ? err.message : "USDA search failed";
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `Could not reach USDA API. ${msg}`,
    });
  }
}

async function fetchUsdaDetailsInParallel(
  foods: UsdaFood[],
  apiKey: string,
  concurrency = 3,
): Promise<Map<number, ReturnType<typeof extractNutrients>>> {
  const results = new Map<number, ReturnType<typeof extractNutrients>>();

  for (let i = 0; i < foods.length; i += concurrency) {
    const batch = foods.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async (food) => {
        const detail = await fetchUsdaFoodDetail(food.fdcId, apiKey);
        return {
          fdcId: food.fdcId,
          nutrients: detail ? extractNutrients(detail) : extractNutrients(food),
        };
      }),
    );

    for (const entry of settled) {
      if (entry.status === "fulfilled") {
        results.set(entry.value.fdcId, entry.value.nutrients);
      }
    }
  }

  return results;
}

const customFoodInput = z.object({
  name: z.string().min(2).max(120),
  brand: z.string().max(120).nullable().optional(),
  calories: z.number().min(0).max(5000),
  protein: z.number().min(0).max(1000),
  carbs: z.number().min(0).max(1000),
  fat: z.number().min(0).max(1000),
  fiber: z.number().min(0).max(1000).nullable().optional(),
  servingSize: z.number().positive().max(5000).default(100),
  servingUnit: z.string().min(1).max(24).default("g"),
});

function toLocalResult(f: {
  id: string;
  usdaFdcId: number | null;
  name: string;
  brand: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}): FoodSearchResult {
  return {
    id: f.id,
    fdcId: f.usdaFdcId ?? 0,
    name: f.name,
    brand: f.brand,
    calories: f.calories,
    protein: f.protein,
    carbs: f.carbs,
    fat: f.fat,
    source: "local",
  };
}

function toUsdaResult(food: UsdaFood, nutrients: ReturnType<typeof extractNutrients>): FoodSearchResult {
  return {
    id: null,
    fdcId: food.fdcId,
    name: food.description,
    brand: food.brandOwner ?? food.brandName ?? null,
    calories: nutrients.calories,
    protein: nutrients.protein,
    carbs: nutrients.carbs,
    fat: nutrients.fat,
    source: "usda",
  };
}

function resolveTargets(user: {
  calorieGoal: number | null;
  proteinGoal: number | null;
  carbGoal: number | null;
  fatGoal: number | null;
}) {
  return {
    calories: user.calorieGoal ?? DEFAULT_TARGETS.calories,
    protein: user.proteinGoal ?? DEFAULT_TARGETS.protein,
    carbs: user.carbGoal ?? DEFAULT_TARGETS.carbs,
    fat: user.fatGoal ?? DEFAULT_TARGETS.fat,
    configured: user.calorieGoal != null,
  };
}

const plannerProfileInput = z.object({
  age: z.number().int().min(13).max(90),
  sex: z.enum(["male", "female", "other"]),
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(30).max(300),
  goal: z.enum(["lose_fat", "maintain", "gain_muscle"]),
  activityLevel: z.enum(["low", "moderate", "high"]),
  dietPreference: z.string().min(2).max(80),
  cookingAccess: z.string().min(2).max(120),
  availableFoods: z.array(z.string().min(1).max(80)).min(3).max(40),
  avoidances: z.array(z.string().min(1).max(80)).max(30).default([]),
  mealReminderEnabled: z.boolean().default(true),
});

function uniqueClean(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function recentWorkoutCount(ctx: { prisma: import("@kak-fit/db").PrismaClient; user: { id: string } }) {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  return ctx.prisma.workout.count({
    where: { userId: ctx.user.id, finishedAt: { gte: since } },
  });
}

function profileComplete(user: {
  nutritionAge: number | null;
  nutritionSex: string | null;
  heightCm: number | null;
  weightKg: number | null;
  nutritionGoal: string | null;
  activityLevel: string | null;
  dietPreference: string | null;
  cookingAccess: string | null;
  foodAvailability: string[];
}) {
  return Boolean(
    user.nutritionAge &&
      user.nutritionSex &&
      user.heightCm &&
      user.weightKg &&
      user.nutritionGoal &&
      user.activityLevel &&
      user.dietPreference &&
      user.cookingAccess &&
      user.foodAvailability.length >= 3,
  );
}

function toNutritionProfile(
  user: {
    nutritionAge: number | null;
    nutritionSex: string | null;
    heightCm: number | null;
    weightKg: number | null;
    nutritionGoal: string | null;
    activityLevel: string | null;
    dietPreference: string | null;
    cookingAccess: string | null;
    foodAvailability: string[];
    foodAvoidances: string[];
  },
  workoutCount: number,
): NutritionProfileInput {
  if (!profileComplete(user)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Add body details and at least 3 available foods first.",
    });
  }

  return {
    age: user.nutritionAge!,
    sex: user.nutritionSex as NutritionProfileInput["sex"],
    heightCm: user.heightCm!,
    weightKg: user.weightKg!,
    goal: user.nutritionGoal as NutritionProfileInput["goal"],
    activityLevel: user.activityLevel as NutritionProfileInput["activityLevel"],
    dietPreference: user.dietPreference!,
    cookingAccess: user.cookingAccess!,
    availableFoods: user.foodAvailability,
    avoidances: user.foodAvoidances,
    recentWorkoutCount: workoutCount,
  };
}

function parsePlanPayload(meals: unknown, notes: string | null): MealPlanPayload {
  return MealPlanPayloadSchema.parse({ meals, notes: notes || "Personalized meal plan." });
}

function plannedFoodName(_planId: string, _mealType: string, itemName: string, _amount: string) {
  return itemName.trim().slice(0, 120);
}

function dailyPlanSelect() {
  return {
    id: true,
    userId: true,
    date: true,
    targetCalories: true,
    targetProtein: true,
    targetCarbs: true,
    targetFat: true,
    availableFoods: true,
    meals: true,
    notes: true,
    skippedMealTypes: true,
    completedMealTypes: true,
    source: true,
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.MealPlanSelect;
}

export const nutritionRouter = router({
  listCustomFoods: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.food.findMany({
      where: { isCustom: true, userId: ctx.user.id },
      orderBy: { updatedAt: "desc" },
    });
  }),

  createCustomFood: protectedProcedure
    .input(customFoodInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.food.create({
        data: {
          name: input.name.trim(),
          brand: input.brand?.trim() || null,
          calories: input.calories,
          protein: input.protein,
          carbs: input.carbs,
          fat: input.fat,
          fiber: input.fiber ?? null,
          servingSize: input.servingSize,
          servingUnit: input.servingUnit.trim(),
          isCustom: true,
          userId: ctx.user.id,
        },
      });
    }),

  updateCustomFood: protectedProcedure
    .input(customFoodInput.extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const food = await ctx.prisma.food.findFirst({
        where: { id: input.id, isCustom: true, userId: ctx.user.id },
        select: { id: true },
      });
      if (!food) throw new TRPCError({ code: "NOT_FOUND", message: "Food not found" });

      return ctx.prisma.food.update({
        where: { id: input.id },
        data: {
          name: input.name.trim(),
          brand: input.brand?.trim() || null,
          calories: input.calories,
          protein: input.protein,
          carbs: input.carbs,
          fat: input.fat,
          fiber: input.fiber ?? null,
          servingSize: input.servingSize,
          servingUnit: input.servingUnit.trim(),
        },
      });
    }),

  deleteCustomFood: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const food = await ctx.prisma.food.findFirst({
        where: { id: input.id, isCustom: true, userId: ctx.user.id },
        select: { id: true },
      });
      if (!food) throw new TRPCError({ code: "NOT_FOUND", message: "Food not found" });

      const mealItemCount = await ctx.prisma.mealItem.count({ where: { foodId: input.id } });
      if (mealItemCount > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This food is used in meal history. Edit it instead of deleting it.",
        });
      }

      await ctx.prisma.food.delete({ where: { id: input.id } });
      return { success: true };
    }),

  getTargets: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: { calorieGoal: true, proteinGoal: true, carbGoal: true, fatGoal: true },
    });
    return resolveTargets(user ?? { calorieGoal: null, proteinGoal: null, carbGoal: null, fatGoal: null });
  }),

  setTargets: protectedProcedure
    .input(
      z.object({
        calories: z.number().int().min(500).max(10000),
        protein: z.number().int().min(0).max(1000),
        carbs: z.number().int().min(0).max(2000),
        fat: z.number().int().min(0).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          calorieGoal: input.calories,
          proteinGoal: input.protein,
          carbGoal: input.carbs,
          fatGoal: input.fat,
        },
      });
      return input;
    }),


  getPlannerProfile: protectedProcedure.query(async ({ ctx }) => {
    const [user, workoutCount] = await Promise.all([
      ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.user.id },
        select: {
          nutritionAge: true,
          nutritionSex: true,
          heightCm: true,
          weightKg: true,
          nutritionGoal: true,
          activityLevel: true,
          dietPreference: true,
          cookingAccess: true,
          foodAvailability: true,
          foodAvoidances: true,
          mealReminderEnabled: true,
          calorieGoal: true,
          proteinGoal: true,
          carbGoal: true,
          fatGoal: true,
        },
      }),
      recentWorkoutCount(ctx),
    ]);

    const complete = profileComplete(user);
    const estimatedTargets = complete
      ? calculateNutritionTargets(toNutritionProfile(user, workoutCount))
      : null;

    return {
      ...user,
      age: user.nutritionAge,
      sex: user.nutritionSex,
      goal: user.nutritionGoal,
      availableFoods: user.foodAvailability,
      avoidances: user.foodAvoidances,
      recentWorkoutCount: workoutCount,
      complete,
      estimatedTargets,
    };
  }),

  savePlannerProfile: protectedProcedure
    .input(plannerProfileInput)
    .mutation(async ({ ctx, input }) => {
      const workoutCount = await recentWorkoutCount(ctx);
      const profile: NutritionProfileInput = {
        age: input.age,
        sex: input.sex,
        heightCm: input.heightCm,
        weightKg: input.weightKg,
        goal: input.goal,
        activityLevel: input.activityLevel,
        dietPreference: input.dietPreference.trim(),
        cookingAccess: input.cookingAccess.trim(),
        availableFoods: uniqueClean(input.availableFoods),
        avoidances: uniqueClean(input.avoidances),
        recentWorkoutCount: workoutCount,
      };
      const targets = calculateNutritionTargets(profile);

      await ctx.prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          nutritionAge: profile.age,
          nutritionSex: profile.sex,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          nutritionGoal: profile.goal,
          activityLevel: profile.activityLevel,
          dietPreference: profile.dietPreference,
          cookingAccess: profile.cookingAccess,
          foodAvailability: { set: profile.availableFoods },
          foodAvoidances: { set: profile.avoidances },
          mealReminderEnabled: input.mealReminderEnabled,
          calorieGoal: targets.calories,
          proteinGoal: targets.protein,
          carbGoal: targets.carbs,
          fatGoal: targets.fat,
        },
      });

      return { success: true, targets };
    }),

  todayPlan: protectedProcedure
    .input(timezoneOffsetInput.optional())
    .query(async ({ ctx, input }) => {
      const startOfDay = startOfUserDay(new Date(), input?.timezoneOffsetMinutes);
      return ctx.prisma.mealPlan.findUnique({
        where: { userId_date: { userId: ctx.user.id, date: startOfDay } },
        select: dailyPlanSelect(),
      });
    }),

  previousPlan: protectedProcedure
    .input(timezoneOffsetInput.optional())
    .query(async ({ ctx, input }) => {
      const startOfDay = startOfUserDay(new Date(), input?.timezoneOffsetMinutes);
      return ctx.prisma.mealPlan.findFirst({
        where: { userId: ctx.user.id, date: { lt: startOfDay } },
        orderBy: { date: "desc" },
        select: dailyPlanSelect(),
      });
    }),

  reusePreviousPlan: protectedProcedure
    .input(timezoneOffsetInput.optional())
    .mutation(async ({ ctx, input }) => {
      const startOfDay = startOfUserDay(new Date(), input?.timezoneOffsetMinutes);
      const previous = await ctx.prisma.mealPlan.findFirst({
        where: { userId: ctx.user.id, date: { lt: startOfDay } },
        orderBy: { date: "desc" },
        select: dailyPlanSelect(),
      });
      if (!previous) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No previous meal plan found" });
      }

      return ctx.prisma.mealPlan.upsert({
        where: { userId_date: { userId: ctx.user.id, date: startOfDay } },
        create: {
          userId: ctx.user.id,
          date: startOfDay,
          targetCalories: previous.targetCalories,
          targetProtein: previous.targetProtein,
          targetCarbs: previous.targetCarbs,
          targetFat: previous.targetFat,
          availableFoods: { set: previous.availableFoods },
          meals: previous.meals as Prisma.InputJsonValue,
          notes: previous.notes ? `Reused from previous plan. ${previous.notes}` : "Reused from previous plan.",
          source: "reuse",
        },
        update: {
          targetCalories: previous.targetCalories,
          targetProtein: previous.targetProtein,
          targetCarbs: previous.targetCarbs,
          targetFat: previous.targetFat,
          availableFoods: { set: previous.availableFoods },
          meals: previous.meals as Prisma.InputJsonValue,
          notes: previous.notes ? `Reused from previous plan. ${previous.notes}` : "Reused from previous plan.",
          skippedMealTypes: { set: [] },
          completedMealTypes: { set: [] },
          source: "reuse",
        },
        select: dailyPlanSelect(),
      });
    }),

  generatePlan: protectedProcedure
    .input(timezoneOffsetInput.extend({ force: z.boolean().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const startOfDay = startOfUserDay(new Date(), input?.timezoneOffsetMinutes);
      if (!input?.force) {
        const existing = await ctx.prisma.mealPlan.findUnique({
          where: { userId_date: { userId: ctx.user.id, date: startOfDay } },
          select: dailyPlanSelect(),
        });
        if (existing) return existing;
      }

      const [user, workoutCount] = await Promise.all([
        ctx.prisma.user.findUniqueOrThrow({
          where: { id: ctx.user.id },
          select: {
            nutritionAge: true,
            nutritionSex: true,
            heightCm: true,
            weightKg: true,
            nutritionGoal: true,
            activityLevel: true,
            dietPreference: true,
            cookingAccess: true,
            foodAvailability: true,
            foodAvoidances: true,
          },
        }),
        recentWorkoutCount(ctx),
      ]);
      const profile = toNutritionProfile(user, workoutCount);
      const targets = calculateNutritionTargets(profile);
      const generated = await generateNovaMealPlan(profile, targets);

      return ctx.prisma.mealPlan.upsert({
        where: { userId_date: { userId: ctx.user.id, date: startOfDay } },
        create: {
          userId: ctx.user.id,
          date: startOfDay,
          targetCalories: targets.calories,
          targetProtein: targets.protein,
          targetCarbs: targets.carbs,
          targetFat: targets.fat,
          availableFoods: { set: profile.availableFoods },
          meals: generated.payload.meals as unknown as Prisma.InputJsonValue,
          notes: generated.payload.notes,
          source: generated.source,
        },
        update: {
          targetCalories: targets.calories,
          targetProtein: targets.protein,
          targetCarbs: targets.carbs,
          targetFat: targets.fat,
          availableFoods: { set: profile.availableFoods },
          meals: generated.payload.meals as unknown as Prisma.InputJsonValue,
          notes: generated.payload.notes,
          skippedMealTypes: { set: [] },
          completedMealTypes: { set: [] },
          source: generated.source,
        },
        select: dailyPlanSelect(),
      });
    }),

  skipPlanMeal: protectedProcedure
    .input(z.object({ planId: z.string(), mealType: MealTypeSchema, hunger: z.enum(["NO", "LITTLE", "YES"]).optional() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.prisma.mealPlan.findFirst({
        where: { id: input.planId, userId: ctx.user.id },
        select: { skippedMealTypes: true, completedMealTypes: true },
      });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Meal plan not found" });
      const skipped = new Set(plan.skippedMealTypes);
      skipped.add(input.mealType);
      const completed = plan.completedMealTypes.filter((mealType) => mealType !== input.mealType);
      return ctx.prisma.mealPlan.update({
        where: { id: input.planId },
        data: {
          skippedMealTypes: { set: [...skipped] },
          completedMealTypes: { set: completed },
        },
        select: dailyPlanSelect(),
      });
    }),

  swapPlanMeal: protectedProcedure
    .input(z.object({ planId: z.string(), mealType: MealTypeSchema }))
    .mutation(async ({ ctx, input }) => {
      const [plan, user, workoutCount] = await Promise.all([
        ctx.prisma.mealPlan.findFirst({
          where: { id: input.planId, userId: ctx.user.id },
          select: dailyPlanSelect(),
        }),
        ctx.prisma.user.findUniqueOrThrow({
          where: { id: ctx.user.id },
          select: {
            nutritionAge: true,
            nutritionSex: true,
            heightCm: true,
            weightKg: true,
            nutritionGoal: true,
            activityLevel: true,
            dietPreference: true,
            cookingAccess: true,
            foodAvailability: true,
            foodAvoidances: true,
          },
        }),
        recentWorkoutCount(ctx),
      ]);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Meal plan not found" });
      const profile = toNutritionProfile(user, workoutCount);
      const targets = calculateNutritionTargets(profile);
      const current = parsePlanPayload(plan.meals, plan.notes);
      const generated = await generateNovaMealPlan(profile, targets, { swapMealType: input.mealType });
      const replacement = generated.payload.meals.find((meal) => meal.mealType === input.mealType);
      if (!replacement) throw new TRPCError({ code: "BAD_GATEWAY", message: "Could not generate a meal swap" });
      const meals = current.meals.map((meal) => (meal.mealType === input.mealType ? replacement : meal));

      return ctx.prisma.mealPlan.update({
        where: { id: plan.id },
        data: {
          meals: meals as unknown as Prisma.InputJsonValue,
          notes: generated.payload.notes,
          skippedMealTypes: { set: plan.skippedMealTypes.filter((mealType) => mealType !== input.mealType) },
          completedMealTypes: { set: plan.completedMealTypes.filter((mealType) => mealType !== input.mealType) },
          source: generated.source,
        },
        select: dailyPlanSelect(),
      });
    }),

  markPlanMealAte: protectedProcedure
    .input(z.object({ planId: z.string(), mealType: MealTypeSchema }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.prisma.mealPlan.findFirst({
        where: { id: input.planId, userId: ctx.user.id },
        select: dailyPlanSelect(),
      });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Meal plan not found" });

      const payload = parsePlanPayload(plan.meals, plan.notes);
      const plannedMeal = payload.meals.find((meal) => meal.mealType === input.mealType);
      if (!plannedMeal) throw new TRPCError({ code: "NOT_FOUND", message: "Planned meal not found" });

      const completed = new Set(plan.completedMealTypes);
      if (completed.has(input.mealType)) return plan;

      return ctx.prisma.$transaction(async (tx) => {
        const foods = await Promise.all(
          plannedMeal.items.map((item) =>
            tx.food.create({
              data: {
                name: plannedFoodName(plan.id, input.mealType, item.name, item.amount),
                brand: item.amount.trim().slice(0, 120) || null,
                calories: item.calories,
                protein: item.protein,
                carbs: item.carbs,
                fat: item.fat,
                servingSize: 1,
                servingUnit: item.amount.trim().slice(0, 24) || "serving",
                isCustom: true,
                userId: ctx.user.id,
              },
            }),
          ),
        );

        await tx.mealLog.create({
          data: {
            userId: ctx.user.id,
            mealType: input.mealType,
            name: plannedMeal.title,
            notes: `From AI plan ${plan.id}`,
            items: {
              create: foods.map((food) => ({ foodId: food.id, quantity: 1, unit: "serving" })),
            },
          },
        });

        completed.add(input.mealType);
        return tx.mealPlan.update({
          where: { id: input.planId },
          data: {
            completedMealTypes: { set: [...completed] },
            skippedMealTypes: { set: plan.skippedMealTypes.filter((mealType) => mealType !== input.mealType) },
          },
          select: dailyPlanSelect(),
        });
      });
    }),

  dailySummary: protectedProcedure
    .input(timezoneOffsetInput.optional())
    .query(async ({ ctx, input }) => {
      const startOfDay = startOfUserDay(new Date(), input?.timezoneOffsetMinutes);
      const endOfDay = new Date(startOfDay.getTime() + DAY_MS);

      const [summaryRows, user] = await Promise.all([
        ctx.prisma.$queryRaw<
          Array<{ calories: number | null; protein: number | null; carbs: number | null; fat: number | null; mealCount: bigint }>
        >(Prisma.sql`
          SELECT
            COALESCE(SUM(f.calories * (mi.quantity / COALESCE(NULLIF(f."servingSize", 0), 100))), 0) as calories,
            COALESCE(SUM(f.protein * (mi.quantity / COALESCE(NULLIF(f."servingSize", 0), 100))), 0) as protein,
            COALESCE(SUM(f.carbs * (mi.quantity / COALESCE(NULLIF(f."servingSize", 0), 100))), 0) as carbs,
            COALESCE(SUM(f.fat * (mi.quantity / COALESCE(NULLIF(f."servingSize", 0), 100))), 0) as fat,
            COUNT(DISTINCT ml.id)::bigint as "mealCount"
          FROM "MealLog" ml
          LEFT JOIN "MealItem" mi ON mi."mealId" = ml.id
          LEFT JOIN "Food" f ON f.id = mi."foodId"
          WHERE ml."userId" = ${ctx.user.id}
            AND ml.date >= ${startOfDay}
            AND ml.date < ${endOfDay}
        `),
        ctx.prisma.user.findUnique({
          where: { id: ctx.user.id },
          select: { calorieGoal: true, proteinGoal: true, carbGoal: true, fatGoal: true },
        }),
      ]);

      const summary = summaryRows[0];

      return {
        calories: Math.round(Number(summary?.calories ?? 0)),
        protein: Math.round(Number(summary?.protein ?? 0)),
        carbs: Math.round(Number(summary?.carbs ?? 0)),
        fat: Math.round(Number(summary?.fat ?? 0)),
        mealCount: Number(summary?.mealCount ?? 0),
        targets: resolveTargets(
          user ?? { calorieGoal: null, proteinGoal: null, carbGoal: null, fatGoal: null },
        ),
      };
    }),

  searchFoodsLocal: protectedProcedure.input(searchFoodsInput).query(async ({ ctx, input }) => {
    return queryLocalFoods(ctx, input.query.trim());
  }),

  searchFoodsUsda: protectedProcedure.input(searchFoodsUsdaInput).query(async ({ input }) => {
    const query = input.query.trim();
    const apiKey = getApiKey();

    if (!apiKey) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "USDA_API_KEY is missing on the server. Add it to .env and restart the API.",
      });
    }

    const excludeNames = new Set((input.excludeNames ?? []).map((name) => name.toLowerCase()));
    try {
      return await queryUsdaFoods(query, apiKey, { excludeNames, limit: 20 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "USDA search failed";
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: `Could not reach USDA API. ${msg}`,
      });
    }
  }),

  searchFoods: protectedProcedure.input(searchFoodsInput).query(async ({ ctx, input }) => {
    return searchFoodsMerged(ctx, input.query.trim());
  }),

  logMeal: protectedProcedure
    .input(
      z.object({
        mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
        items: z.array(
          z.object({
            foodId: z.string().optional(),
            fdcId: z.number().optional(),
            name: z.string(),
            calories: z.number(),
            protein: z.number(),
            carbs: z.number(),
            fat: z.number(),
            quantity: z.number().default(100),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const meal = await ctx.prisma.mealLog.create({
        data: {
          userId: ctx.user.id,
          mealType: input.mealType,
          items: {
            create: await Promise.all(
              input.items.map(async (item) => {
                let food = item.foodId
                  ? await ctx.prisma.food.findFirst({
                      where: {
                        id: item.foodId,
                        OR: [{ isCustom: false }, { isCustom: true, userId: ctx.user.id }],
                      },
                    })
                  : null;

                if (!food && item.fdcId && item.fdcId > 0) {
                  food = await ctx.prisma.food.upsert({
                    where: { usdaFdcId: item.fdcId },
                    create: {
                      usdaFdcId: item.fdcId,
                      name: item.name,
                      calories: item.calories,
                      protein: item.protein,
                      carbs: item.carbs,
                      fat: item.fat,
                      isCustom: false,
                      userId: null,
                    },
                    update: {},
                  });
                }

                if (!food) {
                  food = await ctx.prisma.food.create({
                    data: {
                      usdaFdcId: null,
                      name: item.name,
                      calories: item.calories,
                      protein: item.protein,
                      carbs: item.carbs,
                      fat: item.fat,
                      isCustom: true,
                      userId: ctx.user.id,
                    },
                  });
                }

                return { foodId: food.id, quantity: item.quantity };
              }),
            ),
          },
        },
        include: { items: { include: { food: true } } },
      });

      return meal;
    }),

  todayMeals: protectedProcedure
    .input(timezoneOffsetInput.optional())
    .query(async ({ ctx, input }) => {
      const startOfDay = startOfUserDay(new Date(), input?.timezoneOffsetMinutes);
      const endOfDay = new Date(startOfDay.getTime() + DAY_MS);

      return ctx.prisma.mealLog.findMany({
        where: { userId: ctx.user.id, date: { gte: startOfDay, lt: endOfDay } },
        include: { items: { include: { food: true } } },
        orderBy: { createdAt: "asc" },
      });
    }),

  deleteMealItem: protectedProcedure
    .input(z.object({ mealItemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.mealItem.findFirst({
        where: { id: input.mealItemId, meal: { userId: ctx.user.id } },
        select: { id: true, mealId: true, meal: { select: { _count: { select: { items: true } } } } },
      });
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meal item not found" });
      }

      if (item.meal._count.items <= 1) {
        await ctx.prisma.mealLog.delete({ where: { id: item.mealId } });
      } else {
        await ctx.prisma.mealItem.delete({ where: { id: input.mealItemId } });
      }
      return { success: true };
    }),

  deleteMeal: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const meal = await ctx.prisma.mealLog.findFirst({
        where: { id: input.id, userId: ctx.user.id },
      });
      if (!meal) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meal not found" });
      }
      await ctx.prisma.mealLog.delete({ where: { id: input.id } });
      return { success: true };
    }),

  updateMeal: protectedProcedure
    .input(
      z.object({
        mealItemId: z.string(),
        quantity: z.number().positive().max(10000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.mealItem.findFirst({
        where: {
          id: input.mealItemId,
          meal: { userId: ctx.user.id },
        },
      });
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meal item not found" });
      }
      return ctx.prisma.mealItem.update({
        where: { id: input.mealItemId },
        data: { quantity: input.quantity },
        include: { food: true },
      });
    }),
});
