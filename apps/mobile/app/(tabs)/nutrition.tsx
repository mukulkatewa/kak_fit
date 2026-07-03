import { useRouter } from "expo-router";
import { useEffect, useMemo, useState, type FC, type ReactNode } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOUCH_TARGET_MIN, useBottomSheetInset } from "../../src/lib/layout-constants";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  FireIcon,
  MoonIcon,
  PencilSquareIcon,
  PlusIcon,
  SparklesIcon,
  SunIcon,
  TrashIcon,
} from "react-native-heroicons/outline";
import Animated, {
  FadeIn,
  FadeInRight,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  Button,
  EmptyState,
  Input,
  ListGroup,
  ListRow,
  Screen,
  SearchBar,
  ThemedDialog,
  useToast,
} from "../../src/components/ui";
import { ProgressRing } from "../../src/components/charts";
import { ListSkeleton } from "../../src/components/skeleton";
import { entranceDown, useSpringPress } from "../../src/lib/animations";
import { scheduleMealPlanNotifications } from "../../src/lib/meal-plan-notifications";
import { trpc, queryStaleTime } from "../../src/lib/trpc";
import { radius, spacing, typography, useTheme, type Palette, type ShadowSet } from "../../src/lib/theme";

type MealIcon = FC<{ color?: string; size?: number }>;

const MEAL_TYPES = [
  { key: "BREAKFAST" as const, label: "Breakfast", Icon: SunIcon },
  { key: "LUNCH" as const, label: "Lunch", Icon: FireIcon },
  { key: "DINNER" as const, label: "Dinner", Icon: MoonIcon },
  { key: "SNACK" as const, label: "Snacks", Icon: SparklesIcon },
];

const MEAL_ACCENT_LIGHT: Record<(typeof MEAL_TYPES)[number]["key"], string> = {
  BREAKFAST: "#FF9A3C",
  LUNCH: "#52C41A",
  DINNER: "#722ED1",
  SNACK: "#13C2C2",
};

type MealKey = (typeof MEAL_TYPES)[number]["key"];

type FoodSearchItem = {
  id: string | null;
  fdcId: number;
  name: string;
  brand: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: "local" | "usda";
};

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

type FoodInputModalState = {
  visible: boolean;
  mealItemId?: string;
  food?: FoodSearchItem;
  foodName?: string;
  quantity?: string;
};

const DEFAULT_FOOD_QUANTITY_G = 100;

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

function MealCard({
  index,
  label,
  Icon,
  accent,
  subtitle,
  onPress,
}: {
  index: number;
  label: string;
  Icon: MealIcon;
  accent?: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(
    () => StyleSheet.create(makeStyles(colors, shadows, isDark)),
    [colors, shadows, isDark],
  );
  const { scale, onPressIn, onPressOut } = useSpringPress();
  const iconColor = !isDark && accent ? accent : colors.accent;

  return (
    <Animated.View
      entering={entranceDown(index * 80)}
      style={scale}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          styles.mealCard,
          !isDark && accent ? { borderLeftWidth: 3, borderLeftColor: accent } : null,
        ]}
      >
        <View style={[styles.mealIcon, !isDark && accent ? { backgroundColor: `${accent}18` } : null]}>
          <Icon color={iconColor} size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.mealName}>{label}</Text>
          <Text style={styles.mealSub}>{subtitle}</Text>
        </View>
        <View style={styles.addBtn}>
          <PlusIcon color={!isDark ? colors.textMuted : colors.onAccent} size={20} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

function AnimatedFoodRow({
  item,
  isLast,
  accentColor,
  onPress,
}: {
  item: FoodSearchItem;
  isLast: boolean;
  accentColor: string;
  onPress: () => void;
}) {
  const { scale, onPressIn, onPressOut } = useSpringPress();

  return (
    <Animated.View style={scale}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <ListRow
          title={item.name}
          subtitle={`${Math.round(item.calories)} cal · P${Math.round(item.protein)} C${Math.round(item.carbs)} F${Math.round(item.fat)} · ${item.source}`}
          icon="restaurant-outline"
          right={<PlusIcon color={accentColor} size={22} />}
          last={isLast}
        />
      </Pressable>
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
  const insets = useSafeAreaInsets();
  const bottomSheetInset = useBottomSheetInset();
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => StyleSheet.create(makeStyles(colors, shadows, isDark)), [colors, shadows, isDark]);
  const headerText = isDark ? colors.text : "#1A1A1A";
  const gradientColors = isDark
    ? ([colors.bg, colors.bg] as const)
    : (["#A8E063", "#56AB2F"] as const);

  const [search, setSearch] = useState("");
  const [mealType, setMealType] = useState<MealKey>("LUNCH");
  const [logging, setLogging] = useState(false);
  const [deleteMealDialog, setDeleteMealDialog] = useState<{
    visible: boolean;
    mealItemId?: string;
    label?: string;
  }>({ visible: false });
  const [foodInputModal, setFoodInputModal] = useState<FoodInputModalState>({ visible: false });
  const utils = trpc.useUtils();
  const { showToast } = useToast();

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
  const searchEnabled = search.length >= 2;

  const {
    data: localFoods,
    isLoading: localLoading,
    isError: localError,
    error: localErr,
    refetch: refetchLocal,
  } = trpc.nutrition.searchFoodsLocal.useQuery(
    { query: search },
    { enabled: searchEnabled, staleTime: queryStaleTime.default },
  );

  const excludeNames = useMemo(() => localFoods?.map((f) => f.name) ?? [], [localFoods]);

  const {
    data: usdaFoods,
    isFetching: usdaFetching,
    isError: usdaError,
    error: usdaErr,
    refetch: refetchUsda,
  } = trpc.nutrition.searchFoodsUsda.useQuery(
    { query: search, excludeNames },
    {
      enabled: searchEnabled && localFoods !== undefined && !localLoading && !localError,
      staleTime: queryStaleTime.default,
    },
  );

  const foods = useMemo(() => {
    if (!localFoods) return undefined;
    return [...localFoods, ...(usdaFoods ?? [])];
  }, [localFoods, usdaFoods]);

  const isLoading = localLoading;
  const isError = localError || (usdaError && (localFoods?.length ?? 0) === 0);
  const error = localError ? localErr : usdaErr;
  const refetch = () => {
    void refetchLocal();
    void refetchUsda();
  };
  const usdaLoading = usdaFetching && !usdaFoods;

  const logMeal = trpc.nutrition.logMeal.useMutation({
    onSuccess: () => {
      utils.nutrition.dailySummary.invalidate();
      utils.nutrition.todayMeals.invalidate();
      setFoodInputModal({ visible: false });
      showToast("Food added to your daily macros", "success");
    },
    onError: (err) => showToast(err.message, "error"),
  });

  const deleteMealItem = trpc.nutrition.deleteMealItem.useMutation({
    onSuccess: () => {
      setDeleteMealDialog({ visible: false });
      utils.nutrition.dailySummary.invalidate();
      utils.nutrition.todayMeals.invalidate();
      showToast("Food removed", "success");
    },
    onError: (err) => showToast(err.message, "error"),
  });

  const updateMeal = trpc.nutrition.updateMeal.useMutation({
    onSuccess: () => {
      utils.nutrition.dailySummary.invalidate();
      utils.nutrition.todayMeals.invalidate();
      setFoodInputModal({ visible: false });
      showToast("Quantity updated", "success");
    },
    onError: (err) => showToast(err.message, "error"),
  });

  const isAddingFood = foodInputModal.visible && foodInputModal.food != null;
  const isEditingFood = foodInputModal.visible && foodInputModal.mealItemId != null;
  const isSavingFood = logMeal.isPending || updateMeal.isPending;

  const mealTotals = useMemo(() => {
    const totals: Record<string, { cal: number; count: number }> = {};
    for (const meal of meals ?? []) {
      const t = totals[meal.mealType] ?? { cal: 0, count: 0 };
      for (const item of meal.items) {
        const ratio = item.quantity / (item.food.servingSize ?? 100);
        t.cal += item.food.calories * ratio;
      }
      t.count += meal.items.length;
      totals[meal.mealType] = t;
    }
    return totals;
  }, [meals]);

  const handleLogFood = (item: FoodSearchItem) => {
    setFoodInputModal({
      visible: true,
      food: item,
      foodName: item.name,
      quantity: String(DEFAULT_FOOD_QUANTITY_G),
    });
  };

  const confirmDeleteMealItem = (mealItemId: string, label: string) => {
    setDeleteMealDialog({ visible: true, mealItemId, label });
  };

  const openEditFood = (mealItemId: string, foodName: string, quantity: number) => {
    setFoodInputModal({
      visible: true,
      mealItemId,
      foodName,
      quantity: String(Math.round(quantity)),
    });
  };

  const closeFoodInputModal = () => {
    if (isSavingFood) return;
    setFoodInputModal({ visible: false });
  };

  const saveFoodInput = () => {
    const qty = Number(foodInputModal.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      showToast("Enter a positive number of grams", "error");
      return;
    }

    if (foodInputModal.mealItemId) {
      updateMeal.mutate({ mealItemId: foodInputModal.mealItemId, quantity: qty });
      return;
    }

    const food = foodInputModal.food;
    if (!food) return;

    logMeal.mutate({
      mealType,
      items: [
        {
          foodId: food.id ?? undefined,
          fdcId: food.fdcId > 0 ? food.fdcId : undefined,
          name: food.name,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          quantity: qty,
        },
      ],
    });
  };

  const openLogger = (key: MealKey) => {
    setMealType(key);
    setLogging(true);
  };

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
        <AiMealPlannerSection />

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

        <Text style={styles.sectionTitle}>Today's Meals</Text>
        <View style={styles.mealStack}>
          {MEAL_TYPES.map((meal, index) => {
            const total = mealTotals[meal.key];
            const accent = !isDark ? MEAL_ACCENT_LIGHT[meal.key] : undefined;
            return (
              <MealCard
                key={meal.key}
                index={index}
                label={meal.label}
                Icon={meal.Icon}
                accent={accent}
                subtitle={
                  total
                    ? `${total.count} item${total.count === 1 ? "" : "s"} · ${Math.round(total.cal)} cal`
                    : "Tap to add food"
                }
                onPress={() => openLogger(meal.key)}
              />
            );
          })}
        </View>

        {loggedItems.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Logged Today</Text>
            <ListGroup>
              {loggedItems.map(({ meal, item }, flatIndex) => {
                const ratio = item.quantity / (item.food.servingSize ?? 100);
                const cal = Math.round(item.food.calories * ratio);
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
                      right={
                        <View style={styles.mealRowActions}>
                          <Pressable
                            hitSlop={8}
                            onPress={() => openEditFood(item.id, item.food.name, item.quantity)}
                          >
                            <PencilSquareIcon color={colors.accent} size={18} />
                          </Pressable>
                          <Pressable
                            hitSlop={8}
                            onPress={() => confirmDeleteMealItem(item.id, item.food.name)}
                          >
                            <TrashIcon color={colors.textDim} size={18} />
                          </Pressable>
                        </View>
                      }
                      last={isLast}
                    />
                  </Animated.View>
                );
              })}
            </ListGroup>
          </>
        ) : null}

        {logging ? (
          <View style={styles.loggerSection}>
            <View style={styles.loggerHeader}>
              <Text style={styles.sectionTitle}>
                Add to {MEAL_TYPES.find((m) => m.key === mealType)?.label}
              </Text>
              <Pressable hitSlop={8} onPress={() => setLogging(false)}>
                <Text style={styles.doneLink}>Done</Text>
              </Pressable>
            </View>

            <SearchBar
              value={search}
              onChangeText={setSearch}
              placeholder="Search foods (e.g. chicken, rice, egg)"
            />

            {search.length < 2 ? (
              <EmptyState
                icon="search-outline"
                title="Search to log food"
                message="Type at least 2 characters. Results come from USDA + your saved foods."
              />
            ) : isLoading ? (
              <ListSkeleton rows={6} />
            ) : isError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>Search failed</Text>
                <Text style={styles.errorMsg}>{error?.message}</Text>
                <Text style={styles.errorHint} onPress={() => refetch()}>
                  Tap to retry
                </Text>
              </View>
            ) : (foods ?? []).length === 0 ? (
              <EmptyState icon="search-outline" title="No foods found" message="Try chicken, rice, banana, or egg." />
            ) : (
              <Animated.View entering={FadeIn.duration(400)}>
                {usdaLoading ? (
                  <Text style={styles.usdaLoadingHint}>Loading more results from USDA…</Text>
                ) : null}
                <ListGroup>
                  {foods?.map((item, index) => (
                    <AnimatedFoodRow
                      key={`${item.source}-${item.fdcId}-${item.name}`}
                      item={item}
                      isLast={index === (foods?.length ?? 0) - 1}
                      accentColor={colors.accent}
                      onPress={() => handleLogFood(item)}
                    />
                  ))}
                </ListGroup>
              </Animated.View>
            )}
          </View>
        ) : null}
      </View>

      <ThemedDialog
        visible={deleteMealDialog.visible}
        title="Remove food?"
        message={
          deleteMealDialog.label
            ? `Remove ${deleteMealDialog.label} from today's log?`
            : undefined
        }
        onDismiss={() => setDeleteMealDialog({ visible: false })}
        buttons={[
          { label: "Cancel" },
          {
            label: "Remove",
            variant: "destructive",
            onPress: () => {
              if (deleteMealDialog.mealItemId) {
                deleteMealItem.mutate({ mealItemId: deleteMealDialog.mealItemId });
              }
            },
          },
        ]}
      />

      <Modal
        visible={foodInputModal.visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeFoodInputModal}
      >
        <View style={[styles.editModal, { paddingTop: insets.top + spacing.sm, paddingBottom: bottomSheetInset }]}>
          <View style={styles.editModalHeader}>
            <Text style={styles.editModalTitle}>
              {isEditingFood ? "Edit quantity" : "Add food"}
            </Text>
            <Pressable hitSlop={8} onPress={closeFoodInputModal} disabled={isSavingFood}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <Text style={styles.editFoodName}>{foodInputModal.foodName}</Text>
          {isAddingFood && foodInputModal.food ? (
            <Text style={styles.foodMacroHint}>
              {Math.round(foodInputModal.food.calories)} cal per {DEFAULT_FOOD_QUANTITY_G}g · P
              {Math.round(foodInputModal.food.protein)} C{Math.round(foodInputModal.food.carbs)} F
              {Math.round(foodInputModal.food.fat)}
            </Text>
          ) : null}
          <Input
            placeholder="Quantity (g)"
            value={foodInputModal.quantity ?? ""}
            onChangeText={(quantity) => setFoodInputModal((prev) => ({ ...prev, quantity }))}
            keyboardType="decimal-pad"
            autoFocus
          />
          <Button
            label={isEditingFood ? "Save" : "Add to meal"}
            fullWidth
            onPress={saveFoodInput}
            loading={isSavingFood}
          />
        </View>
      </Modal>
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
    <Animated.View entering={FadeInRight.delay(index * 100).springify().damping(16)} style={styles.macroRow}>
      <ProgressRing
        size={52}
        progress={progress}
        color={color}
        track={track}
        ticks={28}
        tickLength={7}
        tickWidth={2}
      >
        <Text style={[styles.macroPct, { color }]}>{pct}%</Text>
      </ProgressRing>
      <View>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>
          {Math.round(value)}g / {target > 0 ? `${target}g` : "—"}
        </Text>
      </View>
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
    macroRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md },
    macroPct: { ...typography.label, fontWeight: "800" as const },
    macroLabel: { ...typography.body, fontWeight: "700" as const, color: colors.text },
    macroValue: { ...typography.caption, color: colors.textMuted },
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
    body: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingTop: spacing.lg },
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
      justifyContent: "space-between" as const,
      gap: spacing.sm,
      backgroundColor: isDark ? colors.surface : colors.bgElevated,
      borderRadius: radius.lg,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border,
      padding: spacing.md,
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

    sectionTitle: isDark
      ? { ...typography.h2, color: colors.text }
      : {
          ...typography.label,
          letterSpacing: 1.2,
          textTransform: "uppercase" as const,
          color: colors.textMuted,
        },

    mealStack: { gap: spacing.md },
    mealCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.md,
      backgroundColor: isDark ? colors.bg : colors.bgElevated,
      borderRadius: 16,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border,
      padding: spacing.md,
      overflow: "hidden" as const,
      ...shadows.md,
    },
    mealIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.accentMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    mealName: { ...typography.h3, color: colors.text },
    mealSub: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? colors.accent : colors.surfaceHover,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },

    mealRowActions: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md },
    editModal: {
      flex: 1,
      ...(Platform.OS === "web" ? { minHeight: 0, height: "100%" as const } : null),
      backgroundColor: colors.bg,
      paddingHorizontal: spacing.lg,
      gap: spacing.lg,
    },
    editModalHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
    },
    editModalTitle: { ...typography.h2, color: colors.text },
    editFoodName: { ...typography.h3, fontWeight: "600" as const, color: colors.textMuted },
    foodMacroHint: { ...typography.caption, color: colors.textDim },

    loggerSection: { gap: spacing.md },
    loggerHeader: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
    doneLink: { ...typography.body, fontWeight: "700" as const, color: colors.accent },
    usdaLoadingHint: { ...typography.caption, color: colors.textMuted, fontStyle: "italic" as const },
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
