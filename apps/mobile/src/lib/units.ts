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

/** Volume for one set: display-unit weight × reps (weights stored in kg). */
export function setVolume(
  weightKg: number | null | undefined,
  reps: number | null | undefined,
  unit: WeightUnit,
) {
  return fromKg(weightKg ?? 0, unit) * (reps ?? 0);
}

/** Sum set volumes across exercises (optionally completed sets only). */
export function sumWorkoutSetVolume(
  exercises: Array<{
    sets: Array<{ weight: number | null; reps: number | null; isCompleted?: boolean }>;
  }>,
  unit: WeightUnit,
  options?: { completedOnly?: boolean },
) {
  const completedOnly = options?.completedOnly ?? true;
  return exercises
    .flatMap((exercise) => exercise.sets)
    .reduce((sum, set) => {
      if (completedOnly && !set.isCompleted) return sum;
      return sum + setVolume(set.weight, set.reps, unit);
    }, 0);
}

/** Server/API tonnage totals are summed in kg — scale for display unit. */
export function tonnageFromKg(kgTonnage: number, unit: WeightUnit) {
  return fromKg(kgTonnage, unit);
}
