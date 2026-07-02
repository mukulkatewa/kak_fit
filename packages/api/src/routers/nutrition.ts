import { Prisma } from "@kak-fit/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { fetchExternal } from "../fetch-external";
import { startOfUserDay } from "../lib/timezone";
import { protectedProcedure, router } from "../trpc";

const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";

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

  dailySummary: protectedProcedure
    .input(timezoneOffsetInput.optional())
    .query(async ({ ctx, input }) => {
      const startOfDay = startOfUserDay(new Date(), input?.timezoneOffsetMinutes);

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

      return ctx.prisma.mealLog.findMany({
        where: { userId: ctx.user.id, date: { gte: startOfDay } },
        include: { items: { include: { food: true } } },
        orderBy: { createdAt: "asc" },
      });
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
