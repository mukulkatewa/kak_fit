import { useRouter } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { TOUCH_TARGET_MIN } from "../../src/lib/layout-constants";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  SparklesIcon,
} from "react-native-heroicons/outline";
import Animated, {
  FadeInRight,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  Button,
  Input,
  ListGroup,
  ListRow,
  Screen,
  useToast,
} from "../../src/components/ui";
import { ProgressRing } from "../../src/components/charts";
import { ListSkeleton } from "../../src/components/skeleton";
import { entranceDown } from "../../src/lib/animations";
import { scheduleMealPlanNotifications } from "../../src/lib/meal-plan-notifications";
import { trpc, queryStaleTime } from "../../src/lib/trpc";
import { radius, spacing, typography, useTheme, type Palette, type ShadowSet } from "../../src/lib/theme";

const MEAL_TYPES = [
  { key: "BREAKFAST" as const, label: "Breakfast" },
  { key: "LUNCH" as const, label: "Lunch" },
  { key: "DINNER" as const, label: "Dinner" },
  { key: "SNACK" as const, label: "Snacks" },
];

type MealKey = (typeof MEAL_TYPES)[number]["key"];

type PlannedMealItem = {
  name: string;
  amount: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type PlannedMeal = {
  mealType: MealKey;
  title: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prepMinutes: number;
  items: PlannedMealItem[];
  instructions: string;
  swapIdeas: string[];
};


const COMMON_FOODS = [
  "roti",
  "rice",
  "dal",
  "curd",
  "milk",
  "paneer",
  "eggs",
  "chicken",
  "soy chunks",
  "chana",
  "peanuts",
  "banana",
  "potato",
  "seasonal sabzi",
];

function parsePlannedMeals(value: unknown): PlannedMeal[] {
  return Array.isArray(value) ? (value as PlannedMeal[]) : [];
}

function AnimatedCalorieRing({
  progress,
  size,
  color,
  track,
  ticks,
  tickLength,
  children,
}: {
  progress: number;
  size: number;
  color: string;
  track: string;
  ticks: number;
  tickLength: number;
  children: ReactNode;
}) {
  const animatedProgress = useSharedValue(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    animatedProgress.value = 0;
    animatedProgress.value = withTiming(progress, { duration: 1000 });
  }, [animatedProgress, progress]);

  useAnimatedReaction(
    () => animatedProgress.value,
    (value) => {
      runOnJS(setDisplayProgress)(value);
    },
  );

  return (
    <Animated.View entering={entranceDown()}>
      <ProgressRing
        size={size}
        progress={displayProgress}
        color={color}
        track={track}
        ticks={ticks}
        tickLength={tickLength}
      >
        {children}
      </ProgressRing>
    </Animated.View>
  );
}

function AiMealPlannerSection() {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => StyleSheet.create(makePlannerStyles(colors, shadows, isDark)), [colors, shadows, isDark]);
  const utils = trpc.useUtils();
  const { showToast } = useToast();
  const [setupOpen, setSetupOpen] = useState(false);
  const [customFood, setCustomFood] = useState("");
  const [form, setForm] = useState({
    age: "",
    sex: "male" as "male" | "female" | "other",
    heightCm: "",
    weightKg: "",
    goal: "gain_muscle" as "lose_fat" | "maintain" | "gain_muscle",
    activityLevel: "moderate" as "low" | "moderate" | "high",
    dietPreference: "Indian home food",
    cookingAccess: "stove and basic utensils",
    availableFoods: ["roti", "rice", "dal", "curd", "banana"],
    avoidances: "",
    mealReminderEnabled: true,
  });

  const { data: profile, isLoading: profileLoading } = trpc.nutrition.getPlannerProfile.useQuery(undefined, {
    staleTime: queryStaleTime.nutritionTargets,
  });
  const { data: plan, isLoading: planLoading } = trpc.nutrition.todayPlan.useQuery(undefined, {
    staleTime: queryStaleTime.nutritionDaily,
  });

  const plannedMeals = useMemo(() => parsePlannedMeals(plan?.meals), [plan?.meals]);

  useEffect(() => {
    if (!profile) return;
    setForm({
      age: profile.age ? String(profile.age) : "",
      sex: (profile.sex as "male" | "female" | "other") ?? "male",
      heightCm: profile.heightCm ? String(profile.heightCm) : "",
      weightKg: profile.weightKg ? String(profile.weightKg) : "",
      goal: (profile.goal as "lose_fat" | "maintain" | "gain_muscle") ?? "gain_muscle",
      activityLevel: (profile.activityLevel as "low" | "moderate" | "high") ?? "moderate",
      dietPreference: profile.dietPreference ?? "Indian home food",
      cookingAccess: profile.cookingAccess ?? "stove and basic utensils",
      availableFoods: profile.availableFoods.length > 0 ? profile.availableFoods : ["roti", "rice", "dal", "curd", "banana"],
      avoidances: profile.avoidances.join(", "),
      mealReminderEnabled: profile.mealReminderEnabled,
    });
  }, [profile]);

  useEffect(() => {
    if (!plan || !profile?.mealReminderEnabled || plannedMeals.length === 0) return;
    void scheduleMealPlanNotifications({
      id: plan.id,
      date: plan.date,
      meals: plannedMeals.map((meal) => ({
        mealType: meal.mealType,
        title: meal.title,
        time: meal.time,
        protein: meal.protein,
      })),
    });
  }, [plan, plannedMeals, profile?.mealReminderEnabled]);

  const saveProfile = trpc.nutrition.savePlannerProfile.useMutation({
    onSuccess: () => {
      utils.nutrition.getPlannerProfile.invalidate();
      utils.nutrition.getTargets.invalidate();
      utils.nutrition.dailySummary.invalidate();
      setSetupOpen(false);
      showToast("Meal profile saved", "success");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const generatePlan = trpc.nutrition.generatePlan.useMutation({
    onSuccess: () => {
      utils.nutrition.todayPlan.invalidate();
      utils.nutrition.dailySummary.invalidate();
      showToast("Today's plan is ready", "success");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const markAte = trpc.nutrition.markPlanMealAte.useMutation({
    onSuccess: () => {
      utils.nutrition.todayPlan.invalidate();
      utils.nutrition.todayMeals.invalidate();
      utils.nutrition.dailySummary.invalidate();
      showToast("Meal logged", "success");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const skipMeal = trpc.nutrition.skipPlanMeal.useMutation({
    onSuccess: () => {
      utils.nutrition.todayPlan.invalidate();
      showToast("Meal skipped. Keep protein steady in the next meal.", "info");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const swapMeal = trpc.nutrition.swapPlanMeal.useMutation({
    onSuccess: () => {
      utils.nutrition.todayPlan.invalidate();
      showToast("Meal swapped", "success");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const toggleFood = (food: string) => {
    setForm((current) => {
      const exists = current.availableFoods.includes(food);
      return {
        ...current,
        availableFoods: exists
          ? current.availableFoods.filter((item) => item !== food)
          : [...current.availableFoods, food],
      };
    });
  };

  const addCustomFood = () => {
    const value = customFood.trim();
    if (!value) return;
    setForm((current) => ({
      ...current,
      availableFoods: current.availableFoods.includes(value) ? current.availableFoods : [...current.availableFoods, value],
    }));
    setCustomFood("");
  };

  const handleSaveProfile = () => {
    const age = Number(form.age);
    const heightCm = Number(form.heightCm);
    const weightKg = Number(form.weightKg);
    if (!Number.isFinite(age) || !Number.isFinite(heightCm) || !Number.isFinite(weightKg)) {
      showToast("Add valid age, height, and weight", "error");
      return;
    }
    saveProfile.mutate({
      age: Math.round(age),
      sex: form.sex,
      heightCm,
      weightKg,
      goal: form.goal,
      activityLevel: form.activityLevel,
      dietPreference: form.dietPreference.trim() || "Home food",
      cookingAccess: form.cookingAccess.trim() || "basic cooking",
      availableFoods: form.availableFoods,
      avoidances: form.avoidances.split(",").map((item) => item.trim()).filter(Boolean),
      mealReminderEnabled: form.mealReminderEnabled,
    });
  };

  const canGenerate = Boolean(profile?.complete);
  const isBusy = generatePlan.isPending || saveProfile.isPending;

  if (profileLoading || planLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>AI meal coach</Text>
        <Text style={styles.title}>Loading your plan...</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.coachHeader}>
          <View style={styles.coachIcon}>
            <SparklesIcon color={colors.accent} size={22} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrow}>AI meal coach</Text>
            <Text style={styles.title} numberOfLines={1}>Local food diet plan</Text>
          </View>
          <Pressable onPress={() => setSetupOpen(true)} hitSlop={8} style={styles.smallAction}>
            <Text style={styles.smallActionText}>{profile?.complete ? "Edit" : "Setup"}</Text>
          </Pressable>
        </View>

        {profile?.complete && profile.estimatedTargets ? (
          <View style={styles.targetStrip}>
            <Text style={styles.targetText}>{profile.estimatedTargets.calories.toLocaleString()} kcal</Text>
            <Text style={styles.targetText}>{profile.estimatedTargets.protein}g protein</Text>
            <Text style={styles.targetMeta}>{profile.recentWorkoutCount} workouts / 14d</Text>
          </View>
        ) : (
          <Text style={styles.bodyText}>Add body details and foods available around you. We will build a practical plan from that.</Text>
        )}

        {!plan ? (
          <Button
            label={canGenerate ? "Build today's plan" : "Set up meal coach"}
            icon={canGenerate ? "sparkles-outline" : "person-outline"}
            fullWidth
            loading={isBusy}
            onPress={() => {
              if (!canGenerate) {
                setSetupOpen(true);
                return;
              }
              generatePlan.mutate({ force: true });
            }}
          />
        ) : null}

        {plan ? (
          <View style={styles.planStack}>
            <View style={styles.planMetaRow}>
              <Text style={styles.planNote} numberOfLines={2}>{plan.notes}</Text>
              <Pressable
                hitSlop={8}
                onPress={() => generatePlan.mutate({ force: true })}
                disabled={generatePlan.isPending}
                style={styles.iconAction}
              >
                <ArrowPathIcon color={colors.accent} size={18} />
              </Pressable>
            </View>
            {plannedMeals.map((meal) => {
              const completed = plan.completedMealTypes.includes(meal.mealType);
              const skipped = plan.skippedMealTypes.includes(meal.mealType);
              return (
                <View key={meal.mealType} style={[styles.planMeal, completed && styles.planMealDone, skipped && styles.planMealSkipped]}>
                  <View style={styles.planMealTop}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.mealTime}>{meal.time} · {MEAL_TYPES.find((item) => item.key === meal.mealType)?.label}</Text>
                      <Text style={styles.planMealTitle} numberOfLines={1}>{meal.title}</Text>
                    </View>
                    {completed ? <CheckCircleIcon color={colors.success} size={22} /> : skipped ? <ClockIcon color={colors.textMuted} size={22} /> : null}
                  </View>
                  <Text style={styles.planMealMeta}>{Math.round(meal.calories)} kcal · {Math.round(meal.protein)}g protein · {meal.prepMinutes} min</Text>
                  <Text style={styles.planItems} numberOfLines={2}>{meal.items.map((item) => `${item.amount} ${item.name}`).join(" + ")}</Text>
                  <View style={styles.planActions}>
                    <Pressable
                      style={[styles.planButton, styles.planButtonPrimary]}
                      disabled={completed || markAte.isPending}
                      onPress={() => plan && markAte.mutate({ planId: plan.id, mealType: meal.mealType })}
                    >
                      <Text style={styles.planButtonPrimaryText}>{completed ? "Logged" : "Ate"}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.planButton}
                      disabled={skipped || skipMeal.isPending}
                      onPress={() => plan && skipMeal.mutate({ planId: plan.id, mealType: meal.mealType, hunger: "LITTLE" })}
                    >
                      <Text style={styles.planButtonText}>{skipped ? "Skipped" : "Skip"}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.planButton}
                      disabled={swapMeal.isPending}
                      onPress={() => plan && swapMeal.mutate({ planId: plan.id, mealType: meal.mealType })}
                    >
                      <Text style={styles.planButtonText}>Swap</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      <Modal visible={setupOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSetupOpen(false)}>
        <Screen scroll style={styles.setupScreen}>
          <View style={styles.setupHeader}>
            <Text style={styles.setupTitle}>Meal coach setup</Text>
            <Pressable onPress={() => setSetupOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.formGrid}>
            <Input placeholder="Age" value={form.age} keyboardType="number-pad" onChangeText={(age) => setForm((current) => ({ ...current, age }))} />
            <Input placeholder="Height cm" value={form.heightCm} keyboardType="decimal-pad" onChangeText={(heightCm) => setForm((current) => ({ ...current, heightCm }))} />
            <Input placeholder="Weight kg" value={form.weightKg} keyboardType="decimal-pad" onChangeText={(weightKg) => setForm((current) => ({ ...current, weightKg }))} />
          </View>

          <SegmentedChips
            label="Sex"
            values={["male", "female", "other"]}
            selected={form.sex}
            onSelect={(sex) => setForm((current) => ({ ...current, sex: sex as typeof form.sex }))}
          />
          <SegmentedChips
            label="Goal"
            values={["lose_fat", "maintain", "gain_muscle"]}
            selected={form.goal}
            onSelect={(goal) => setForm((current) => ({ ...current, goal: goal as typeof form.goal }))}
          />
          <SegmentedChips
            label="Activity"
            values={["low", "moderate", "high"]}
            selected={form.activityLevel}
            onSelect={(activityLevel) => setForm((current) => ({ ...current, activityLevel: activityLevel as typeof form.activityLevel }))}
          />

          <Input placeholder="Diet preference" value={form.dietPreference} onChangeText={(dietPreference) => setForm((current) => ({ ...current, dietPreference }))} />
          <Input placeholder="Cooking access" value={form.cookingAccess} onChangeText={(cookingAccess) => setForm((current) => ({ ...current, cookingAccess }))} />
          <Input placeholder="Avoidances / allergies, comma separated" value={form.avoidances} onChangeText={(avoidances) => setForm((current) => ({ ...current, avoidances }))} />

          <Text style={styles.setupLabel}>Foods available around you</Text>
          <View style={styles.foodChips}>
            {COMMON_FOODS.map((food) => {
              const selected = form.availableFoods.includes(food);
              return (
                <Pressable key={food} onPress={() => toggleFood(food)} style={[styles.foodChip, selected && styles.foodChipSelected]}>
                  <Text style={[styles.foodChipText, selected && styles.foodChipTextSelected]}>{food}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.customFoodRow}>
            <View style={{ flex: 1 }}><Input placeholder="Add food" value={customFood} onChangeText={setCustomFood} /></View>
            <Pressable onPress={addCustomFood} style={styles.addFoodBtn}>
              <Ionicons name="add" size={20} color={colors.onAccent} />
            </Pressable>
          </View>

          <Pressable
            onPress={() => setForm((current) => ({ ...current, mealReminderEnabled: !current.mealReminderEnabled }))}
            style={styles.reminderRow}
          >
            <Ionicons name={form.mealReminderEnabled ? "notifications" : "notifications-off"} size={20} color={colors.accent} />
            <Text style={styles.reminderText}>Meal reminders</Text>
            <Text style={styles.reminderState}>{form.mealReminderEnabled ? "On" : "Off"}</Text>
          </Pressable>

          <Button label="Save meal profile" fullWidth loading={saveProfile.isPending} onPress={handleSaveProfile} />
        </Screen>
      </Modal>
    </>
  );
}

function SegmentedChips({ label, values, selected, onSelect }: { label: string; values: string[]; selected: string; onSelect: (value: string) => void }) {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => StyleSheet.create(makePlannerStyles(colors, shadows, isDark)), [colors, shadows, isDark]);
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.setupLabel}>{label}</Text>
      <View style={styles.foodChips}>
        {values.map((value) => {
          const active = selected === value;
          return (
            <Pressable key={value} onPress={() => onSelect(value)} style={[styles.foodChip, active && styles.foodChipSelected]}>
              <Text style={[styles.foodChipText, active && styles.foodChipTextSelected]}>{value.replace("_", " ")}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function NutritionScreen() {
  const router = useRouter();
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => StyleSheet.create(makeStyles(colors, shadows, isDark)), [colors, shadows, isDark]);
  const headerText = isDark ? colors.text : "#1A1A1A";
  const gradientColors = isDark
    ? ([colors.bg, colors.bg] as const)
    : (["#A8E063", "#56AB2F"] as const);

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    error: summaryErr,
    refetch: refetchSummary,
  } = trpc.nutrition.dailySummary.useQuery(undefined, {
    staleTime: queryStaleTime.nutritionDaily,
  });
  const { data: meals } = trpc.nutrition.todayMeals.useQuery(undefined, {
    staleTime: queryStaleTime.nutritionMeals,
  });
  const { data: targets } = trpc.nutrition.getTargets.useQuery(undefined, {
    staleTime: queryStaleTime.nutritionTargets,
  });

  const cals = summary?.calories ?? 0;
  const macroTargets = summary?.targets ?? targets;
  const calTarget = macroTargets?.calories ?? 0;
  const calProgress = calTarget > 0 ? Math.min(1, cals / calTarget) : 0;
  const goalsUnset =
    macroTargets?.configured === false ||
    ((macroTargets?.calories ?? 0) === 0 &&
      (macroTargets?.protein ?? 0) === 0 &&
      (macroTargets?.carbs ?? 0) === 0 &&
      (macroTargets?.fat ?? 0) === 0);

  const loggedItems = useMemo(
    () =>
      (meals ?? []).flatMap((meal) =>
        meal.items.map((item) => ({
          meal,
          item,
        })),
      ),
    [meals],
  );

  return (
    <Screen scroll padded={false} variant="tab" style={{ backgroundColor: colors.bg }}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: 0 }]}
      >
        <View style={styles.headerInner}>
          <View style={styles.titleRow}>
            <Text style={[styles.pageTitle, { color: headerText }]}>Nutrition</Text>
            <View style={styles.titleActions}>
              <Pressable hitSlop={8} onPress={() => router.push("/nutrition-foods")} style={styles.goalsBtn}>
                <Ionicons name="fast-food-outline" size={16} color={isDark ? colors.accent : colors.accentDark} />
                <Text style={[styles.goalsBtnText, { color: isDark ? colors.accent : colors.accentDark }]}>Foods</Text>
              </Pressable>
              <Pressable hitSlop={8} onPress={() => router.push("/nutrition-goals")} style={styles.goalsBtn}>
                <Ionicons name="options-outline" size={16} color={isDark ? colors.accent : colors.accentDark} />
                <Text style={[styles.goalsBtnText, { color: isDark ? colors.accent : colors.accentDark }]}>Goals</Text>
              </Pressable>
            </View>
          </View>

          {summaryLoading ? (
            <ListSkeleton rows={1} />
          ) : summaryError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Couldn't load summary</Text>
              <Text style={styles.errorMsg}>{summaryErr.message}</Text>
              <Text style={styles.errorHint} onPress={() => refetchSummary()}>
                Tap to retry
              </Text>
            </View>
          ) : summary ? (
            <View style={styles.calHero}>
              <AnimatedCalorieRing
                progress={calProgress}
                size={140}
                color={colors.accent}
                track={isDark ? colors.surfaceHover : "#E8E5DE"}
                ticks={56}
                tickLength={14}
              >
                <Text style={[styles.calValue, { color: headerText }]}>{cals.toLocaleString()}</Text>
                <Text style={[styles.calTarget, { color: isDark ? colors.textMuted : "#6B6B6B" }]}>
                  {calTarget > 0 ? `/ ${calTarget.toLocaleString()}` : "No goal set"}
                </Text>
                <Text style={[styles.calUnit, { color: isDark ? colors.textDim : "#A8A8A8" }]}>Calories</Text>
              </AnimatedCalorieRing>
            </View>
          ) : null}
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {summary && !summaryLoading && !summaryError ? (
          goalsUnset ? (
            <View style={styles.goalsCta}>
              <Text style={styles.goalsCtaTitle}>Set your daily nutrition goals</Text>
              <Text style={styles.goalsCtaText}>
                Add calorie and macro targets to track your progress with the rings below.
              </Text>
              <Button label="Set goals" onPress={() => router.push("/nutrition-goals")} />
            </View>
          ) : (
            <View style={styles.macroBlock}>
              <MacroRingRow
                index={0}
                label="Carbs"
                value={summary.carbs}
                target={macroTargets?.carbs ?? 0}
                color={colors.carbsColor}
                track={isDark ? undefined : "#E8E5DE"}
              />
              <MacroRingRow
                index={1}
                label="Protein"
                value={summary.protein}
                target={macroTargets?.protein ?? 0}
                color={colors.proteinColor}
                track={isDark ? undefined : "#E8E5DE"}
              />
              <MacroRingRow
                index={2}
                label="Fats"
                value={summary.fat}
                target={macroTargets?.fat ?? 0}
                color={colors.fatColor}
                track={isDark ? undefined : "#E8E5DE"}
              />
            </View>
          )
        ) : null}

        <AiMealPlannerSection />

        {loggedItems.length > 0 ? (
          <View style={styles.loggedSection}>
            <Text style={styles.sectionTitle}>Logged Today</Text>
            <ListGroup>
              {loggedItems.map(({ meal, item }, flatIndex) => {
                const ratio = item.quantity / (item.food.servingSize ?? 100);
                const cal = Math.round(item.food.calories * ratio);
                const protein = Math.round(item.food.protein * ratio);
                const mealLabel = MEAL_TYPES.find((m) => m.key === meal.mealType)?.label ?? meal.mealType;
                const isLast = flatIndex === loggedItems.length - 1;
                return (
                  <Animated.View
                    key={`${meal.id}-${item.id}`}
                    entering={entranceDown(flatIndex * 60)}
                  >
                    <ListRow
                      title={item.food.name}
                      subtitle={`${mealLabel} · ${Math.round(item.quantity)}g · ${cal} cal`}
                      icon="restaurant-outline"
                      right={<Text style={styles.loggedProtein}>{protein}g P</Text>}
                      last={isLast}
                    />
                  </Animated.View>
                );
              })}
            </ListGroup>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function MacroRingRow({
  index,
  label,
  value,
  target,
  color,
  track,
}: {
  index: number;
  label: string;
  value: number;
  target: number;
  color: string;
  track?: string;
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(
    () => StyleSheet.create(makeMacroStyles(colors, isDark)),
    [colors, isDark],
  );
  const progress = target > 0 ? Math.min(1, value / target) : 0;
  const pct = Math.round(progress * 100);
  return (
    <Animated.View entering={FadeInRight.delay(index * 100).springify().damping(16)} style={styles.macroCol}>
      <ProgressRing
        size={48}
        progress={progress}
        color={color}
        track={track}
        ticks={24}
        tickLength={6}
        tickWidth={2}
      >
        <Text style={[styles.macroPct, { color }]}>{pct}%</Text>
      </ProgressRing>
      <Text style={styles.macroLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.macroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {Math.round(value)}g / {target > 0 ? `${target}g` : "—"}
      </Text>
    </Animated.View>
  );
}

function makePlannerStyles(colors: Palette, shadows: ShadowSet, isDark: boolean) {
  return {
    card: {
      backgroundColor: isDark ? colors.surface : colors.bgElevated,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadows.md,
    },
    coachHeader: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md },
    coachIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.accentMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    eyebrow: { ...typography.caption, color: colors.textMuted, fontWeight: "800" as const, textTransform: "uppercase" as const },
    title: { ...typography.h2, color: colors.text },
    bodyText: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 20 },
    smallAction: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surfaceHover },
    smallActionText: { ...typography.label, color: colors.accent, fontWeight: "800" as const },
    targetStrip: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: spacing.sm, alignItems: "center" as const },
    targetText: { ...typography.bodySmall, color: colors.text, fontWeight: "800" as const, backgroundColor: colors.accentMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full },
    targetMeta: { ...typography.caption, color: colors.textMuted },
    planStack: { gap: spacing.md },
    planMetaRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md },
    planNote: { flex: 1, ...typography.bodySmall, color: colors.textMuted, lineHeight: 19 },
    iconAction: { width: 38, height: 38, borderRadius: 19, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: colors.surfaceHover },
    planMeal: { borderRadius: radius.md, backgroundColor: colors.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSubtle, padding: spacing.md, gap: spacing.sm },
    planMealDone: { borderColor: colors.success, backgroundColor: colors.successMuted },
    planMealSkipped: { opacity: 0.72 },
    planMealTop: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md },
    mealTime: { ...typography.caption, color: colors.textMuted, fontWeight: "700" as const },
    planMealTitle: { ...typography.h3, color: colors.text },
    planMealMeta: { ...typography.caption, color: colors.accent, fontWeight: "700" as const },
    planItems: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 19 },
    planActions: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm, marginTop: spacing.xs },
    planButton: { flex: 1, minHeight: 38, borderRadius: radius.md, backgroundColor: colors.surfaceHover, alignItems: "center" as const, justifyContent: "center" as const, paddingHorizontal: spacing.sm },
    planButtonPrimary: { backgroundColor: colors.accent },
    planButtonText: { ...typography.label, color: colors.text, fontWeight: "800" as const },
    planButtonPrimaryText: { ...typography.label, color: colors.onAccent, fontWeight: "800" as const },
    setupScreen: { gap: spacing.lg, paddingBottom: spacing.xxl },
    setupHeader: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
    setupTitle: { ...typography.h2, color: colors.text },
    setupLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "800" as const, textTransform: "uppercase" as const },
    formGrid: { gap: spacing.md },
    foodChips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: spacing.sm },
    foodChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.surfaceHover, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSubtle },
    foodChipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
    foodChipText: { ...typography.label, color: colors.text, fontWeight: "700" as const },
    foodChipTextSelected: { color: colors.onAccent },
    customFoodRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm },
    addFoodBtn: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: "center" as const, justifyContent: "center" as const },
    reminderRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.surfaceHover, paddingHorizontal: spacing.md },
    reminderText: { flex: 1, ...typography.bodySmall, color: colors.text, fontWeight: "700" as const },
    reminderState: { ...typography.label, color: colors.accent, fontWeight: "800" as const },
  };
}

function makeMacroStyles(colors: Palette, isDark: boolean) {
  return {
    macroCol: {
      flex: 1,
      minWidth: 0,
      alignItems: "center" as const,
      gap: spacing.xs,
    },
    macroPct: { ...typography.caption, fontWeight: "700" as const },
    macroLabel: { ...typography.caption, fontWeight: "600" as const, color: colors.text, textAlign: "center" as const },
    macroValue: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: "center" as const,
      width: "100%" as const,
    },
  };
}

function makeStyles(colors: Palette, shadows: ShadowSet, isDark: boolean) {
  return {
    headerGradient: {
      paddingBottom: spacing.lg,
      borderBottomLeftRadius: isDark ? 0 : radius.xl,
      borderBottomRightRadius: isDark ? 0 : radius.xl,
    },
    headerInner: { paddingHorizontal: spacing.lg },
    body: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
    titleRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    titleActions: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm },
    pageTitle: { flex: 1, ...typography.h1 },
    goalsBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.xs,
      backgroundColor: isDark ? colors.accentMuted : "rgba(255,255,255,0.55)",
      borderRadius: radius.full,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      minHeight: TOUCH_TARGET_MIN,
    },
    goalsBtnText: { ...typography.bodySmall, fontWeight: "700" as const },

    calHero: { alignItems: "center" as const, paddingVertical: spacing.sm },
    calValue: { fontSize: 22, fontWeight: "800" as const }, // custom: calorie hero number
    calTarget: { ...typography.label },
    calUnit: { ...typography.label },

    macroBlock: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      gap: spacing.xs,
      backgroundColor: isDark ? colors.surface : colors.bgElevated,
      borderRadius: radius.lg,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
      ...shadows.md,
    },
    goalsCta: {
      backgroundColor: isDark ? colors.surface : colors.bgElevated,
      borderRadius: radius.lg,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
      alignItems: "center" as const,
      ...shadows.md,
    },
    goalsCtaTitle: { ...typography.h2, color: colors.text, textAlign: "center" as const },
    goalsCtaText: {
      ...typography.bodySmall,
      color: colors.textMuted,
      textAlign: "center" as const,
    },
    loggedSection: { gap: spacing.md },
    loggedProtein: { ...typography.label, color: colors.accent, fontWeight: "800" as const },

    sectionTitle: isDark
      ? { ...typography.h2, color: colors.text }
      : {
          ...typography.label,
          letterSpacing: 1.2,
          textTransform: "uppercase" as const,
          color: colors.textMuted,
        },

    errorBox: {
      backgroundColor: colors.dangerMuted,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    errorTitle: { ...typography.h3, color: colors.danger },
    errorMsg: { ...typography.bodySmall, color: colors.text },
    errorHint: { ...typography.bodySmall, color: colors.accent, fontWeight: "700" as const, marginTop: spacing.sm },
  };
}
