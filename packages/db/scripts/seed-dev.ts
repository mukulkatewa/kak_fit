/**
 * Realistic development seed — a coach and three clients with real history.
 *
 * Why this exists: testing "coach reviews a client's last 6 weeks" used to mean
 * hand-logging twenty workouts through the UI. This builds the same state in
 * about two seconds, deterministically, so every feature is testable
 * immediately after `pnpm db:seed:dev`.
 *
 * Idempotent — re-running wipes and rebuilds only the seeded accounts
 * (@kakfit.dev addresses). Real accounts are never touched.
 *
 *   pnpm db:seed:dev
 */
import { PrismaClient, MealType, SetType } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_DOMAIN = "kakfit.dev";
const WEEKS_OF_HISTORY = 6;
const SESSION_TTL_DAYS = 90;

type SeedPerson = {
  key: string;
  name: string;
  role: "coach" | "client";
  /** Starting working weight in kg, scaled per exercise. */
  strength: number;
  startWeightKg: number;
  goal: string;
};

const PEOPLE: SeedPerson[] = [
  { key: "coach", name: "Rhea Coach", role: "coach", strength: 1.3, startWeightKg: 68, goal: "maintain" },
  { key: "arjun", name: "Arjun Client", role: "client", strength: 1.0, startWeightKg: 82, goal: "lose" },
  { key: "meera", name: "Meera Client", role: "client", strength: 0.7, startWeightKg: 58, goal: "gain" },
  { key: "sam", name: "Sam Client", role: "client", strength: 1.15, startWeightKg: 75, goal: "maintain" },
];

/** Minimal exercise set so the seed works even before the Wger import runs. */
const FALLBACK_EXERCISES = [
  { name: "Barbell Bench Press", baseWeight: 60 },
  { name: "Barbell Squat", baseWeight: 80 },
  { name: "Deadlift", baseWeight: 100 },
  { name: "Overhead Press", baseWeight: 40 },
  { name: "Barbell Row", baseWeight: 55 },
];

const FALLBACK_FOODS = [
  { name: "Chapati", calories: 104, protein: 3.1, carbs: 18, fat: 2.5, servingSize: 40, servingUnit: "piece" },
  { name: "Paneer", calories: 265, protein: 18, carbs: 3.4, fat: 21, servingSize: 100, servingUnit: "g" },
  { name: "Basmati Rice (cooked)", calories: 121, protein: 2.7, carbs: 26, fat: 0.4, servingSize: 100, servingUnit: "g" },
  { name: "Whole Egg", calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, servingSize: 50, servingUnit: "piece" },
  { name: "Toned Milk", calories: 58, protein: 3.1, carbs: 4.7, fat: 3.1, servingSize: 100, servingUnit: "ml" },
  { name: "Chicken Breast", calories: 165, protein: 31, carbs: 0, fat: 3.6, servingSize: 100, servingUnit: "g" },
];

const emailFor = (key: string) => `${key}@${SEED_DOMAIN}`;
const sessionTokenFor = (key: string) => `devseed-${key}-token`;

function daysAgo(n: number, hour = 18): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** Deterministic pseudo-random in [0,1) so seeded data is stable across runs. */
function rand(seed: number): number {
  const x = Math.sin(seed) * 10_000;
  return x - Math.floor(x);
}

function roundToPlate(kg: number): number {
  return Math.round(kg / 2.5) * 2.5;
}

async function wipeSeedData() {
  const existing = await prisma.user.findMany({
    where: { email: { endsWith: `@${SEED_DOMAIN}` } },
    select: { id: true },
  });
  if (existing.length === 0) return 0;
  await prisma.user.deleteMany({ where: { id: { in: existing.map((u) => u.id) } } });
  return existing.length;
}

async function ensureExercises() {
  const existing = await prisma.exercise.findMany({
    where: { name: { in: FALLBACK_EXERCISES.map((e) => e.name) } },
    select: { id: true, name: true },
  });
  const byName = new Map(existing.map((e) => [e.name, e.id]));

  for (const fallback of FALLBACK_EXERCISES) {
    if (byName.has(fallback.name)) continue;
    const created = await prisma.exercise.create({
      data: { name: fallback.name, instructions: "Seeded for development." },
      select: { id: true, name: true },
    });
    byName.set(created.name, created.id);
  }

  return FALLBACK_EXERCISES.map((e) => ({ ...e, id: byName.get(e.name)! }));
}

async function ensureFoods() {
  const names = FALLBACK_FOODS.map((f) => f.name);
  const existing = await prisma.food.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true },
  });
  const byName = new Map(existing.map((f) => [f.name, f.id]));

  for (const food of FALLBACK_FOODS) {
    if (byName.has(food.name)) continue;
    const created = await prisma.food.create({ data: food, select: { id: true, name: true } });
    byName.set(created.name, created.id);
  }

  return FALLBACK_FOODS.map((f) => ({ ...f, id: byName.get(f.name)! }));
}

async function createPerson(person: SeedPerson) {
  return prisma.user.create({
    data: {
      name: person.name,
      email: emailFor(person.key),
      emailVerified: true,
      bio:
        person.role === "coach"
          ? "Strength coach. Seeded account for development."
          : "Seeded client account for development.",
      weightKg: person.startWeightKg,
      nutritionGoal: person.goal,
      calorieGoal: person.goal === "lose" ? 2000 : person.goal === "gain" ? 2800 : 2400,
      proteinGoal: 150,
      carbGoal: 250,
      fatGoal: 70,
      sessions: {
        create: {
          id: `devseed-session-${person.key}`,
          token: sessionTokenFor(person.key),
          expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
          userAgent: "kak-fit-dev-seed",
        },
      },
    },
  });
}

async function seedWorkoutHistory(
  userId: string,
  person: SeedPerson,
  exercises: Awaited<ReturnType<typeof ensureExercises>>,
  seedOffset: number,
) {
  let workoutCount = 0;

  // 3 sessions/week, walking backwards from today.
  for (let week = WEEKS_OF_HISTORY - 1; week >= 0; week--) {
    for (const dayOfWeek of [0, 2, 4]) {
      const dayIndex = week * 7 + dayOfWeek;
      const startedAt = daysAgo(dayIndex);
      const finishedAt = new Date(startedAt.getTime() + (50 + Math.floor(rand(seedOffset + dayIndex) * 25)) * 60_000);

      // Progressive overload: strength climbs as we approach today.
      const progression = 1 + (WEEKS_OF_HISTORY - 1 - week) * 0.02;
      const chosen = exercises.slice(0, 3 + (dayOfWeek % 2));

      let totalVolume = 0;
      let completedSetCount = 0;

      const exerciseData = chosen.map((exercise, order) => {
        const working = roundToPlate(exercise.baseWeight * person.strength * progression);
        const sets = [1, 2, 3, 4].map((setNumber) => {
          const isWarmup = setNumber === 1;
          const weight = isWarmup ? roundToPlate(working * 0.5) : working;
          const reps = isWarmup ? 10 : 8 - Math.floor(rand(seedOffset + dayIndex + setNumber) * 2);
          totalVolume += weight * reps;
          completedSetCount += 1;
          return {
            setNumber,
            weight,
            reps,
            setType: isWarmup ? SetType.WARMUP : SetType.NORMAL,
            isCompleted: true,
            rpe: isWarmup ? null : 7 + Math.round(rand(seedOffset + dayIndex + order) * 2),
          };
        });

        return {
          exerciseId: exercise.id,
          order,
          restSeconds: 90,
          sets: { create: sets },
        };
      });

      await prisma.workout.create({
        data: {
          userId,
          name: dayOfWeek === 0 ? "Push Day" : dayOfWeek === 2 ? "Pull Day" : "Leg Day",
          startedAt,
          finishedAt,
          totalVolume: Math.round(totalVolume),
          completedSetCount,
          exercises: { create: exerciseData },
        },
      });
      workoutCount += 1;
    }
  }

  return workoutCount;
}

async function seedMeasurements(userId: string, person: SeedPerson) {
  // Weekly weigh-ins trending toward the person's goal.
  const drift = person.goal === "lose" ? -0.4 : person.goal === "gain" ? 0.3 : 0.05;

  const rows = Array.from({ length: WEEKS_OF_HISTORY }, (_, i) => {
    const weeksBack = WEEKS_OF_HISTORY - 1 - i;
    return {
      userId,
      date: daysAgo(weeksBack * 7, 7),
      weight: Math.round((person.startWeightKg + drift * i) * 10) / 10,
      bodyFat: Math.round((22 - i * 0.2) * 10) / 10,
      waist: Math.round((85 + drift * i * 2) * 10) / 10,
    };
  });

  await prisma.bodyMeasurement.createMany({ data: rows });
  return rows.length;
}

async function seedMeals(
  userId: string,
  foods: Awaited<ReturnType<typeof ensureFoods>>,
  seedOffset: number,
) {
  const mealPlan: Array<{ type: MealType; foodNames: string[] }> = [
    { type: MealType.BREAKFAST, foodNames: ["Whole Egg", "Toned Milk", "Chapati"] },
    { type: MealType.LUNCH, foodNames: ["Basmati Rice (cooked)", "Paneer", "Chapati"] },
    { type: MealType.DINNER, foodNames: ["Chicken Breast", "Basmati Rice (cooked)"] },
  ];

  let count = 0;
  // Last 14 days, so the meal-reminder "usual items" query has data to chew on.
  for (let dayIndex = 0; dayIndex < 14; dayIndex++) {
    for (const meal of mealPlan) {
      // Occasionally skip a meal so the data isn't unrealistically perfect.
      if (rand(seedOffset + dayIndex + meal.foodNames.length) < 0.12) continue;

      const items = meal.foodNames.map((name) => {
        const food = foods.find((f) => f.name === name)!;
        const servings = food.servingUnit === "piece" ? 2 : 100;
        return { foodId: food.id, quantity: servings, unit: food.servingUnit };
      });

      await prisma.mealLog.create({
        data: {
          userId,
          date: daysAgo(dayIndex, meal.type === MealType.BREAKFAST ? 8 : meal.type === MealType.LUNCH ? 13 : 20),
          mealType: meal.type,
          items: { create: items },
        },
      });
      count += 1;
    }
  }

  return count;
}

async function main() {
  console.log("→ Seeding development data\n");

  const wiped = await wipeSeedData();
  if (wiped > 0) console.log(`  Removed ${wiped} previously seeded account(s)`);

  const exercises = await ensureExercises();
  const foods = await ensureFoods();
  console.log(`  Exercises available: ${exercises.length} · Foods available: ${foods.length}\n`);

  const summary: Array<{ name: string; role: string; email: string; token: string; workouts: number; meals: number }> = [];

  for (const [index, person] of PEOPLE.entries()) {
    const user = await createPerson(person);
    const seedOffset = index * 1000;

    const workouts = await seedWorkoutHistory(user.id, person, exercises, seedOffset);
    await seedMeasurements(user.id, person);
    const meals = await seedMeals(user.id, foods, seedOffset);

    summary.push({
      name: person.name,
      role: person.role,
      email: emailFor(person.key),
      token: sessionTokenFor(person.key),
      workouts,
      meals,
    });
    console.log(`  ✓ ${person.name.padEnd(14)} ${workouts} workouts · ${meals} meal logs`);
  }

  console.log("\n✓ Seed complete.\n");
  console.log("  Dev bearer tokens (use as `Authorization: Bearer <token>`):\n");
  for (const row of summary) {
    console.log(`    ${row.role.padEnd(6)} ${row.email.padEnd(22)} ${row.token}`);
  }
  console.log(
    "\n  These are real sessions valid for 90 days — they let you act as a seeded\n" +
      "  user without going through Google OAuth. Development databases only.\n",
  );
}

main()
  .catch((error) => {
    console.error("✗ Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
