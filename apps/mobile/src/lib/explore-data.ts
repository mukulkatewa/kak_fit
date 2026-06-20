export type ProgramLevel = "Beginner" | "Intermediate" | "Advanced";
export type ProgramGoal = "Muscle" | "Strength" | "Endurance" | "Weight Loss";
export type ProgramEquipment = "Gym" | "Dumbbells" | "Bodyweight" | "Bands" | "Home";

export type ProgramRoutineTemplate = {
  name: string;
  exerciseNames: string[];
};

export type ExploreProgram = {
  id: string;
  badge: string;
  badgeColor: string;
  title: string;
  level: ProgramLevel;
  goal: ProgramGoal;
  equipment: ProgramEquipment;
  routines: ProgramRoutineTemplate[];
};

export type RoutineCategory = {
  id: string;
  label: string;
  icon: string;
  description: string;
  templates: Array<{ name: string; exerciseNames: string[] }>;
};

export const EXPLORE_PROGRAMS: ExploreProgram[] = [
  {
    id: "ppl-beginner-gym",
    badge: "PUSH PULL LEGS",
    badgeColor: "#b8d4f0",
    title: "Beginner Push/Pull/Legs (Gym Equipment)",
    level: "Beginner",
    goal: "Muscle",
    equipment: "Gym",
    routines: [
      {
        name: "Push A",
        exerciseNames: ["Bench Press", "Overhead Press", "Triceps Pushdown", "Lateral Raise"],
      },
      {
        name: "Pull A",
        exerciseNames: ["Lat Pulldown", "Seated Cable Row", "Face Pull", "Biceps Curl"],
      },
      {
        name: "Legs A",
        exerciseNames: ["Squat", "Leg Press", "Leg Curl", "Calf Raise"],
      },
    ],
  },
  {
    id: "ppl-intermediate-gym",
    badge: "PUSH PULL LEGS",
    badgeColor: "#b8d4f0",
    title: "Intermediate Push/Pull/Legs (Gym Equipment)",
    level: "Intermediate",
    goal: "Muscle",
    equipment: "Gym",
    routines: [
      { name: "Push", exerciseNames: ["Bench Press", "Incline Dumbbell Press", "Overhead Press", "Cable Fly"] },
      { name: "Pull", exerciseNames: ["Pull-Up", "Barbell Row", "Lat Pulldown", "Hammer Curl"] },
      { name: "Legs", exerciseNames: ["Squat", "Romanian Deadlift", "Leg Extension", "Leg Curl"] },
    ],
  },
  {
    id: "full-body-beginner",
    badge: "FULL BODY",
    badgeColor: "#d4e8d4",
    title: "Beginner Full Body (Gym Equipment)",
    level: "Beginner",
    goal: "Muscle",
    equipment: "Gym",
    routines: [
      { name: "Full Body A", exerciseNames: ["Squat", "Bench Press", "Lat Pulldown", "Plank"] },
      { name: "Full Body B", exerciseNames: ["Deadlift", "Overhead Press", "Seated Row", "Leg Curl"] },
    ],
  },
  {
    id: "upper-lower-beginner",
    badge: "UPPER LOWER",
    badgeColor: "#f0e0c8",
    title: "Beginner Upper/Lower (Gym Equipment)",
    level: "Beginner",
    goal: "Strength",
    equipment: "Gym",
    routines: [
      { name: "Upper", exerciseNames: ["Bench Press", "Lat Pulldown", "Overhead Press", "Biceps Curl"] },
      { name: "Lower", exerciseNames: ["Squat", "Romanian Deadlift", "Leg Press", "Calf Raise"] },
    ],
  },
  {
    id: "dumbbell-only-beginner",
    badge: "DUMBBELLS",
    badgeColor: "#e8e0f0",
    title: "Beginner Dumbbell Only",
    level: "Beginner",
    goal: "Muscle",
    equipment: "Dumbbells",
    routines: [
      { name: "Upper", exerciseNames: ["Dumbbell Bench Press", "Dumbbell Row", "Dumbbell Shoulder Press"] },
      { name: "Lower", exerciseNames: ["Goblet Squat", "Dumbbell Romanian Deadlift", "Lunge"] },
    ],
  },
  {
    id: "bodyweight-beginner",
    badge: "BODYWEIGHT",
    badgeColor: "#f0d4d4",
    title: "Beginner Bodyweight",
    level: "Beginner",
    goal: "Endurance",
    equipment: "Bodyweight",
    routines: [
      { name: "Full Body", exerciseNames: ["Push-Up", "Pull-Up", "Squat", "Plank"] },
      { name: "Core & Cardio", exerciseNames: ["Burpee", "Mountain Climber", "Crunch", "Jumping Jack"] },
    ],
  },
  {
    id: "home-beginner",
    badge: "AT HOME",
    badgeColor: "#d4f0f0",
    title: "Beginner At Home",
    level: "Beginner",
    goal: "Weight Loss",
    equipment: "Home",
    routines: [
      { name: "Quick HIIT", exerciseNames: ["Burpee", "Jumping Jack", "Mountain Climber", "Plank"] },
      { name: "Strength", exerciseNames: ["Push-Up", "Squat", "Lunge", "Glute Bridge"] },
    ],
  },
  {
    id: "strength-5x5",
    badge: "STRENGTH",
    badgeColor: "#f0e8b8",
    title: "StrongLifts 5×5 Style",
    level: "Intermediate",
    goal: "Strength",
    equipment: "Gym",
    routines: [
      { name: "Workout A", exerciseNames: ["Squat", "Bench Press", "Barbell Row"] },
      { name: "Workout B", exerciseNames: ["Squat", "Overhead Press", "Deadlift"] },
    ],
  },
];

export const ROUTINE_CATEGORIES: RoutineCategory[] = [
  {
    id: "at-home",
    label: "At home",
    icon: "🏠",
    description: "No gym needed — train in your living room.",
    templates: [
      { name: "20-min HIIT", exerciseNames: ["Burpee", "Jumping Jack", "Mountain Climber"] },
      { name: "Bodyweight Strength", exerciseNames: ["Push-Up", "Squat", "Plank"] },
    ],
  },
  {
    id: "travel",
    label: "Travel",
    icon: "🧳",
    description: "Minimal equipment routines for hotels.",
    templates: [
      { name: "Hotel Dumbbells", exerciseNames: ["Dumbbell Curl", "Goblet Squat", "Dumbbell Row"] },
      { name: "Bodyweight Quick", exerciseNames: ["Push-Up", "Lunge", "Plank"] },
    ],
  },
  {
    id: "dumbbells",
    label: "Dumbbells Only",
    icon: "🏋️",
    description: "Full workouts with just dumbbells.",
    templates: [
      { name: "Upper Body", exerciseNames: ["Dumbbell Bench Press", "Dumbbell Row", "Lateral Raise"] },
      { name: "Lower Body", exerciseNames: ["Goblet Squat", "Romanian Deadlift", "Lunge"] },
    ],
  },
  {
    id: "band",
    label: "Band",
    icon: "🎗️",
    description: "Resistance band workouts.",
    templates: [
      { name: "Band Upper", exerciseNames: ["Face Pull", "Biceps Curl", "Triceps Extension"] },
      { name: "Band Lower", exerciseNames: ["Squat", "Glute Bridge", "Leg Curl"] },
    ],
  },
  {
    id: "cardio-hiit",
    label: "Cardio & HIIT",
    icon: "💧",
    description: "Conditioning and fat-burn sessions.",
    templates: [
      { name: "HIIT Circuit", exerciseNames: ["Burpee", "Jumping Jack", "Mountain Climber"] },
      { name: "Cardio Finisher", exerciseNames: ["Running", "Jump Rope", "Rowing"] },
    ],
  },
  {
    id: "gym",
    label: "Gym",
    icon: "🏢",
    description: "Classic gym barbell and machine routines.",
    templates: [
      { name: "Push Day", exerciseNames: ["Bench Press", "Overhead Press", "Triceps Pushdown"] },
      { name: "Pull Day", exerciseNames: ["Deadlift", "Lat Pulldown", "Barbell Row"] },
      { name: "Leg Day", exerciseNames: ["Squat", "Leg Press", "Leg Curl"] },
    ],
  },
  {
    id: "bodyweight",
    label: "Bodyweight",
    icon: "🎒",
    description: "Calisthenics and bodyweight strength.",
    templates: [
      { name: "Push Focus", exerciseNames: ["Push-Up", "Dips", "Pike Push-Up"] },
      { name: "Pull & Legs", exerciseNames: ["Pull-Up", "Squat", "Lunge"] },
    ],
  },
  {
    id: "suspension",
    label: "Suspension Band",
    icon: "🔗",
    description: "TRX and suspension trainer workouts.",
    templates: [
      { name: "TRX Full Body", exerciseNames: ["Row", "Push-Up", "Squat"] },
      { name: "TRX Core", exerciseNames: ["Plank", "Crunch", "Mountain Climber"] },
    ],
  },
];

export const FILTER_LEVELS: ProgramLevel[] = ["Beginner", "Intermediate", "Advanced"];
export const FILTER_GOALS: ProgramGoal[] = ["Muscle", "Strength", "Endurance", "Weight Loss"];
export const FILTER_EQUIPMENT: ProgramEquipment[] = ["Gym", "Dumbbells", "Bodyweight", "Bands", "Home"];

export function getProgram(id: string) {
  return EXPLORE_PROGRAMS.find((p) => p.id === id);
}

export function getCategory(id: string) {
  return ROUTINE_CATEGORIES.find((c) => c.id === id);
}
