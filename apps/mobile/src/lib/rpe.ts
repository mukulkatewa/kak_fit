const RPE_VALUES = [6, 7, 8, 9, 10] as const;

export function formatRpe(rpe: number | null | undefined) {
  if (rpe == null) return "—";
  return Number.isInteger(rpe) ? String(rpe) : rpe.toFixed(1);
}

/** Tap-to-cycle: off → 6 → … → 10 → off */
export function cycleRpe(current: number | null | undefined): number | null {
  if (current == null) return RPE_VALUES[0];
  const idx = RPE_VALUES.findIndex((v) => v === current);
  if (idx < 0 || idx === RPE_VALUES.length - 1) return null;
  return RPE_VALUES[idx + 1];
}
