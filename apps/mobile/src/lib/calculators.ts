/** Standard gym plates (kg), largest first. */
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

export type PlateResult = {
  perSide: number[];
  totalWeight: number;
  barWeight: number;
};

/** Barbell plate math — weight loaded per side. */
export function calculatePlates(
  targetTotalKg: number,
  barKg = 20,
  plates = DEFAULT_PLATES_KG,
): PlateResult | null {
  if (targetTotalKg < barKg) return null;
  const perSide = (targetTotalKg - barKg) / 2;
  if (perSide < 0) return null;

  let remaining = perSide;
  const chosen: number[] = [];
  for (const plate of plates) {
    while (remaining >= plate - 0.001) {
      chosen.push(plate);
      remaining = Math.round((remaining - plate) * 1000) / 1000;
    }
  }

  const loaded = barKg + chosen.reduce((s, p) => s + p * 2, 0);
  return { perSide: chosen, totalWeight: loaded, barWeight: barKg };
}

export type WarmupSet = { label: string; weight: number; reps: number };

/** Generate ramp-up sets toward a working weight. */
export function generateWarmupSets(workingKg: number, barKg = 20): WarmupSet[] {
  if (workingKg <= 0) return [];
  const sets: WarmupSet[] = [];
  const add = (pct: number, reps: number, label: string) => {
    const w = Math.max(barKg, Math.round((workingKg * pct) / 2.5) * 2.5);
    if (w >= workingKg) return;
    sets.push({ label, weight: w, reps });
  };
  add(0.4, 8, "Light");
  add(0.6, 5, "Medium");
  add(0.8, 3, "Heavy");
  if (workingKg > barKg + 20) {
    sets.push({ label: "Working", weight: workingKg, reps: 0 });
  }
  return sets;
}
