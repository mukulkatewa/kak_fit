import type { MealTypeKey } from "./theme";
import type { VesselKind } from "../components/vessel-icon";

export type ReminderAmountMode = "fill" | "count" | "weight";

export type ReminderItemMeta = {
  mode: ReminderAmountMode;
  unit: string;
  step: number;
  fillMax: number;
  vessel: VesselKind;
  countSingular?: string;
  countPlural?: string;
  lineColor: string;
  fillTop: string;
  fillBottom: string;
  accent: string;
};

export type ReminderRowItem = {
  key: string;
  name: string;
  usual: number;
  amountLabel: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  foodId?: string;
  servingSize?: number | null;
  servingUnit?: string | null;
  meta: ReminderItemMeta;
};

const ITEM_PALETTES: Record<string, Omit<ReminderItemMeta, "mode" | "unit" | "step" | "fillMax" | "vessel" | "countSingular" | "countPlural">> = {
  water: { lineColor: "#7fb8db", fillTop: "#7dd0ff", fillBottom: "#0a84ff", accent: "#4cb8f5" },
  milk: { lineColor: "#c2a878", fillTop: "#fbf4e3", fillBottom: "#e6cf9f", accent: "#c0a05e" },
  coffee: { lineColor: "#7a4f30", fillTop: "#b07d52", fillBottom: "#5a3413", accent: "#a9754a" },
  rice: { lineColor: "#9aa6b4", fillTop: "#ffffff", fillBottom: "#dfe4ea", accent: "#8a97a8" },
  chapati: { lineColor: "#b3843e", fillTop: "#f3d18f", fillBottom: "#c88a37", accent: "#d59a45" },
  roti: { lineColor: "#b3843e", fillTop: "#f3d18f", fillBottom: "#c88a37", accent: "#d59a45" },
  egg: { lineColor: "#cdac5f", fillTop: "#ffe9a8", fillBottom: "#f0c451", accent: "#e0ac33" },
  eggs: { lineColor: "#cdac5f", fillTop: "#ffe9a8", fillBottom: "#f0c451", accent: "#e0ac33" },
  apple: { lineColor: "#b83036", fillTop: "#ff7d7d", fillBottom: "#cf1f28", accent: "#ef5a5a" },
  banana: { lineColor: "#b8a030", fillTop: "#ffe566", fillBottom: "#e6c200", accent: "#e0ac33" },
  default: { lineColor: "#9aa6b4", fillTop: "#ffffff", fillBottom: "#dfe4ea", accent: "#8a97a8" },
};

function paletteFor(name: string) {
  const key = name.toLowerCase().trim();
  for (const [token, colors] of Object.entries(ITEM_PALETTES)) {
    if (token !== "default" && key.includes(token)) return colors;
  }
  return ITEM_PALETTES.default;
}

function inferMeta(name: string, amountLabel: string): ReminderItemMeta {
  const lower = name.toLowerCase();
  const colors = paletteFor(name);

  if (/\b(roti|chapati|paratha|naan)\b/.test(lower)) {
    return {
      ...colors,
      mode: "count",
      unit: "roti",
      step: 1,
      fillMax: 5,
      vessel: "chapati",
      countSingular: "roti",
      countPlural: "rotis",
    };
  }
  if (/\b(egg|eggs|anda)\b/.test(lower)) {
    return {
      ...colors,
      mode: "count",
      unit: "egg",
      step: 1,
      fillMax: 4,
      vessel: "egg",
      countSingular: "egg",
      countPlural: "eggs",
    };
  }
  if (/\b(apple|banana|fruit)\b/.test(lower)) {
    return {
      ...colors,
      mode: "count",
      unit: "piece",
      step: 1,
      fillMax: 3,
      vessel: "apple",
      countSingular: lower.includes("banana") ? "banana" : "apple",
      countPlural: lower.includes("banana") ? "bananas" : "apples",
    };
  }
  if (/\b(rice|dal|curd|paneer|chicken|sabzi|potato|chana)\b/.test(lower)) {
    return {
      ...colors,
      mode: "weight",
      unit: "g",
      step: 25,
      fillMax: 400,
      vessel: "bowl",
    };
  }
  if (/\b(coffee|tea|chai)\b/.test(lower)) {
    return {
      ...colors,
      mode: "fill",
      unit: "mL",
      step: 30,
      fillMax: 300,
      vessel: "mug",
    };
  }
  if (/\b(water|milk|juice|lassi|drink)\b/.test(lower) || /ml|mL|l\b/i.test(amountLabel)) {
    return {
      ...colors,
      mode: "fill",
      unit: "mL",
      step: lower.includes("water") ? 50 : 25,
      fillMax: lower.includes("water") ? 500 : 400,
      vessel: "glass",
    };
  }

  const parsed = parseAmountLabel(amountLabel);
  if (parsed.unit === "g") {
    return { ...colors, mode: "weight", unit: "g", step: 25, fillMax: 400, vessel: "bowl" };
  }
  if (parsed.unit === "mL") {
    return { ...colors, mode: "fill", unit: "mL", step: 25, fillMax: 400, vessel: "glass" };
  }

  return { ...colors, mode: "count", unit: "serving", step: 1, fillMax: 3, vessel: "bowl", countSingular: "serving", countPlural: "servings" };
}

export function parseAmountLabel(label: string): { value: number; unit: string } {
  const trimmed = label.trim();
  const ml = trimmed.match(/^(\d+(?:\.\d+)?)\s*mL$/i);
  if (ml) return { value: Number(ml[1]), unit: "mL" };
  const grams = trimmed.match(/^(\d+(?:\.\d+)?)\s*g$/i);
  if (grams) return { value: Number(grams[1]), unit: "g" };
  const count = trimmed.match(/^(\d+(?:\.\d+)?)\s+([a-z]+)$/i);
  if (count) return { value: Number(count[1]), unit: count[2] };
  const num = trimmed.match(/^(\d+(?:\.\d+)?)/);
  if (num) return { value: Number(num[1]), unit: "serving" };
  return { value: 1, unit: "serving" };
}

export function formatAmountLabel(meta: ReminderItemMeta, amount: number) {
  if (meta.mode === "count") {
    const word = amount === 1 ? meta.countSingular ?? meta.unit : meta.countPlural ?? `${meta.unit}s`;
    return `${amount} ${word}`;
  }
  return `${amount} ${meta.unit}`;
}

export function usualHint(meta: ReminderItemMeta, usual: number) {
  if (meta.mode === "count") {
    const word = usual === 1 ? meta.countSingular ?? meta.unit : meta.countPlural ?? `${meta.unit}s`;
    return `usually ${usual} ${word}`;
  }
  return `usually ${usual} ${meta.unit}`;
}

type UsualItemInput = {
  key: string;
  name: string;
  amountLabel: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  foodId?: string;
  servingSize?: number | null;
  servingUnit?: string | null;
  quantity?: number;
};

export function toReminderRows(items: UsualItemInput[]): ReminderRowItem[] {
  return items.map((item) => {
    const meta = inferMeta(item.name, item.amountLabel);
    const parsed = parseAmountLabel(item.amountLabel);
    const usual = item.quantity ?? parsed.value;
    return {
      key: item.key,
      name: item.name,
      usual,
      amountLabel: item.amountLabel,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      foodId: item.foodId,
      servingSize: item.servingSize,
      servingUnit: item.servingUnit,
      meta,
    };
  });
}

const DEFAULT_BY_MEAL: Record<MealTypeKey, UsualItemInput[]> = {
  BREAKFAST: [
    { key: "milk", name: "Milk", amountLabel: "200 mL", calories: 120, protein: 6, carbs: 10, fat: 6 },
    { key: "chapati", name: "Chapati", amountLabel: "2 roti", calories: 180, protein: 5, carbs: 32, fat: 4 },
    { key: "egg", name: "Egg", amountLabel: "2 eggs", calories: 140, protein: 12, carbs: 1, fat: 10 },
    { key: "water", name: "Water", amountLabel: "250 mL", calories: 0, protein: 0, carbs: 0, fat: 0 },
  ],
  LUNCH: [
    { key: "rice", name: "Rice", amountLabel: "150 g", calories: 195, protein: 4, carbs: 42, fat: 1 },
    { key: "chapati", name: "Chapati", amountLabel: "2 roti", calories: 180, protein: 5, carbs: 32, fat: 4 },
    { key: "water", name: "Water", amountLabel: "250 mL", calories: 0, protein: 0, carbs: 0, fat: 0 },
  ],
  DINNER: [
    { key: "rice", name: "Rice", amountLabel: "150 g", calories: 195, protein: 4, carbs: 42, fat: 1 },
    { key: "milk", name: "Milk", amountLabel: "200 mL", calories: 120, protein: 6, carbs: 10, fat: 6 },
    { key: "water", name: "Water", amountLabel: "250 mL", calories: 0, protein: 0, carbs: 0, fat: 0 },
  ],
  SNACK: [
    { key: "banana", name: "Banana", amountLabel: "1 banana", calories: 105, protein: 1, carbs: 27, fat: 0 },
    { key: "milk", name: "Milk", amountLabel: "200 mL", calories: 120, protein: 6, carbs: 10, fat: 6 },
  ],
};

export function defaultReminderRows(mealType: MealTypeKey): ReminderRowItem[] {
  return toReminderRows(DEFAULT_BY_MEAL[mealType]);
}

export function mealWindowLabel(mealType: MealTypeKey, time?: string) {
  if (time) {
    const [h, m] = time.split(":").map(Number);
    const start = formatClock(h, m);
    const endH = h + (mealType === "BREAKFAST" ? 2 : mealType === "LUNCH" ? 2 : 1);
    const endM = m + (mealType === "BREAKFAST" ? 30 : mealType === "LUNCH" ? 30 : 30);
    const end = formatClock(endH + Math.floor(endM / 60), endM % 60);
    return `${start}–${end}`;
  }
  switch (mealType) {
    case "BREAKFAST":
      return "7:00–9:30 AM";
    case "LUNCH":
      return "12:30–2:00 PM";
    case "DINNER":
      return "8:00–9:30 PM";
    case "SNACK":
      return "4:00–6:00 PM";
  }
}

function formatClock(hours: number, minutes: number) {
  const h = ((hours % 24) + 24) % 24;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function mealTitle(mealType: MealTypeKey) {
  switch (mealType) {
    case "BREAKFAST":
      return "Breakfast";
    case "LUNCH":
      return "Lunch";
    case "DINNER":
      return "Dinner";
    case "SNACK":
      return "Snack";
  }
}

export function scaledLogItem(row: ReminderRowItem, amount: number) {
  if (row.foodId) {
    return {
      foodId: row.foodId,
      name: row.name,
      calories: row.calories,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
      quantity: amount,
    };
  }
  const scale = row.usual > 0 ? amount / row.usual : 1;
  return {
    name: row.name,
    calories: Math.round(row.calories * scale),
    protein: Math.round(row.protein * scale),
    carbs: Math.round(row.carbs * scale),
    fat: Math.round(row.fat * scale),
    quantity: 100,
  };
}
