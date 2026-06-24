import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  EmptyState,
  ListGroup,
  ListRow,
  Screen,
  SearchBar,
} from "../../src/components/ui";
import { ProgressRing } from "../../src/components/charts";
import { ListSkeleton } from "../../src/components/skeleton";
import { trpc, queryStaleTime } from "../../src/lib/trpc";
import { radius, spacing, useTheme, type Palette, type ShadowSet } from "../../src/lib/theme";

const MEAL_TYPES = [
  { key: "BREAKFAST" as const, label: "Breakfast", icon: "cafe-outline" as const },
  { key: "LUNCH" as const, label: "Lunch", icon: "restaurant-outline" as const },
  { key: "DINNER" as const, label: "Dinner", icon: "pizza-outline" as const },
  { key: "SNACK" as const, label: "Snacks", icon: "nutrition-outline" as const },
];

const MEAL_ACCENT_LIGHT: Record<(typeof MEAL_TYPES)[number]["key"], string> = {
  BREAKFAST: "#FF9A3C",
  LUNCH: "#52C41A",
  DINNER: "#722ED1",
  SNACK: "#13C2C2",
};

type MealKey = (typeof MEAL_TYPES)[number]["key"];

export default function NutritionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, shadows, isDark } = useTheme();
  const styles = useMemo(() => StyleSheet.create(makeStyles(colors, shadows, isDark)), [colors, shadows, isDark]);
  const headerText = isDark ? colors.text : "#1A1A1A";
  const gradientColors = isDark
    ? ([colors.bg, colors.bg] as const)
    : (["#EDF86A", "#6DC643"] as const);

  const [search, setSearch] = useState("");
  const [mealType, setMealType] = useState<MealKey>("LUNCH");
  const [logging, setLogging] = useState(false);
  const [loggingKey, setLoggingKey] = useState<string | null>(null);
  const utils = trpc.useUtils();

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
  const {
    data: foods,
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.nutrition.searchFoods.useQuery({ query: search }, { enabled: search.length >= 2 });

  const logMeal = trpc.nutrition.logMeal.useMutation({
    onSuccess: () => {
      utils.nutrition.dailySummary.invalidate();
      utils.nutrition.todayMeals.invalidate();
      setLoggingKey(null);
      Alert.alert("Logged", "Food added to your daily macros.");
    },
    onError: (err) => {
      setLoggingKey(null);
      Alert.alert("Error", err.message);
    },
  });

  const deleteMeal = trpc.nutrition.deleteMeal.useMutation({
    onSuccess: () => {
      utils.nutrition.dailySummary.invalidate();
      utils.nutrition.todayMeals.invalidate();
    },
    onError: (err) => Alert.alert("Couldn't remove", err.message),
  });

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

  const handleLogFood = (item: NonNullable<typeof foods>[number]) => {
    const key = `${item.source}-${item.fdcId}-${item.name}`;
    if (loggingKey === key || logMeal.isPending) return;
    setLoggingKey(key);
    logMeal.mutate({
      mealType,
      items: [
        {
          foodId: item.id ?? undefined,
          fdcId: item.fdcId > 0 ? item.fdcId : undefined,
          name: item.name,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          quantity: 100,
        },
      ],
    });
  };

  const confirmDeleteMeal = (mealId: string, label: string) => {
    Alert.alert("Remove food?", `Remove ${label} from today's log?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteMeal.mutate({ id: mealId }) },
    ]);
  };

  const openLogger = (key: MealKey) => {
    setMealType(key);
    setLogging(true);
  };

  const cals = summary?.calories ?? 0;
  const macroTargets = summary?.targets ?? targets;
  const calTarget = macroTargets?.calories ?? 2500;

  return (
    <Screen scroll padded={false} style={{ backgroundColor: colors.bg }}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + spacing.sm }]}
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
              <ProgressRing
                size={140}
                progress={cals / Math.max(calTarget, 1)}
                color={colors.accent}
                track={isDark ? colors.surfaceHover : "#E8E5DE"}
                ticks={56}
                tickLength={14}
              >
                <Text style={[styles.calValue, { color: headerText }]}>{cals.toLocaleString()}</Text>
                <Text style={[styles.calTarget, { color: isDark ? colors.textMuted : "#6B6B6B" }]}>
                  / {calTarget.toLocaleString()}
                </Text>
                <Text style={[styles.calUnit, { color: isDark ? colors.textDim : "#A8A8A8" }]}>Calories</Text>
              </ProgressRing>
            </View>
          ) : null}
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {summary && !summaryLoading && !summaryError ? (
          <View style={styles.macroBlock}>
            <MacroRingRow
              label="Carbs"
              value={summary.carbs}
              target={macroTargets?.carbs ?? 0}
              color={colors.carbsColor}
              track={isDark ? undefined : "#E8E5DE"}
            />
            <MacroRingRow
              label="Protein"
              value={summary.protein}
              target={macroTargets?.protein ?? 0}
              color={colors.proteinColor}
              track={isDark ? undefined : "#E8E5DE"}
            />
            <MacroRingRow
              label="Fats"
              value={summary.fat}
              target={macroTargets?.fat ?? 0}
              color={colors.fatColor}
              track={isDark ? undefined : "#E8E5DE"}
            />
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Today&apos;s Meals</Text>
        <View style={styles.mealStack}>
          {MEAL_TYPES.map((meal) => {
            const total = mealTotals[meal.key];
            const accent = !isDark ? MEAL_ACCENT_LIGHT[meal.key] : undefined;
            return (
              <Pressable
                key={meal.key}
                style={({ pressed }) => [
                  styles.mealCard,
                  !isDark && accent ? { borderLeftWidth: 3, borderLeftColor: accent } : null,
                  pressed && styles.pressed,
                ]}
                onPress={() => openLogger(meal.key)}
              >
                <View style={[styles.mealIcon, !isDark && accent ? { backgroundColor: `${accent}18` } : null]}>
                  <Ionicons name={meal.icon} size={22} color={!isDark && accent ? accent : colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mealName}>{meal.label}</Text>
                  <Text style={styles.mealSub}>
                    {total
                      ? `${total.count} item${total.count === 1 ? "" : "s"} · ${Math.round(total.cal)} cal`
                      : "Tap to add food"}
                  </Text>
                </View>
                <View style={styles.addBtn}>
                  <Ionicons
                    name="add"
                    size={22}
                    color={!isDark ? colors.textMuted : colors.onAccent}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>

        {(meals ?? []).length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Logged Today</Text>
            <ListGroup>
              {(meals ?? []).flatMap((meal, mealIndex) =>
                meal.items.map((item, itemIndex) => {
                  const ratio = item.quantity / (item.food.servingSize ?? 100);
                  const cal = Math.round(item.food.calories * ratio);
                  const mealLabel = MEAL_TYPES.find((m) => m.key === meal.mealType)?.label ?? meal.mealType;
                  const isLast =
                    mealIndex === (meals?.length ?? 0) - 1 && itemIndex === meal.items.length - 1;
                  return (
                    <ListRow
                      key={`${meal.id}-${item.id}`}
                      title={item.food.name}
                      subtitle={`${mealLabel} · ${Math.round(item.quantity)}g · ${cal} cal`}
                      icon="restaurant-outline"
                      right={
                        <Pressable
                          hitSlop={8}
                          onPress={() => confirmDeleteMeal(meal.id, item.food.name)}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.textDim} />
                        </Pressable>
                      }
                      last={isLast}
                    />
                  );
                }),
              )}
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
                <Text style={styles.errorMsg}>{error.message}</Text>
                <Text style={styles.errorHint} onPress={() => refetch()}>
                  Tap to retry
                </Text>
              </View>
            ) : (foods ?? []).length === 0 ? (
              <EmptyState icon="search-outline" title="No foods found" message="Try chicken, rice, banana, or egg." />
            ) : (
              <ListGroup>
                {foods?.map((item, index) => {
                  const key = `${item.source}-${item.fdcId}-${item.name}`;
                  return (
                    <ListRow
                      key={key}
                      title={item.name}
                      subtitle={`${Math.round(item.calories)} cal · P${Math.round(item.protein)} C${Math.round(item.carbs)} F${Math.round(item.fat)} · ${item.source}`}
                      icon="restaurant-outline"
                      onPress={loggingKey === key ? undefined : () => handleLogFood(item)}
                      right={
                        <Text style={styles.addLabel}>
                          {loggingKey === key ? "…" : "+100g"}
                        </Text>
                      }
                      last={index === (foods?.length ?? 0) - 1}
                    />
                  );
                })}
              </ListGroup>
            )}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function MacroRingRow({
  label,
  value,
  target,
  color,
  track,
}: {
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
  const safeTarget = Math.max(target, 1);
  const pct = Math.round((value / safeTarget) * 100);
  return (
    <View style={styles.macroRow}>
      <ProgressRing
        size={52}
        progress={value / safeTarget}
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
          {Math.round(value)}g / {target}g
        </Text>
      </View>
    </View>
  );
}

function makeMacroStyles(colors: Palette, isDark: boolean) {
  return {
    macroRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.md },
    macroPct: { fontSize: 11, fontWeight: "800" as const },
    macroLabel: { fontSize: 15, fontWeight: "700" as const, color: colors.text },
    macroValue: { fontSize: 13, color: colors.textMuted },
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
    body: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.lg },
    titleRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    titleActions: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm },
    pageTitle: { flex: 1, fontSize: 30, fontWeight: "800" as const },
    goalsBtn: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
      backgroundColor: isDark ? colors.accentMuted : "rgba(255,255,255,0.55)",
      borderRadius: radius.full,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    goalsBtnText: { fontSize: 14, fontWeight: "700" as const },

    calHero: { alignItems: "center" as const, paddingVertical: spacing.sm },
    calValue: { fontSize: 26, fontWeight: "800" as const },
    calTarget: { fontSize: 12, marginTop: -1 },
    calUnit: { fontSize: 11, fontWeight: "600" as const },

    macroBlock: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      gap: spacing.sm,
      backgroundColor: isDark ? colors.surface : colors.bgElevated,
      borderRadius: radius.lg,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadows.card,
    },

    sectionTitle: isDark
      ? { fontSize: 20, fontWeight: "800" as const, color: colors.text }
      : {
          fontSize: 11,
          fontWeight: "600" as const,
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
      ...shadows.card,
    },
    mealIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.accentMuted,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    mealName: { fontSize: 16, fontWeight: "700" as const, color: colors.text },
    mealSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    addBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: isDark ? colors.accent : colors.surfaceHover,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    pressed: { opacity: 0.7 },

    loggerSection: { gap: spacing.md },
    loggerHeader: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const },
    doneLink: { fontSize: 15, fontWeight: "700" as const, color: colors.accent },
    addLabel: { color: colors.accent, fontWeight: "700" as const, fontSize: 14 },
    errorBox: {
      backgroundColor: colors.dangerMuted,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    errorTitle: { color: colors.danger, fontWeight: "700" as const, fontSize: 16 },
    errorMsg: { color: colors.text, fontSize: 14, lineHeight: 20 },
    errorHint: { color: colors.accent, fontSize: 14, fontWeight: "700" as const, marginTop: spacing.sm },
  };
}
