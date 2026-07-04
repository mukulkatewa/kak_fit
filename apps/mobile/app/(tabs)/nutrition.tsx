import type { RouterOutputs } from "@kak-fit/api/router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { flexFill, TOUCH_TARGET_MIN } from "../../src/lib/layout-constants";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  PencilSquareIcon,
  SparklesIcon,
  TrashIcon,
} from "react-native-heroicons/outline";
import Animated, {
  FadeInRight,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  Button,
  Input,
  ListGroup,
  ListRow,
  Screen,
  ThemedDialog,
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
type FoodSearchResult = RouterOutputs["nutrition"]["searchFoods"][number];

function defaultMealType(): MealKey {
  const hour = new Date().getHours();
  if (hour >= 5 && hour <= 10) return "BREAKFAST";
  if (hour >= 11 && hour <= 14) return "LUNCH";
  if (hour >= 15 && hour <= 17) return "SNACK";
  return "DINNER";
}

function foodSearchKey(food: FoodSearchResult) {
  return food.id ?? `fdc-${food.fdcId}`;
}

function formatFoodMacros(food: FoodSearchResult) {
  return `${Math.round(food.calories)}kcal · ${Math.round(food.protein)}g P · ${Math.round(food.carbs)}g C · ${Math.round(food.fat)}g F`;
}

type EditFoodMacros = {
  servingUnit: string | null;
  servingSize: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

function computeEditMacros(food: EditFoodMacros, quantityStr: string) {
  const qty = Number(quantityStr.replace(",", "."));
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const ratio = qty / (food.servingSize ?? 100);
  return {
    cal: Math.round(food.calories * ratio),
    protein: Math.round(food.protein * ratio),
    carbs: Math.round(food.carbs * ratio),
    fat: Math.round(food.fat * ratio),
  };
}

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


const PLAN_EXPANDED_KEY = "@kak_fit/plan_expanded";

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

function calorieRingColor(calTarget: number, cals: number, colors: Palette) {
  if (calTarget <= 0) return colors.accent;
  if (cals > calTarget) return colors.danger;
  const remaining = Math.max(0, calTarget - cals);
  const remainingPct = remaining / calTarget;
  if (remainingPct > 0.2) return colors.accent;
  if (remainingPct > 0.05) return colors.gold;
  return colors.danger;
}

function mealAccentColor(mealType: MealKey, colors: Palette) {
  switch (mealType) {
    case "BREAKFAST":
      return colors.gold;
    case "LUNCH":
      return colors.carbsColor;
    case "DINNER":
      return colors.proteinColor;
    case "SNACK":
      return colors.fatColor;
  }
}

function parseAiFoodName(name: string) {
  const match = name.match(/^\[AI:[^\]]+\]\s*(.+?)(?:\s+-\s+(.+))?$/);
  if (!match) return { name, amount: null as string | null };
  return { name: match[1]?.trim() || name, amount: match[2]?.trim() || null };
}

function displayFoodName(food: { name: string }) {
  return parseAiFoodName(food.name).name;
}

function displayPortion(item: { quantity: number; unit: string; food: { name: string; brand: string | null; servingSize: number | null; servingUnit: string | null } }) {
  const legacyAmount = parseAiFoodName(item.food.name).amount;
  if (legacyAmount && item.quantity === 1) return legacyAmount;

  const servingUnit = item.food.servingUnit?.trim();
  if (item.quantity === 1 && servingUnit && servingUnit !== "g" && servingUnit !== "serving") {
    return servingUnit;
  }
  if (item.quantity === 1 && item.food.brand) return item.food.brand;

  const unit = item.unit || servingUnit || "g";
  return `${Math.round(item.quantity * 10) / 10}${unit === "g" ? "g" : ` ${unit}`}`;
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

function PlanMealCard({
  meal,
  completed,
  visuallySkipped,
  pendingSkip,
  highlight,
  swapping,
  swapPending,
  styles,
  colors,
  onAte,
  onSkip,
  onUndoSkip,
  onSwap,
  markAtePending,
}: {
  meal: PlannedMeal;
  completed: boolean;
  visuallySkipped: boolean;
  pendingSkip: boolean;
  highlight: boolean;
  swapping: boolean;
  swapPending: boolean;
  styles: ReturnType<typeof makePlannerStyles>;
  colors: Palette;
  onAte: () => void;
  onSkip: () => void;
  onUndoSkip: () => void;
  onSwap: () => void;
  markAtePending: boolean;
}) {
  const flashProgress = useSharedValue(0);
  const baseBackground = completed ? colors.successMuted : colors.bg;

  useEffect(() => {
    if (!highlight) return;
    flashProgress.value = 1;
    flashProgress.value = withTiming(0, { duration: 800 });
  }, [flashProgress, highlight]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(flashProgress.value, [0, 1], [baseBackground, colors.accentMuted]),
  }));

  return (
    <Animated.View
      style={[
        styles.planMeal,
        completed && styles.planMealDone,
        visuallySkipped && styles.planMealSkipped,
        animatedCardStyle,
      ]}
    >
      <View
        style={[styles.planMealAccent, { backgroundColor: mealAccentColor(meal.mealType, colors) }]}
      />
      <View style={styles.planMealTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.mealTime}>
            {meal.time} · {MEAL_TYPES.find((item) => item.key === meal.mealType)?.label}
          </Text>
          <Text style={styles.planMealTitle} numberOfLines={1}>
            {meal.title}
          </Text>
        </View>
        {visuallySkipped ? <ClockIcon color={colors.textMuted} size={22} /> : null}
      </View>
      <View style={styles.planMealMetaRow}>
        <Text style={styles.planMealMeta}>
          {Math.round(meal.calories)} kcal · {Math.round(meal.protein)}g protein ·
        </Text>
        <View style={styles.planPrepRow}>
          <ClockIcon color={colors.accent} size={12} />
          <Text style={styles.planMealMeta}>{meal.prepMinutes} min prep</Text>
        </View>
      </View>
      <View style={styles.planItemsList}>
        {meal.items.slice(0, 4).map((item, index) => (
          <Text key={`${item.name}-${index}`} style={styles.planItemLine}>
            · {item.amount} {item.name}
          </Text>
        ))}
        {meal.items.length > 4 ? (
          <Text style={styles.planItemLine}>+ {meal.items.length - 4} more</Text>
        ) : null}
      </View>
      {completed ? (
        <View style={styles.planLoggedRow}>
          <CheckCircleIcon color={colors.success} size={18} />
          <Text style={styles.planLoggedText}>Logged ✓</Text>
        </View>
      ) : pendingSkip ? (
        <Pressable style={styles.skipUndoBanner} onPress={onUndoSkip}>
          <Text style={styles.skipUndoBannerText}>Meal skipped — tap to undo</Text>
        </Pressable>
      ) : !visuallySkipped ? (
        <View style={styles.planActions}>
          <Pressable
            style={[styles.planAteButton, styles.planButtonPrimary]}
            disabled={markAtePending}
            onPress={onAte}
          >
            <Text style={styles.planButtonPrimaryText}>Ate this meal</Text>
          </Pressable>
          <View style={styles.planSecondaryActions}>
            <Pressable style={styles.planIconPill} onPress={onSkip}>
              <ClockIcon color={colors.text} size={14} />
              <Text style={styles.planIconPillText}>Skip</Text>
            </Pressable>
            <Pressable
              style={styles.planIconPill}
              disabled={swapPending && !swapping}
              onPress={onSwap}
            >
              {swapping && swapPending ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <>
                  <ArrowPathIcon color={colors.text} size={14} />
                  <Text style={styles.planIconPillText}>Swap</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

function AiMealPlannerSection() {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => StyleSheet.create(makePlannerStyles(colors, shadows, isDark)), [colors, shadows, isDark]);
  const dayInput = useMemo(() => ({ timezoneOffsetMinutes: new Date().getTimezoneOffset() }), []);
  const utils = trpc.useUtils();
  const { showToast } = useToast();
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState(0);
  const [planExpanded, setPlanExpanded] = useState(true);
  const [customFood, setCustomFood] = useState("");
  const [pendingSkips, setPendingSkips] = useState<Map<MealKey, ReturnType<typeof setTimeout>>>(new Map());
  const pendingSkipsRef = useRef(pendingSkips);
  pendingSkipsRef.current = pendingSkips;
  const [swappingMealType, setSwappingMealType] = useState<MealKey | null>(null);
  const [highlightMealType, setHighlightMealType] = useState<MealKey | null>(null);
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
  const { data: plan, isLoading: planLoading } = trpc.nutrition.todayPlan.useQuery(dayInput, {
    staleTime: queryStaleTime.nutritionDaily,
  });
  const { data: previousPlan } = trpc.nutrition.previousPlan.useQuery(dayInput, {
    enabled: Boolean(profile?.complete),
    staleTime: queryStaleTime.nutritionDaily,
  });

  const plannedMeals = useMemo(() => parsePlannedMeals(plan?.meals), [plan?.meals]);
  const planCalories = plannedMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const planProtein = plannedMeals.reduce((sum, meal) => sum + meal.protein, 0);
  const loggedCount = plan?.completedMealTypes.length ?? 0;
  const skippedCount = plan?.skippedMealTypes.length ?? 0;

  useEffect(() => {
    void AsyncStorage.getItem(PLAN_EXPANDED_KEY).then((value) => {
      if (value === "0") setPlanExpanded(false);
      else if (value === "1") setPlanExpanded(true);
    });
  }, []);

  const setPlanExpandedPersisted = (value: boolean) => {
    setPlanExpanded(value);
    void AsyncStorage.setItem(PLAN_EXPANDED_KEY, value ? "1" : "0");
  };

  const togglePlanExpanded = () => {
    setPlanExpanded((current) => {
      const next = !current;
      void AsyncStorage.setItem(PLAN_EXPANDED_KEY, next ? "1" : "0");
      return next;
    });
  };

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
    onSuccess: async () => {
      utils.nutrition.getPlannerProfile.invalidate();
      utils.nutrition.getTargets.invalidate();
      utils.nutrition.dailySummary.invalidate(dayInput);
      const updatedProfile = await utils.nutrition.getPlannerProfile.fetch();
      closeSetup();
      showToast("Meal profile saved", "success");
      if (updatedProfile?.complete) {
        generatePlan.mutate({ ...dayInput, force: true });
      }
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const generatePlan = trpc.nutrition.generatePlan.useMutation({
    onSuccess: (nextPlan) => {
      utils.nutrition.todayPlan.setData(dayInput, nextPlan);
      utils.nutrition.previousPlan.invalidate();
      utils.nutrition.dailySummary.invalidate(dayInput);
      setPlanExpandedPersisted(true);
      showToast("Fresh plan ready", "success");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const reusePreviousPlan = trpc.nutrition.reusePreviousPlan.useMutation({
    onSuccess: (nextPlan) => {
      utils.nutrition.todayPlan.setData(dayInput, nextPlan);
      utils.nutrition.dailySummary.invalidate(dayInput);
      setPlanExpandedPersisted(true);
      showToast("Previous plan added for today", "success");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const markAte = trpc.nutrition.markPlanMealAte.useMutation({
    onSuccess: (nextPlan) => {
      utils.nutrition.todayPlan.setData(dayInput, nextPlan);
      utils.nutrition.todayMeals.invalidate(dayInput);
      utils.nutrition.dailySummary.invalidate(dayInput);
      showToast("Meal logged", "success");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const skipMeal = trpc.nutrition.skipPlanMeal.useMutation({
    onSuccess: (nextPlan) => {
      utils.nutrition.todayPlan.setData(dayInput, nextPlan);
      showToast("Meal skipped. Keep protein steady in the next meal.", "info");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const swapMeal = trpc.nutrition.swapPlanMeal.useMutation({
    onSuccess: (nextPlan, variables) => {
      utils.nutrition.todayPlan.setData(dayInput, nextPlan);
      setHighlightMealType(variables.mealType);
      setTimeout(() => setHighlightMealType(null), 800);
      showToast("Meal swapped", "success");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  useEffect(
    () => () => {
      pendingSkipsRef.current.forEach((timer) => clearTimeout(timer));
    },
    [],
  );

  const handleSkip = (mealType: MealKey) => {
    if (!plan || pendingSkips.has(mealType)) return;
    const timer = setTimeout(() => {
      skipMeal.mutate({ planId: plan.id, mealType, hunger: "LITTLE" });
      setPendingSkips((current) => {
        const next = new Map(current);
        next.delete(mealType);
        return next;
      });
    }, 5000);
    setPendingSkips((current) => new Map(current).set(mealType, timer));
    showToast("Meal skipped — tap to undo", "info");
  };

  const handleUndoSkip = (mealType: MealKey) => {
    const timer = pendingSkips.get(mealType);
    if (timer) clearTimeout(timer);
    setPendingSkips((current) => {
      const next = new Map(current);
      next.delete(mealType);
      return next;
    });
    showToast("Undo successful", "success");
  };

  const handleSwap = (mealType: MealKey) => {
    if (!plan) return;
    setSwappingMealType(mealType);
    swapMeal.mutate(
      { planId: plan.id, mealType },
      { onSettled: () => setSwappingMealType(null) },
    );
  };

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

  const closeSetup = () => {
    setSetupOpen(false);
    setSetupStep(0);
  };

  const openSetup = () => {
    setSetupStep(0);
    setSetupOpen(true);
  };

  const validateStep0 = () => {
    const age = Number(form.age);
    const heightCm = Number(form.heightCm);
    const weightKg = Number(form.weightKg);
    return (
      Number.isFinite(age) &&
      age > 0 &&
      Number.isFinite(heightCm) &&
      heightCm > 0 &&
      Number.isFinite(weightKg) &&
      weightKg > 0
    );
  };

  const goToNextStep = () => {
    if (setupStep === 0 && !validateStep0()) {
      showToast("Add valid age, height, and weight", "error");
      return;
    }
    setSetupStep((step) => Math.min(step + 1, 3));
  };

  const goToPreviousStep = () => {
    setSetupStep((step) => Math.max(step - 1, 0));
  };

  const GOAL_OPTIONS = [
    {
      key: "lose_fat" as const,
      title: "Lose fat",
      subtitle: "Caloric deficit, preserve muscle",
      icon: "trending-down-outline" as const,
    },
    {
      key: "maintain" as const,
      title: "Maintain weight",
      subtitle: "Eat at your TDEE",
      icon: "remove-outline" as const,
    },
    {
      key: "gain_muscle" as const,
      title: "Gain muscle",
      subtitle: "Slight surplus, train hard",
      icon: "trending-up-outline" as const,
    },
  ];

  const ACTIVITY_OPTIONS = [
    { key: "low" as const, label: "Low" },
    { key: "moderate" as const, label: "Moderate" },
    { key: "high" as const, label: "High" },
  ];

  const SEX_OPTIONS = [
    { key: "male" as const, label: "Male" },
    { key: "female" as const, label: "Female" },
    { key: "other" as const, label: "Other" },
  ];

  const canGenerate = Boolean(profile?.complete);
  const isBusy = generatePlan.isPending || reusePreviousPlan.isPending || saveProfile.isPending;

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
          <LinearGradient
            colors={[`${colors.accent}33`, colors.accentMuted]}
            style={styles.coachIcon}
          >
            <SparklesIcon color={colors.accent} size={22} />
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrow}>AI meal coach</Text>
            <Text style={styles.title} numberOfLines={1}>Today's food plan</Text>
          </View>
          <Pressable onPress={openSetup} hitSlop={8} style={styles.smallAction}>
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
          <View style={styles.emptyPlanBox}>
            <View style={styles.emptyPlanDecoration} pointerEvents="none">
              <SparklesIcon color={colors.accent} size={48} />
            </View>
            <Text style={styles.emptyPlanTitle}>{canGenerate ? "No plan for today yet" : "Set up meal coach"}</Text>
            <Text style={styles.bodyText}>
              {canGenerate
                ? "Build a fresh plan from your current training and available foods, or reuse a plan you already liked."
                : "Add your body details and local foods once. After that, meal plans are one tap."}
            </Text>
            <View style={styles.emptyActions}>
              <Pressable
                style={[styles.planButton, styles.planButtonPrimary]}
                disabled={isBusy}
                onPress={() => {
                  if (!canGenerate) {
                    openSetup();
                    return;
                  }
                  generatePlan.mutate({ ...dayInput, force: true });
                }}
              >
                <Text style={styles.planButtonPrimaryText}>{canGenerate ? "Build fresh" : "Setup"}</Text>
              </Pressable>
              {previousPlan ? (
                <Pressable
                  style={styles.planButton}
                  disabled={isBusy}
                  onPress={() => reusePreviousPlan.mutate(dayInput)}
                >
                  <Text style={styles.planButtonText}>Use previous</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {plan ? (
          <View style={styles.planStack}>
            <Pressable style={styles.planSummaryCard} onPress={togglePlanExpanded}>
              <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
                <Text style={styles.planSummaryLabel}>Today's plan</Text>
                <Text style={styles.planSummaryTitle} numberOfLines={1}>
                  {Math.round(planCalories).toLocaleString()} kcal · {Math.round(planProtein)}g protein
                </Text>
                <Text style={styles.planSummaryMeta} numberOfLines={1}>
                  {loggedCount}/{plannedMeals.length} logged{skippedCount > 0 ? ` · ${skippedCount} skipped` : ""}
                </Text>
                {plannedMeals.length > 0 ? (
                  <View style={styles.planProgressTrack}>
                    <View
                      style={[
                        styles.planProgressFill,
                        { width: `${(loggedCount / plannedMeals.length) * 100}%` },
                      ]}
                    />
                  </View>
                ) : null}
              </View>
              <Ionicons name={planExpanded ? "chevron-up" : "chevron-down"} size={22} color={colors.textMuted} />
            </Pressable>

            <View style={styles.planToolbar}>
              <Pressable
                hitSlop={8}
                onPress={() => generatePlan.mutate({ ...dayInput, force: true })}
                disabled={generatePlan.isPending}
                style={styles.toolbarButton}
              >
                <ArrowPathIcon color={colors.accent} size={17} />
                <Text style={styles.toolbarButtonText}>{generatePlan.isPending ? "Making..." : "New plan"}</Text>
              </Pressable>
              {previousPlan ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => reusePreviousPlan.mutate(dayInput)}
                  disabled={reusePreviousPlan.isPending}
                  style={styles.toolbarButton}
                >
                  <Ionicons name="copy-outline" color={colors.accent} size={17} />
                  <Text style={styles.toolbarButtonText}>Use previous</Text>
                </Pressable>
              ) : null}
            </View>

            {plan.notes ? <Text style={styles.planNote} numberOfLines={planExpanded ? 3 : 1}>{plan.notes}</Text> : null}

            {planExpanded ? (
              <View style={styles.planMealList}>
                {plannedMeals.map((meal) => {
                  const completed = plan.completedMealTypes.includes(meal.mealType);
                  const skipped = plan.skippedMealTypes.includes(meal.mealType);
                  const pendingSkip = pendingSkips.has(meal.mealType);
                  const visuallySkipped = skipped || pendingSkip;
                  return (
                    <PlanMealCard
                      key={meal.mealType}
                      meal={meal}
                      completed={completed}
                      visuallySkipped={visuallySkipped}
                      pendingSkip={pendingSkip}
                      highlight={highlightMealType === meal.mealType}
                      swapping={swappingMealType === meal.mealType}
                      swapPending={swapMeal.isPending}
                      styles={styles}
                      colors={colors}
                      markAtePending={markAte.isPending}
                      onAte={() => markAte.mutate({ planId: plan.id, mealType: meal.mealType })}
                      onSkip={() => handleSkip(meal.mealType)}
                      onUndoSkip={() => handleUndoSkip(meal.mealType)}
                      onSwap={() => handleSwap(meal.mealType)}
                    />
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <Modal visible={setupOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeSetup}>
        <Screen scroll style={styles.setupScreen}>
          <View style={styles.wizardProgress}>
            {[0, 1, 2, 3].map((step) => (
              <View
                key={step}
                style={[
                  styles.wizardDot,
                  step === setupStep ? styles.wizardDotActive : styles.wizardDotInactive,
                ]}
              />
            ))}
          </View>

          {setupStep === 0 ? (
            <View style={styles.wizardStep}>
              <Text style={styles.wizardTitle}>About You</Text>
              <Text style={styles.wizardSubtitle}>We'll calculate your calorie needs</Text>
              <View style={styles.bodyMetricsGrid}>
                <View style={styles.bodyMetricCol}>
                  <Input
                    placeholder="Age"
                    value={form.age}
                    keyboardType="number-pad"
                    onChangeText={(age) => setForm((current) => ({ ...current, age }))}
                  />
                </View>
                <View style={styles.bodyMetricCol}>
                  <Input
                    placeholder="Height cm"
                    value={form.heightCm}
                    keyboardType="decimal-pad"
                    onChangeText={(heightCm) => setForm((current) => ({ ...current, heightCm }))}
                  />
                </View>
                <View style={styles.bodyMetricCol}>
                  <Input
                    placeholder="Weight kg"
                    value={form.weightKg}
                    keyboardType="decimal-pad"
                    onChangeText={(weightKg) => setForm((current) => ({ ...current, weightKg }))}
                  />
                </View>
              </View>
              <Text style={styles.setupLabel}>Sex</Text>
              <View style={styles.sexCardRow}>
                {SEX_OPTIONS.map((option) => {
                  const selected = form.sex === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setForm((current) => ({ ...current, sex: option.key }))}
                      style={[styles.sexCard, selected && styles.sexCardSelected]}
                    >
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.accent} style={styles.sexCardCheck} />
                      ) : null}
                      <Text style={[styles.sexCardText, selected && styles.sexCardTextSelected]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {setupStep === 1 ? (
            <View style={styles.wizardStep}>
              <Text style={styles.wizardTitle}>What's your goal?</Text>
              <View style={styles.goalCardList}>
                {GOAL_OPTIONS.map((option) => {
                  const selected = form.goal === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setForm((current) => ({ ...current, goal: option.key }))}
                      style={[styles.goalCard, selected && styles.goalCardSelected]}
                    >
                      <Ionicons name={option.icon} size={22} color={selected ? colors.accent : colors.textMuted} />
                      <View style={styles.goalCardText}>
                        <Text style={[styles.goalCardTitle, selected && styles.goalCardTitleSelected]}>{option.title}</Text>
                        <Text style={styles.goalCardSubtitle}>{option.subtitle}</Text>
                      </View>
                      {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.accent} /> : null}
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.setupLabel}>Activity Level</Text>
              <View style={styles.foodChips}>
                {ACTIVITY_OPTIONS.map((option) => {
                  const selected = form.activityLevel === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setForm((current) => ({ ...current, activityLevel: option.key }))}
                      style={[styles.foodChip, selected && styles.foodChipSelected]}
                    >
                      <Text style={[styles.foodChipText, selected && styles.foodChipTextSelected]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {setupStep === 2 ? (
            <View style={styles.wizardStep}>
              <Text style={styles.wizardTitle}>Foods around you</Text>
              <Text style={styles.wizardSubtitle}>Pick what's usually available</Text>
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
                <View style={{ flex: 1 }}>
                  <Input placeholder="Add food" value={customFood} onChangeText={setCustomFood} />
                </View>
                <Pressable onPress={addCustomFood} style={styles.addFoodBtn}>
                  <Ionicons name="add" size={20} color={colors.onAccent} />
                </Pressable>
              </View>
              <Input
                placeholder="Diet preference"
                value={form.dietPreference}
                onChangeText={(dietPreference) => setForm((current) => ({ ...current, dietPreference }))}
              />
              <Input
                placeholder="Cooking access"
                value={form.cookingAccess}
                onChangeText={(cookingAccess) => setForm((current) => ({ ...current, cookingAccess }))}
              />
              <Input
                placeholder="Avoidances / allergies, comma separated"
                value={form.avoidances}
                onChangeText={(avoidances) => setForm((current) => ({ ...current, avoidances }))}
              />
            </View>
          ) : null}

          {setupStep === 3 ? (
            <View style={styles.wizardStep}>
              <Text style={styles.wizardTitle}>Stay on track</Text>
              <Pressable
                onPress={() => setForm((current) => ({ ...current, mealReminderEnabled: !current.mealReminderEnabled }))}
                style={styles.reminderCard}
              >
                <View style={styles.reminderCardIcon}>
                  <Ionicons
                    name={form.mealReminderEnabled ? "notifications" : "notifications-off"}
                    size={24}
                    color={colors.accent}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.reminderCardTitle}>Meal reminders</Text>
                  <Text style={styles.reminderCardSubtitle}>
                    Get nudges before each planned meal so you stay consistent.
                  </Text>
                </View>
                <Text style={styles.reminderState}>{form.mealReminderEnabled ? "On" : "Off"}</Text>
              </Pressable>
              <View style={styles.targetsPreview}>
                <Text style={styles.setupLabel}>Estimated targets</Text>
                {profile?.estimatedTargets ? (
                  <View style={styles.targetStrip}>
                    <Text style={styles.targetText}>{profile.estimatedTargets.calories.toLocaleString()} kcal</Text>
                    <Text style={styles.targetText}>{profile.estimatedTargets.protein}g protein</Text>
                    <Text style={styles.targetText}>{profile.estimatedTargets.carbs}g carbs</Text>
                    <Text style={styles.targetText}>{profile.estimatedTargets.fat}g fat</Text>
                  </View>
                ) : (
                  <Text style={styles.targetsPreviewPlaceholder}>
                    Your calorie and macro targets will be calculated when you save.
                  </Text>
                )}
              </View>
            </View>
          ) : null}

          <View style={styles.wizardNav}>
            <Pressable hitSlop={8} onPress={setupStep === 0 ? closeSetup : goToPreviousStep}>
              <Text style={styles.wizardBackText}>{setupStep === 0 ? "Cancel" : "← Back"}</Text>
            </Pressable>
            {setupStep < 3 ? (
              <Button label="Next →" onPress={goToNextStep} />
            ) : (
              <Button
                label="Save & Generate Plan"
                loading={saveProfile.isPending || generatePlan.isPending}
                onPress={handleSaveProfile}
              />
            )}
          </View>
        </Screen>
      </Modal>
    </>
  );
}

function LogFoodSheet({
  visible,
  onClose,
  dayInput,
  logSearch,
  setLogSearch,
  logMealType,
  setLogMealType,
  logQuantityFor,
  setLogQuantityFor,
}: {
  visible: boolean;
  onClose: () => void;
  dayInput: { timezoneOffsetMinutes: number };
  logSearch: string;
  setLogSearch: (value: string) => void;
  logMealType: MealKey;
  setLogMealType: (value: MealKey) => void;
  logQuantityFor: { food: FoodSearchResult; qty: string } | null;
  setLogQuantityFor: (value: { food: FoodSearchResult; qty: string } | null) => void;
}) {
  const router = useRouter();
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => StyleSheet.create(makeLogSheetStyles(colors, shadows, isDark)), [colors, shadows, isDark]);
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const { showToast } = useToast();
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(logSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [logSearch]);

  const {
    data: searchResults = [],
    isFetching: searchFetching,
    isError: searchError,
  } = trpc.nutrition.searchFoods.useQuery(
    { query: debouncedSearch },
    { enabled: debouncedSearch.length > 1 },
  );

  const logMeal = trpc.nutrition.logMeal.useMutation({
    onSuccess: () => {
      utils.nutrition.dailySummary.invalidate(dayInput);
      utils.nutrition.todayMeals.invalidate(dayInput);
      setLogQuantityFor(null);
      setLogSearch("");
      onClose();
      showToast("Food logged", "success");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const submitLog = (food: FoodSearchResult, qtyText: string) => {
    const quantity = Number(qtyText.replace(",", "."));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      showToast("Enter a valid quantity", "error");
      return;
    }
    logMeal.mutate({
      mealType: logMealType,
      items: [
        {
          foodId: food.id ?? undefined,
          fdcId: food.fdcId > 0 ? food.fdcId : undefined,
          name: food.name,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          quantity,
        },
      ],
    });
  };

  const showAddCustom = debouncedSearch.length > 2 && !searchFetching && !searchError && searchResults.length === 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: insets.top }]}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Log Food</Text>
          <Pressable hitSlop={8} onPress={onClose} disabled={logMeal.isPending}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mealTypeRow}
          keyboardShouldPersistTaps="handled"
        >
          {MEAL_TYPES.map((meal) => {
            const selected = logMealType === meal.key;
            return (
              <Pressable
                key={meal.key}
                onPress={() => setLogMealType(meal.key)}
                style={[styles.mealTypePill, selected && styles.mealTypePillSelected]}
              >
                <Text style={[styles.mealTypePillText, selected && styles.mealTypePillTextSelected]}>
                  {meal.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textDim} />
            <TextInput
              value={logSearch}
              onChangeText={setLogSearch}
              placeholder="Search foods (e.g. banana, chicken breast)"
              placeholderTextColor={colors.textDim}
              style={styles.searchInput}
              autoFocus
            />
            {logSearch.length > 0 ? (
              <Pressable hitSlop={8} onPress={() => setLogSearch("")}>
                <Ionicons name="close-circle" size={18} color={colors.textDim} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {searchFetching ? (
          <View style={styles.searchStatus}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null}

        {showAddCustom ? (
          <View style={styles.emptyResults}>
            <Text style={styles.emptyResultsText}>No foods found for "{logSearch.trim()}"</Text>
            <Button
              label="Add custom food"
              onPress={() => {
                onClose();
                router.push("/nutrition-foods");
              }}
            />
          </View>
        ) : null}

        <FlatList
          style={flexFill}
          data={debouncedSearch.length > 1 ? searchResults : []}
          keyExtractor={(item) => foodSearchKey(item)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.resultsList}
          renderItem={({ item }) => {
            const isEditing = logQuantityFor != null && foodSearchKey(logQuantityFor.food) === foodSearchKey(item);
            if (isEditing) {
              return (
                <View style={styles.quantityRow}>
                  <Text style={styles.foodName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <View style={styles.quantityControls}>
                    <Input
                      value={logQuantityFor.qty}
                      onChangeText={(qty) => setLogQuantityFor({ food: item, qty })}
                      keyboardType="decimal-pad"
                      style={styles.quantityInput}
                      autoFocus
                    />
                    <Text style={styles.quantityUnit}>serving</Text>
                    <Button
                      label={logMeal.isPending ? "Logging..." : "Log"}
                      onPress={() => submitLog(item, logQuantityFor.qty)}
                      loading={logMeal.isPending}
                    />
                  </View>
                </View>
              );
            }

            return (
              <Pressable
                style={styles.foodRow}
                onPress={() => setLogQuantityFor({ food: item, qty: "1" })}
                disabled={logMeal.isPending}
              >
                <Text style={styles.foodName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.foodSubtitle} numberOfLines={2}>
                  {formatFoodMacros(item)}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            showAddCustom ? null : debouncedSearch.length > 1 && !searchFetching && !searchError && searchResults.length === 0 ? (
              <Text style={styles.emptyResultsText}>No matching foods</Text>
            ) : logSearch.trim().length === 0 ? (
              <Text style={styles.emptyResultsText}>Search for a food to log it</Text>
            ) : null
          }
        />
      </View>
    </Modal>
  );
}

export default function NutritionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => StyleSheet.create(makeStyles(colors, shadows, isDark)), [colors, shadows, isDark]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const dayInput = useMemo(
    () => ({ timezoneOffsetMinutes: selectedDate.getTimezoneOffset() }),
    [selectedDate],
  );
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [logMealType, setLogMealType] = useState<MealKey>(() => defaultMealType());
  const [logQuantityFor, setLogQuantityFor] = useState<{ food: FoodSearchResult; qty: string } | null>(null);

  const openLogSheet = () => {
    setLogSearch("");
    setLogQuantityFor(null);
    setLogMealType(defaultMealType());
    setLogSheetOpen(true);
  };

  const closeLogSheet = () => {
    if (logSheetOpen) {
      setLogSheetOpen(false);
      setLogQuantityFor(null);
    }
  };

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
    error: summaryErr,
    refetch: refetchSummary,
  } = trpc.nutrition.dailySummary.useQuery(dayInput, {
    staleTime: queryStaleTime.nutritionDaily,
  });
  const { data: meals } = trpc.nutrition.todayMeals.useQuery(dayInput, {
    staleTime: queryStaleTime.nutritionMeals,
  });
  const { data: targets } = trpc.nutrition.getTargets.useQuery(undefined, {
    staleTime: queryStaleTime.nutritionTargets,
  });
  const utils = trpc.useUtils();
  const { showToast } = useToast();
  const [editMealItem, setEditMealItem] = useState<{
    visible: boolean;
    mealItemId?: string;
    foodName?: string;
    quantity?: string;
    portion?: string;
    item?: { food: EditFoodMacros };
  }>({ visible: false });
  const [deleteMealItemDialog, setDeleteMealItemDialog] = useState<{
    visible: boolean;
    mealItemId?: string;
    foodName?: string;
  }>({ visible: false });
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({});

  const updateMeal = trpc.nutrition.updateMeal.useMutation({
    onSuccess: () => {
      setEditMealItem({ visible: false });
      utils.nutrition.dailySummary.invalidate(dayInput);
      utils.nutrition.todayMeals.invalidate(dayInput);
      showToast("Meal updated", "success");
    },
    onError: (error) => showToast(error.message, "error"),
  });
  const deleteMealItem = trpc.nutrition.deleteMealItem.useMutation({
    onSuccess: () => {
      setDeleteMealItemDialog({ visible: false });
      utils.nutrition.dailySummary.invalidate(dayInput);
      utils.nutrition.todayMeals.invalidate(dayInput);
      showToast("Food removed", "success");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const saveEditedMealItem = () => {
    const qty = Number(editMealItem.quantity);
    if (!editMealItem.mealItemId || !Number.isFinite(qty) || qty <= 0) {
      showToast("Enter a valid quantity", "error");
      return;
    }
    updateMeal.mutate({ mealItemId: editMealItem.mealItemId, quantity: qty });
  };

  const cals = summary?.calories ?? 0;
  const macroTargets = summary?.targets ?? targets;
  const calTarget = macroTargets?.calories ?? 0;
  const remaining = calTarget > 0 ? Math.max(0, calTarget - cals) : 0;
  const calRingProgress = calTarget > 0 ? remaining / calTarget : 0;
  const calRingColor = calorieRingColor(calTarget, cals, colors);
  const goalsUnset =
    macroTargets?.configured === false ||
    ((macroTargets?.calories ?? 0) === 0 &&
      (macroTargets?.protein ?? 0) === 0 &&
      (macroTargets?.carbs ?? 0) === 0 &&
      (macroTargets?.fat ?? 0) === 0);

  const groupedMeals = useMemo(() => {
    type TodayMeal = NonNullable<typeof meals>[number];
    const groups: Record<
      string,
      { meal: TodayMeal; items: TodayMeal["items"]; totalCal: number; totalProtein: number }
    > = {};
    for (const meal of meals ?? []) {
      const items = meal.items;
      const totalCal = items.reduce(
        (sum, item) => sum + Math.round((item.food.calories * item.quantity) / (item.food.servingSize ?? 100)),
        0,
      );
      const totalProtein = items.reduce(
        (sum, item) => sum + Math.round((item.food.protein * item.quantity) / (item.food.servingSize ?? 100)),
        0,
      );
      if (items.length > 0) {
        groups[meal.mealType] = { meal, items, totalCal, totalProtein };
      }
    }
    return MEAL_TYPES.map(({ key, label }) => ({ key, label, ...groups[key] })).filter((group) => group.items);
  }, [meals]);

  const loggedDayTotals = useMemo(
    () =>
      groupedMeals.reduce(
        (acc, group) => ({
          totalCal: acc.totalCal + group.totalCal,
          totalProtein: acc.totalProtein + group.totalProtein,
        }),
        { totalCal: 0, totalProtein: 0 },
      ),
    [groupedMeals],
  );

  const isMealExpanded = (mealKey: string) => expandedMeals[mealKey] ?? true;

  const toggleMealExpanded = (mealKey: string) => {
    setExpandedMeals((current) => ({
      ...current,
      [mealKey]: !(current[mealKey] ?? true),
    }));
  };

  const editFood = editMealItem.item?.food;
  const editServingUnit = editFood?.servingUnit?.trim() || "g";
  const editIsGramServing = editServingUnit === "g";
  const editMacros = editFood ? computeEditMacros(editFood, editMealItem.quantity ?? "") : null;
  const editQuantityPlaceholder = editIsGramServing ? "Amount in grams" : "Number of servings";

  return (
    <View style={styles.screenRoot}>
      <Screen scroll padded={false} variant="tab" style={{ backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Nutrition</Text>
          <View style={styles.titleActions}>
            <Pressable hitSlop={8} onPress={() => router.push("/nutrition-foods")} style={styles.goalsBtn}>
              <Ionicons name="fast-food-outline" size={16} color={colors.accent} />
              <Text style={styles.goalsBtnText}>Foods</Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={() => router.push("/nutrition-goals")} style={styles.goalsBtn}>
              <Ionicons name="options-outline" size={16} color={colors.accent} />
              <Text style={styles.goalsBtnText}>Goals</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.dateStepper}>
          <Pressable
            hitSlop={8}
            onPress={() =>
              setSelectedDate((date) => {
                const next = new Date(date);
                next.setDate(next.getDate() - 1);
                return next;
              })
            }
            style={styles.dateStepperArrow}
          >
            <Ionicons name="chevron-back" size={20} color={colors.accent} />
          </Pressable>
          <Pressable onPress={() => setSelectedDate(new Date())} hitSlop={8}>
            <Text style={styles.dateStepperLabel}>
              {isToday
                ? "Today"
                : selectedDate.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </Text>
          </Pressable>
          <Pressable
            hitSlop={8}
            disabled={isToday}
            onPress={() => {
              if (!isToday) {
                setSelectedDate((date) => {
                  const next = new Date(date);
                  next.setDate(next.getDate() + 1);
                  return next;
                });
              }
            }}
            style={[styles.dateStepperArrow, isToday && styles.dateStepperArrowDisabled]}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.accent} />
          </Pressable>
        </View>
      </View>

      {summaryLoading ? (
        <View style={styles.body}>
          <ListSkeleton rows={1} />
        </View>
      ) : summaryError ? (
        <View style={styles.body}>
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Couldn't load summary</Text>
            <Text style={styles.errorMsg}>{summaryErr.message}</Text>
            <Text style={styles.errorHint} onPress={() => refetchSummary()}>
              Tap to retry
            </Text>
          </View>
        </View>
      ) : summary ? (
        <View style={styles.calorieCard}>
          <LinearGradient
            colors={isDark ? [colors.surface, colors.bg] : [colors.bgElevated, colors.bg]}
            style={styles.calorieCardGradient}
          >
            <View style={styles.calHero}>
              <AnimatedCalorieRing
                progress={calRingProgress}
                size={140}
                color={calRingColor}
                track={isDark ? colors.surfaceHover : "#E8E5DE"}
                ticks={56}
                tickLength={14}
              >
                <Text style={[styles.calValue, calTarget === 0 && styles.calValueSmall]}>
                  {calTarget > 0 ? remaining.toLocaleString() : "Set a goal"}
                </Text>
                <Text style={styles.calUnit}>
                  {calTarget > 0 ? "kcal left" : `${cals.toLocaleString()} kcal eaten`}
                </Text>
              </AnimatedCalorieRing>
              <View style={styles.calEatenPills}>
                <View style={styles.calEatenPillGreen}>
                  <Text style={styles.calEatenPillGreenText}>Eaten: {cals.toLocaleString()} kcal</Text>
                </View>
                {calTarget > 0 ? (
                  <View style={styles.calEatenPillMuted}>
                    <Text style={styles.calEatenPillMutedText}>Target: {calTarget.toLocaleString()} kcal</Text>
                  </View>
                ) : (
                  <View style={styles.calEatenPillMuted}>
                    <Text style={styles.calEatenPillMutedText}>Set a goal</Text>
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>
      ) : null}

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
            <View style={styles.macroSection}>
              <Text style={styles.sectionEyebrow}>MACRONUTRIENTS</Text>
              <View style={styles.macroBlock}>
                <MacroBar
                  index={0}
                  label="Carbs"
                  value={summary.carbs}
                  target={macroTargets?.carbs ?? 0}
                  color={colors.carbsColor}
                />
                <MacroBar
                  index={1}
                  label="Protein"
                  value={summary.protein}
                  target={macroTargets?.protein ?? 0}
                  color={colors.proteinColor}
                />
                <MacroBar
                  index={2}
                  label="Fats"
                  value={summary.fat}
                  target={macroTargets?.fat ?? 0}
                  color={colors.fatColor}
                />
              </View>
            </View>
          )
        ) : null}

        <AiMealPlannerSection />

        <View style={styles.loggedSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionEyebrow}>TODAY&apos;S LOG</Text>
            <Text style={styles.sectionHeaderMeta}>{loggedDayTotals.totalCal} kcal</Text>
          </View>
          {groupedMeals.length === 0 ? (
            <View style={styles.loggedEmptyState}>
              <Ionicons name="restaurant-outline" size={40} color={colors.textDim} />
              <Text style={styles.loggedEmptyText}>
                Nothing logged yet today.{"\n"}Tap + to add your first meal.
              </Text>
            </View>
          ) : (
            <>
              {groupedMeals.map((group, groupIndex) => {
                const expanded = isMealExpanded(group.key);
                return (
                  <View key={group.key}>
                    {groupIndex > 0 ? <View style={styles.loggedGroupDivider} /> : null}
                    <Pressable
                      style={styles.loggedGroupHeader}
                      onPress={() => toggleMealExpanded(group.key)}
                    >
                      <Text style={styles.loggedGroupTitle}>{group.label}</Text>
                      <Text style={styles.loggedGroupSubtotal}>
                        {group.totalCal} kcal · {group.totalProtein}g P
                      </Text>
                      <Ionicons
                        name={expanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={colors.textMuted}
                      />
                    </Pressable>
                    {expanded ? (
                      <ListGroup>
                        {group.items.map((item, itemIndex) => {
                          const ratio = item.quantity / (item.food.servingSize ?? 100);
                          const cal = Math.round(item.food.calories * ratio);
                          const protein = Math.round(item.food.protein * ratio);
                          const portion = displayPortion(item);
                          const title = displayFoodName(item.food);
                          const isLast = itemIndex === group.items.length - 1;
                          return (
                            <Animated.View
                              key={`${group.meal.id}-${item.id}`}
                              entering={entranceDown(itemIndex * 60)}
                            >
                              <ListRow
                                title={title}
                                subtitle={`${portion} · ${cal} cal`}
                                icon="restaurant-outline"
                                right={
                                  <View style={styles.loggedActions}>
                                    <View style={styles.loggedProteinPill}>
                                      <Text style={styles.loggedProtein}>{protein}g P</Text>
                                    </View>
                                    <Pressable
                                      hitSlop={8}
                                      style={styles.loggedIconButton}
                                      onPress={() =>
                                        setEditMealItem({
                                          visible: true,
                                          mealItemId: item.id,
                                          foodName: title,
                                          quantity: String(item.quantity),
                                          portion,
                                          item: {
                                            food: {
                                              servingUnit: item.food.servingUnit,
                                              servingSize: item.food.servingSize,
                                              calories: item.food.calories,
                                              protein: item.food.protein,
                                              carbs: item.food.carbs,
                                              fat: item.food.fat,
                                            },
                                          },
                                        })
                                      }
                                    >
                                      <PencilSquareIcon color={colors.accent} size={18} />
                                    </Pressable>
                                    <Pressable
                                      hitSlop={8}
                                      style={styles.loggedIconButton}
                                      onPress={() =>
                                        setDeleteMealItemDialog({
                                          visible: true,
                                          mealItemId: item.id,
                                          foodName: title,
                                        })
                                      }
                                    >
                                      <TrashIcon color={colors.textMuted} size={18} />
                                    </Pressable>
                                  </View>
                                }
                                last={isLast}
                              />
                            </Animated.View>
                          );
                        })}
                      </ListGroup>
                    ) : null}
                  </View>
                );
              })}
              <Text style={styles.loggedDayTotal}>
                Total: {loggedDayTotals.totalCal} kcal · {loggedDayTotals.totalProtein}g P
              </Text>
            </>
          )}
        </View>
      </View>

      <ThemedDialog
        visible={deleteMealItemDialog.visible}
        title="Remove food?"
        message={deleteMealItemDialog.foodName ? `Remove ${deleteMealItemDialog.foodName} from today?` : undefined}
        onDismiss={() => setDeleteMealItemDialog({ visible: false })}
        buttons={[
          { label: "Cancel" },
          {
            label: deleteMealItem.isPending ? "Removing..." : "Remove",
            variant: "destructive",
            onPress: () => {
              if (deleteMealItemDialog.mealItemId) {
                deleteMealItem.mutate({ mealItemId: deleteMealItemDialog.mealItemId });
              }
            },
          },
        ]}
      />

      <Modal
        visible={editMealItem.visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => !updateMeal.isPending && setEditMealItem({ visible: false })}
      >
        <Screen style={styles.editMealScreen}>
          <View style={styles.editMealHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.editMealTitle} numberOfLines={2}>
                {editMealItem.foodName ?? "Edit food"}
              </Text>
              <Text style={styles.editMealSubtitle}>Adjust serving size</Text>
            </View>
            <Pressable hitSlop={8} onPress={() => setEditMealItem({ visible: false })} disabled={updateMeal.isPending}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.editMealCard}>
            <View style={styles.editQuantityRow}>
              <View style={styles.editQuantityInputWrap}>
                <Input
                  placeholder={editQuantityPlaceholder}
                  value={editMealItem.quantity ?? ""}
                  keyboardType="decimal-pad"
                  onChangeText={(quantity) => setEditMealItem((current) => ({ ...current, quantity }))}
                  autoFocus
                />
              </View>
              <Text style={styles.editQuantityUnit}>{editServingUnit}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.editPresetRow}>
              {editIsGramServing
                ? [50, 100, 150, 200].map((preset) => (
                    <Pressable
                      key={preset}
                      style={styles.editPresetPill}
                      onPress={() => setEditMealItem((current) => ({ ...current, quantity: String(preset) }))}
                    >
                      <Text style={styles.editPresetPillText}>{preset}g</Text>
                    </Pressable>
                  ))
                : [
                    { label: "0.5x", value: 0.5 },
                    { label: "1x", value: 1 },
                    { label: "1.5x", value: 1.5 },
                    { label: "2x", value: 2 },
                  ].map((preset) => (
                    <Pressable
                      key={preset.label}
                      style={styles.editPresetPill}
                      onPress={() => setEditMealItem((current) => ({ ...current, quantity: String(preset.value) }))}
                    >
                      <Text style={styles.editPresetPillText}>{preset.label}</Text>
                    </Pressable>
                  ))}
            </ScrollView>
            {editMacros ? (
              <View style={styles.editMacroPreview}>
                {[
                  { label: "Calories", value: `${editMacros.cal} kcal` },
                  { label: "Protein", value: `${editMacros.protein}g` },
                  { label: "Carbs", value: `${editMacros.carbs}g` },
                  { label: "Fat", value: `${editMacros.fat}g` },
                ].map((macro) => (
                  <View key={macro.label} style={styles.editMacroPill}>
                    <Text style={styles.editMacroPillLabel}>{macro.label}</Text>
                    <Text style={styles.editMacroPillValue}>{macro.value}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.editMacroPreviewEmpty}>Enter an amount to preview nutrition</Text>
            )}
            <Button label="Save" fullWidth loading={updateMeal.isPending} onPress={saveEditedMealItem} />
          </View>
        </Screen>
      </Modal>
    </Screen>

      <LogFoodSheet
        visible={logSheetOpen}
        onClose={closeLogSheet}
        dayInput={dayInput}
        logSearch={logSearch}
        setLogSearch={setLogSearch}
        logMealType={logMealType}
        setLogMealType={setLogMealType}
        logQuantityFor={logQuantityFor}
        setLogQuantityFor={setLogQuantityFor}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log food"
        onPress={openLogSheet}
        style={[styles.fab, { bottom: 24 + insets.bottom }, shadows.lg]}
      >
        <Ionicons name="add" size={28} color={colors.onAccent} />
      </Pressable>
    </View>
  );
}

function MacroBar({
  index,
  label,
  value,
  target,
  color,
}: {
  index: number;
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const { colors } = useTheme();
  const progress = target > 0 ? Math.min(1, value / target) : 0;
  const remaining = Math.max(0, target - value);

  return (
    <Animated.View entering={FadeInRight.delay(index * 80).springify().damping(18)} style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...typography.label, color: colors.text, fontWeight: "700" }}>{label}</Text>
        <Text style={{ ...typography.caption, color: colors.textMuted }}>
          {Math.round(value)}g {target > 0 ? `/ ${target}g` : ""}
        </Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceHover, overflow: "hidden" }}>
        <View
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
            width: `${Math.round(progress * 100)}%`,
          }}
        />
      </View>
      {target > 0 ? (
        <Text style={{ ...typography.caption, color: colors.textDim }}>
          {remaining > 0 ? `${Math.round(remaining)}g left` : "Goal reached ✓"}
        </Text>
      ) : null}
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
    emptyPlanBox: {
      position: "relative" as const,
      overflow: "hidden" as const,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      backgroundColor: isDark ? colors.bg : colors.surface,
      padding: spacing.md,
      gap: spacing.md,
    },
    emptyPlanDecoration: {
      position: "absolute" as const,
      right: -8,
      bottom: -8,
      opacity: 0.15,
    },
    emptyPlanTitle: { ...typography.h3, color: colors.text },
    emptyActions: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm },
    planSummaryCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.md,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.accentMuted,
      padding: spacing.md,
      minHeight: 88,
    },
    planSummaryLabel: { ...typography.caption, color: colors.accent, fontWeight: "900" as const, textTransform: "uppercase" as const },
    planSummaryTitle: { ...typography.h3, color: colors.text },
    planSummaryMeta: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.xs },
    planProgressTrack: {
      width: "100%" as const,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderSubtle,
      overflow: "hidden" as const,
      marginTop: spacing.xs,
    },
    planProgressFill: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.accent,
    },
    planToolbar: { flexDirection: "row" as const, alignItems: "center" as const, flexWrap: "wrap" as const, gap: spacing.sm },
    toolbarButton: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: spacing.xs,
      minHeight: 38,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceHover,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      paddingHorizontal: spacing.md,
    },
    toolbarButtonText: { ...typography.label, color: colors.accent, fontWeight: "800" as const },
    planStack: { gap: spacing.md },
    planMealList: { gap: spacing.md },
    planMetaRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md },
    planNote: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 19 },
    iconAction: { width: 38, height: 38, borderRadius: 19, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: colors.surfaceHover },
    planMeal: {
      position: "relative" as const,
      overflow: "hidden" as const,
      borderRadius: radius.md,
      backgroundColor: colors.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      padding: spacing.md,
      gap: spacing.sm,
    },
    planMealAccent: {
      position: "absolute" as const,
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      borderTopLeftRadius: radius.md,
      borderBottomLeftRadius: radius.md,
    },
    planMealDone: { borderColor: colors.success, backgroundColor: colors.successMuted },
    planMealSkipped: { opacity: 0.72 },
    planMealTop: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md },
    mealTime: { ...typography.caption, color: colors.textMuted, fontWeight: "700" as const },
    planMealTitle: { ...typography.h3, color: colors.text },
    planMealMetaRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      flexWrap: "wrap" as const,
      gap: 4,
    },
    planPrepRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
    },
    planMealMeta: { ...typography.caption, color: colors.accent, fontWeight: "700" as const },
    planItemsList: { gap: spacing.xs },
    planItemLine: { ...typography.bodySmall, color: colors.textMuted },
    planActions: { gap: spacing.sm, marginTop: spacing.xs },
    planAteButton: {
      width: "100%" as const,
      minHeight: 38,
      borderRadius: radius.md,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingHorizontal: spacing.sm,
    },
    planSecondaryActions: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
    },
    planIconPill: {
      flex: 1,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: spacing.xs,
      height: 34,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceHover,
      paddingHorizontal: spacing.sm,
    },
    planIconPillText: { ...typography.caption, color: colors.text, fontWeight: "700" as const },
    planLoggedRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    planLoggedText: { ...typography.label, color: colors.success, fontWeight: "800" as const },
    skipUndoBanner: {
      marginTop: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: colors.accentMuted,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: "center" as const,
    },
    skipUndoBannerText: { ...typography.caption, color: colors.accent, fontWeight: "800" as const },
    planButton: { flex: 1, minHeight: 38, borderRadius: radius.md, backgroundColor: colors.surfaceHover, alignItems: "center" as const, justifyContent: "center" as const, paddingHorizontal: spacing.sm },
    planButtonPrimary: { backgroundColor: colors.accent },
    planButtonText: { ...typography.label, color: colors.text, fontWeight: "800" as const },
    planButtonPrimaryText: { ...typography.label, color: colors.onAccent, fontWeight: "800" as const },
    setupScreen: { gap: spacing.lg, paddingBottom: spacing.xxl },
    wizardProgress: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: spacing.sm,
      paddingTop: spacing.sm,
    },
    wizardDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    wizardDotActive: { backgroundColor: colors.accent },
    wizardDotInactive: { backgroundColor: colors.borderSubtle },
    wizardStep: { gap: spacing.lg },
    wizardTitle: { ...typography.h2, color: colors.text },
    wizardSubtitle: { ...typography.bodySmall, color: colors.textMuted, marginTop: -spacing.sm },
    wizardNav: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      gap: spacing.md,
      marginTop: spacing.md,
    },
    wizardBackText: { ...typography.bodySmall, color: colors.accent, fontWeight: "700" as const },
    bodyMetricsGrid: {
      flexDirection: "row" as const,
      gap: spacing.sm,
    },
    bodyMetricCol: { flex: 1, minWidth: 0 },
    sexCardRow: {
      flexDirection: "row" as const,
      gap: spacing.sm,
    },
    sexCard: {
      flex: 1,
      minHeight: 72,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surfaceHover,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      padding: spacing.sm,
      position: "relative" as const,
    },
    sexCardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accentMuted,
    },
    sexCardCheck: { position: "absolute" as const, top: spacing.sm, right: spacing.sm },
    sexCardText: { ...typography.label, color: colors.text, fontWeight: "700" as const },
    sexCardTextSelected: { color: colors.accent },
    goalCardList: { gap: spacing.sm },
    goalCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.md,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surfaceHover,
      padding: spacing.md,
    },
    goalCardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.accentMuted,
    },
    goalCardText: { flex: 1, minWidth: 0, gap: spacing.xs },
    goalCardTitle: { ...typography.h3, color: colors.text },
    goalCardTitleSelected: { color: colors.accent },
    goalCardSubtitle: { ...typography.bodySmall, color: colors.textMuted },
    reminderCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.md,
      minHeight: 88,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surfaceHover,
      padding: spacing.lg,
    },
    reminderCardIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      backgroundColor: colors.accentMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    reminderCardTitle: { ...typography.h3, color: colors.text },
    reminderCardSubtitle: { ...typography.bodySmall, color: colors.textMuted, marginTop: spacing.xs },
    targetsPreview: { gap: spacing.sm },
    targetsPreviewPlaceholder: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 20 },
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

function makeStyles(colors: Palette, shadows: ShadowSet, isDark: boolean) {
  return {
    screenRoot: { flex: 1, position: "relative" as const },
    fab: {
      position: "absolute" as const,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    header: { paddingHorizontal: spacing.lg },
    body: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.sm },
    titleRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    titleActions: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm },
    pageTitle: { flex: 1, ...typography.h1, color: colors.text },
    dateStepper: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    dateStepperArrow: { padding: spacing.sm },
    dateStepperArrowDisabled: { opacity: 0.3 },
    dateStepperLabel: {
      ...typography.label,
      color: colors.text,
      fontWeight: "800" as const,
      minWidth: 120,
      textAlign: "center" as const,
    },
    goalsBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.xs,
      backgroundColor: colors.accentMuted,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      minHeight: TOUCH_TARGET_MIN,
    },
    goalsBtnText: { ...typography.bodySmall, fontWeight: "700" as const, color: colors.accent },

    calorieCard: {
      margin: spacing.lg,
      borderRadius: radius.xl,
      overflow: "hidden" as const,
      ...shadows.md,
    },
    calorieCardGradient: {
      borderRadius: radius.xl,
      padding: spacing.lg,
    },
    calHero: { alignItems: "center" as const, gap: spacing.sm },
    calValue: { fontSize: 22, fontWeight: "800" as const, color: colors.text },
    calValueSmall: { fontSize: 18 },
    calUnit: { ...typography.label, color: colors.textMuted },
    calEatenPills: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      justifyContent: "center" as const,
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    calEatenPillGreen: {
      borderRadius: radius.full,
      backgroundColor: colors.successMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    calEatenPillGreenText: { ...typography.caption, color: colors.success, fontWeight: "700" as const },
    calEatenPillMuted: {
      borderRadius: radius.full,
      backgroundColor: colors.surfaceHover,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    calEatenPillMutedText: { ...typography.caption, color: colors.textMuted, fontWeight: "700" as const },

    macroSection: { gap: spacing.sm },
    sectionEyebrow: {
      ...typography.caption,
      color: colors.textMuted,
      fontWeight: "800" as const,
      textTransform: "uppercase" as const,
      letterSpacing: 1,
    },
    sectionHeaderRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      gap: spacing.sm,
    },
    sectionHeaderMeta: { ...typography.caption, color: colors.accent, fontWeight: "700" as const },

    macroBlock: {
      flexDirection: "column" as const,
      gap: spacing.md,
      backgroundColor: isDark ? colors.surface : colors.bgElevated,
      borderRadius: radius.lg,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border,
      padding: spacing.lg,
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
    loggedEmptyState: {
      alignItems: "center" as const,
      gap: spacing.md,
      paddingVertical: spacing.xl,
    },
    loggedEmptyText: { ...typography.body, color: colors.textMuted, textAlign: "center" as const },
    loggedGroupDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderSubtle,
      marginVertical: spacing.sm,
    },
    loggedGroupHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    loggedGroupTitle: { flex: 1, ...typography.h3, color: colors.text },
    loggedGroupSubtotal: { ...typography.caption, color: colors.accent, fontWeight: "700" as const },
    loggedDayTotal: {
      ...typography.bodySmall,
      color: colors.text,
      fontWeight: "800" as const,
      marginTop: spacing.md,
      textAlign: "right" as const,
    },
    loggedActions: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.xs },
    loggedProteinPill: {
      minWidth: 50,
      minHeight: 30,
      borderRadius: radius.full,
      backgroundColor: colors.accentMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingHorizontal: spacing.sm,
    },
    loggedProtein: { ...typography.label, color: colors.accent, fontWeight: "800" as const },
    loggedIconButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: colors.surfaceHover,
    },
    editMealScreen: { gap: spacing.lg, paddingBottom: spacing.xxl },
    editMealHeader: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      justifyContent: "space-between" as const,
      gap: spacing.md,
    },
    editMealTitle: { ...typography.h2, color: colors.text },
    editMealSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
    editMealCard: {
      gap: spacing.md,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surface,
      padding: spacing.lg,
    },
    editQuantityRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
    },
    editQuantityInputWrap: { flex: 1, minWidth: 0 },
    editQuantityUnit: { ...typography.label, color: colors.textMuted, fontWeight: "700" as const },
    editPresetRow: { gap: spacing.sm, paddingVertical: spacing.xs },
    editPresetPill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceHover,
    },
    editPresetPillText: { ...typography.caption, color: colors.text, fontWeight: "700" as const },
    editMacroPreview: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: spacing.sm,
    },
    editMacroPill: {
      flexGrow: 1,
      flexBasis: "22%" as const,
      minWidth: 72,
      borderRadius: radius.md,
      backgroundColor: colors.accentMuted,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      alignItems: "center" as const,
      gap: spacing.xs,
    },
    editMacroPillLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "600" as const },
    editMacroPillValue: { ...typography.caption, color: colors.accent, fontWeight: "700" as const },
    editMacroPreviewEmpty: { ...typography.bodySmall, color: colors.textMuted, textAlign: "center" as const },

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

function makeLogSheetStyles(colors: Palette, _shadows: ShadowSet, _isDark: boolean) {
  return {
    sheet: { flex: 1, backgroundColor: colors.bg },
    sheetHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    sheetTitle: { ...typography.h2, color: colors.text },
    mealTypeRow: {
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
      paddingBottom: spacing.md,
    },
    mealTypePill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceHover,
      minHeight: 36,
      justifyContent: "center" as const,
    },
    mealTypePillSelected: { backgroundColor: colors.accent },
    mealTypePillText: { ...typography.label, color: colors.text, fontWeight: "700" as const },
    mealTypePillTextSelected: { color: colors.onAccent },
    searchWrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    searchBar: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
      backgroundColor: colors.surfaceHover,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      minHeight: 44,
    },
    searchInput: {
      flex: 1,
      ...typography.body,
      color: colors.text,
      paddingVertical: spacing.sm,
    },
    searchStatus: { paddingVertical: spacing.lg, alignItems: "center" as const },
    resultsList: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
      gap: spacing.sm,
    },
    foodRow: {
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSubtle,
      gap: spacing.xs,
    },
    foodName: { ...typography.body, color: colors.text },
    foodSubtitle: { ...typography.caption, color: colors.textMuted },
    quantityRow: {
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderSubtle,
      gap: spacing.sm,
    },
    quantityControls: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.sm,
    },
    quantityInput: {
      flex: 1,
      minWidth: 72,
      textAlign: "center" as const,
    },
    quantityUnit: { ...typography.bodySmall, color: colors.textMuted },
    emptyResults: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      gap: spacing.md,
      alignItems: "center" as const,
    },
    emptyResultsText: {
      ...typography.bodySmall,
      color: colors.textMuted,
      textAlign: "center" as const,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
    },
  };
}
