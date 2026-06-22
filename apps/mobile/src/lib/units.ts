export type WeightUnit = "KG" | "LBS";

const KG_TO_LBS = 2.2046226218;

export function weightLabel(unit: WeightUnit) {
  return unit === "LBS" ? "lbs" : "kg";
}

/** Display stored kg in the user's preferred unit. */
export function fromKg(kg: number, unit: WeightUnit) {
  return unit === "LBS" ? kg * KG_TO_LBS : kg;
}

/** Convert user input to kg for storage. */
export function toKg(value: number, unit: WeightUnit) {
  return unit === "LBS" ? value / KG_TO_LBS : value;
}

export function formatWeight(kg: number | null | undefined, unit: WeightUnit, digits = 1) {
  if (kg == null) return "—";
  const v = fromKg(kg, unit);
  const rounded = Math.round(v * 10 ** digits) / 10 ** digits;
  return String(rounded);
}
