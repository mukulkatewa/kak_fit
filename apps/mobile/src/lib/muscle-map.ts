export type BodyView = "front" | "back";

export type MuscleZone = {
  id: string;
  label: string;
  view: BodyView;
  top: number;
  left: number;
  width: number;
  height: number;
};

/** Normalized positions (%) on front/back body silhouettes */
export const MUSCLE_ZONES: MuscleZone[] = [
  { id: "chest", label: "Chest", view: "front", top: 22, left: 32, width: 36, height: 12 },
  { id: "shoulders", label: "Shoulders", view: "front", top: 16, left: 18, width: 64, height: 10 },
  { id: "biceps", label: "Biceps", view: "front", top: 28, left: 8, width: 18, height: 16 },
  { id: "biceps-r", label: "Biceps", view: "front", top: 28, left: 74, width: 18, height: 16 },
  { id: "abs", label: "Abs", view: "front", top: 36, left: 38, width: 24, height: 14 },
  { id: "obliques", label: "Obliquus externus abdominis", view: "front", top: 36, left: 28, width: 44, height: 14 },
  { id: "quads", label: "Quads", view: "front", top: 52, left: 28, width: 18, height: 22 },
  { id: "quads-r", label: "Quads", view: "front", top: 52, left: 54, width: 18, height: 22 },
  { id: "calves", label: "Calves", view: "front", top: 76, left: 30, width: 16, height: 14 },
  { id: "calves-r", label: "Calves", view: "front", top: 76, left: 54, width: 16, height: 14 },
  { id: "traps", label: "Trapezius", view: "back", top: 14, left: 36, width: 28, height: 10 },
  { id: "lats", label: "Lats", view: "back", top: 24, left: 14, width: 28, height: 18 },
  { id: "lats-r", label: "Lats", view: "back", top: 24, left: 58, width: 28, height: 18 },
  { id: "triceps", label: "Triceps", view: "back", top: 28, left: 6, width: 16, height: 16 },
  { id: "triceps-r", label: "Triceps", view: "back", top: 28, left: 78, width: 16, height: 16 },
  { id: "glutes", label: "Glutes", view: "back", top: 44, left: 32, width: 36, height: 14 },
  { id: "hamstrings", label: "Hamstrings", view: "back", top: 54, left: 28, width: 18, height: 20 },
  { id: "hamstrings-r", label: "Hamstrings", view: "back", top: 54, left: 54, width: 18, height: 20 },
  { id: "soleus", label: "Soleus", view: "back", top: 78, left: 30, width: 16, height: 12 },
  { id: "soleus-r", label: "Soleus", view: "back", top: 78, left: 54, width: 16, height: 12 },
];

const ALIASES: Record<string, string> = {
  Brachialis: "Biceps",
  "Serratus anterior": "Shoulders",
};

export function intensityForMuscle(
  muscleName: string,
  heatmap: Array<{ muscle: string; intensity: number }>,
): number {
  const normalized = ALIASES[muscleName] ?? muscleName;
  const direct = heatmap.find((h) => h.muscle === muscleName || h.muscle === normalized);
  if (direct) return direct.intensity;

  const related = heatmap.filter(
    (h) => h.muscle === normalized || ALIASES[h.muscle] === normalized,
  );
  if (related.length === 0) return 0;
  return Math.max(...related.map((r) => r.intensity));
}

export function zoneIntensity(
  zone: MuscleZone,
  heatmap: Array<{ muscle: string; intensity: number }>,
): number {
  return intensityForMuscle(zone.label, heatmap);
}
