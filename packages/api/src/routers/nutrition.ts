import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";

type UsdaFood = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  foodNutrients: Array<{
    nutrientId: number;
    nutrientName: string;
    value: number;
    unitName: string;
  }>;
};

function extractNutrients(food: UsdaFood) {
  const find = (id: number) =>
    food.foodNutrients.find((n) => n.nutrientId === id)?.value ?? 0;

  return {
    calories: find(1008),
    protein: find(1003),
    carbs: find(1005),
    fat: find(1004),
    fiber: find(1079),
  };
}

const DEFAULT_TARGETS = {
  calories: 2500,
  protein: 180,
  carbs: 250,
  fat: 80,
};

type FoodSearchResult = {
  fdcId: number;
  name: string;
  brand: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: "local" | "usda";
};

function toSearchResult(
  f: {
    usdaFdcId: number | null;
    name: string;
    brand: string | null;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  },
): FoodSearchResult {
  return {
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

export const nutritionRouter = router({
  dailySummary: protectedProcedure.query(async ({ ctx }) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const meals = await ctx.prisma.mealLog.findMany({
      where: { userId: ctx.user.id, date: { gte: startOfDay } },
      include: { items: { include: { food: true } } },
    });

    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;

    for (const meal of meals) {
      for (const item of meal.items) {
        const ratio = item.quantity / (item.food.servingSize ?? 100);
        calories += item.food.calories * ratio;
        protein += item.food.protein * ratio;
        carbs += item.food.carbs * ratio;
        fat += item.food.fat * ratio;
      }
    }

    return {
      calories: Math.round(calories),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
      mealCount: meals.length,
      targets: DEFAULT_TARGETS,
    };
  }),

  searchFoods: protectedProcedure
    .input(z.object({ query: z.string().min(2).max(100) }))
    .query(async ({ ctx, input }) => {
      const apiKey = process.env.USDA_API_KEY;

      const local = await ctx.prisma.food.findMany({
        where: {
          name: { contains: input.query, mode: "insensitive" },
          OR: [{ isCustom: false }, { isCustom: true, userId: ctx.user.id }],
        },
        take: 10,
      });

      if (local.length >= 5) {
        return local.map(toSearchResult);
      }

      if (!apiKey) {
        return local.map(toSearchResult);
      }

      const url = `${USDA_BASE}/foods/search?api_key=${apiKey}&query=${encodeURIComponent(input.query)}&pageSize=15&dataType=Foundation,SR%20Legacy`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "USDA API unavailable. Add USDA_API_KEY to .env",
        });
      }

      const data = (await response.json()) as { foods: UsdaFood[] };

      return (data.foods ?? []).slice(0, 15).map((food) => {
        const nutrients = extractNutrients(food);
        return {
          fdcId: food.fdcId,
          name: food.description,
          brand: food.brandOwner ?? null,
          calories: nutrients.calories,
          protein: nutrients.protein,
          carbs: nutrients.carbs,
          fat: nutrients.fat,
          source: "usda" as const,
        };
      });
    }),

  logMeal: protectedProcedure
    .input(
      z.object({
        mealType: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]),
        items: z.array(
          z.object({
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
                let food = item.fdcId
                  ? await ctx.prisma.food.findUnique({ where: { usdaFdcId: item.fdcId } })
                  : null;

                if (!food) {
                  food = await ctx.prisma.food.create({
                    data: {
                      usdaFdcId: item.fdcId,
                      name: item.name,
                      calories: item.calories,
                      protein: item.protein,
                      carbs: item.carbs,
                      fat: item.fat,
                    },
                  });
                }

                return {
                  foodId: food.id,
                  quantity: item.quantity,
                };
              }),
            ),
          },
        },
        include: { items: { include: { food: true } } },
      });

      return meal;
    }),
});
