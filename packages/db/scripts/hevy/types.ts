/**
 * Hevy Pro API types — derived from https://api.hevyapp.com/docs/ OpenAPI spec.
 * These are NOT part of the Kak Fit app; used only by one-off import scripts.
 */

export type HevyExerciseType =
  | "weight_reps"
  | "reps_only"
  | "bodyweight_reps"
  | "bodyweight_assisted"
  | "bodyweight_assisted_reps"
  | "bodyweight_weighted"
  | "duration"
  | "weight_duration"
  | "distance_duration"
  | "short_distance_weight"
  | "floors_duration"
  | "steps_duration";

export type HevyMuscleGroup =
  | "abdominals"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "quadriceps"
  | "hamstrings"
  | "calves"
  | "glutes"
  | "abductors"
  | "adductors"
  | "lats"
  | "upper_back"
  | "traps"
  | "lower_back"
  | "chest"
  | "cardio"
  | "neck"
  | "full_body"
  | "other";

export type HevyEquipmentCategory =
  | "none"
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "machine"
  | "plate"
  | "resistance_band"
  | "suspension"
  | "other";

/** Single exercise template from GET /v1/exercise_templates */
export interface HevyExerciseTemplate {
  id: string;
  title: string;
  type: HevyExerciseType;
  primary_muscle_group: HevyMuscleGroup;
  secondary_muscle_groups: HevyMuscleGroup[];
  equipment: HevyEquipmentCategory;
  is_custom: boolean;
}

export interface HevyPaginatedExerciseTemplates {
  page: number;
  page_count: number;
  exercise_templates: HevyExerciseTemplate[];
}

export interface HevyUserInfo {
  id: string;
  name: string;
  url: string;
}

export interface HevyUserInfoResponse {
  data: HevyUserInfo;
}

export interface HevyWorkoutCountResponse {
  workout_count: number;
}

/** Placeholders — Hevy public API does NOT expose dedicated endpoints for these. */
export type HevyMuscle = { slug: HevyMuscleGroup; name: string };
export type HevyEquipment = { slug: HevyEquipmentCategory; name: string };
export type HevyCategory = { slug: HevyExerciseType; name: string };

/** Not available via Hevy public API (no /images or /media endpoints). */
export interface HevyExerciseImage {
  readonly _note: "Hevy public API does not return exercise images";
}

export interface HevyExerciseVideo {
  readonly _note: "Hevy public API does not return exercise videos";
}

export interface HevyExerciseInstruction {
  readonly _note: "Hevy public API does not return exercise instructions";
}

export interface HevyClientConfig {
  baseUrl: string;
  timeoutMs: number;
  requestsPerMinute: number;
  maxRetries: number;
}

export interface HevySyncState {
  lastFullSyncAt: string | null;
  lastIncrementalSyncAt: string | null;
  exercisesCreated: number;
  exercisesUpdated: number;
  exercisesSkipped: number;
  errors: string[];
  apiRequests: number;
}

export interface HevyImportReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totalFetched: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  failures: { hevyId: string; title: string; error: string }[];
}
