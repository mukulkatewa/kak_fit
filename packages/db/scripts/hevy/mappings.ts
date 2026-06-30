import type { HevyEquipmentCategory, HevyExerciseType, HevyMuscleGroup } from "./types";

/** Convert hevy enum slug to display name: upper_back → Upper Back */
export function hevySlugToName(slug: string): string {
  return slug
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const HEVY_MUSCLE_GROUPS: HevyMuscleGroup[] = [
  "abdominals",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "quadriceps",
  "hamstrings",
  "calves",
  "glutes",
  "abductors",
  "adductors",
  "lats",
  "upper_back",
  "traps",
  "lower_back",
  "chest",
  "cardio",
  "neck",
  "full_body",
  "other",
];

export const HEVY_EQUIPMENT: HevyEquipmentCategory[] = [
  "none",
  "barbell",
  "dumbbell",
  "kettlebell",
  "machine",
  "plate",
  "resistance_band",
  "suspension",
  "other",
];

/** Live API types (OpenAPI enum is outdated — e.g. bodyweight_assisted vs bodyweight_assisted_reps). */
export const HEVY_EXERCISE_TYPES: HevyExerciseType[] = [
  "weight_reps",
  "reps_only",
  "bodyweight_reps",
  "bodyweight_assisted",
  "bodyweight_assisted_reps",
  "bodyweight_weighted",
  "duration",
  "weight_duration",
  "distance_duration",
  "short_distance_weight",
  "floors_duration",
  "steps_duration",
];

export function hevyCategoryName(typeSlug: string): string {
  return `Hevy: ${hevySlugToName(typeSlug)}`;
}

export const HEVY_TO_PRISMA_MAP: { hevy: string; prisma: string; notes?: string }[] = [
  { hevy: "exercise_templates.id", prisma: "Exercise.hevyId" },
  { hevy: "exercise_templates.title", prisma: "Exercise.name" },
  { hevy: "exercise_templates.type", prisma: "Category.name", notes: "via exercise type slug" },
  { hevy: "exercise_templates.primary_muscle_group", prisma: "ExerciseMuscle", notes: "isPrimary: true" },
  { hevy: "exercise_templates.secondary_muscle_groups", prisma: "ExerciseMuscle", notes: "isPrimary: false" },
  { hevy: "exercise_templates.equipment", prisma: "ExerciseEquipment" },
  { hevy: "exercise_templates.is_custom", prisma: "(skip)", notes: "skip true for global catalog" },
  { hevy: "(not in API)", prisma: "Exercise.instructions", notes: "use Wger import" },
  { hevy: "(not in API)", prisma: "Exercise.imageUrl", notes: "use Wger import" },
  { hevy: "(not in API)", prisma: "Exercise.videoUrl", notes: "not available" },
];
