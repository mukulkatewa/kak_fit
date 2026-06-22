import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  EmptyState,
  ListGroup,
  ListRow,
  Screen,
  SearchBar,
} from "../../src/components/ui";
import { ProgressRing } from "../../src/components/charts";
import { ListSkeleton } from "../../src/components/skeleton";
import { trpc } from "../../src/lib/trpc";
import { radius, shadows, spacing, useTheme, useThemedStyles, type Palette } from "../../src/lib/theme";

const MEAL_TYPES = [
  { key: "BREAKFAST" as const, label: "Breakfast", icon: "cafe-outline" as const },
  { key: "LUNCH" as const, label: "Lunch", icon: "restaurant-outline" as const },
  { key: "DINNER" as const, label: "Dinner", icon: "pizza-outline" as const },
  { key: "SNACK" as const, label: "Snacks", icon: "nutrition-outline" as const },
];

type MealKey = (typeof MEAL_TYPES)[number]["key"];

export default function NutritionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [search, setSearch] = useState("");
  const [mealType, setMealType] = useState<MealKey>("LUNCH");
  const [logging, setLogging] = useState(false);
  const utils = trpc.useUtils();

  const { data: summary, isLoading: summaryLoading } = trpc.nutrition.dailySummary.useQuery();
  const { data: meals } = trpc.nutrition.todayMeals.useQuery();
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
      Alert.alert("Logged", "Food added to your daily macros.");
    },
    onError: (err) => Alert.alert("Error", err.message),
  });

  // Per-meal calorie totals for "Today's Meals"
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
    logMeal.mutate({
      mealType,
      items: [
        {
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

  const openLogger = (key: MealKey) => {
    setMealType(key);
    setLogging(true);
  };

  const cals = summary?.calories ?? 0;
  const calTarget = summary?.targets.calories ?? 2500;

  return (
    <Screen scroll padded={false}>
      <View style={styles.pad}>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Nutrition</Text>
          <Pressable hitSlop={8} onPress={() => router.push("/nutrition-goals")} style={styles.goalsBtn}>
            <Ionicons name="options-outline" size={16} color={colors.accent} />
            <Text style={styles.goalsBtnText}>Goals</Text>
          </Pressable>
        </View>

        {/* Daily calories + macro rings */}
        {summaryLoading ? (
          <ListSkeleton rows={2} />
        ) : summary ? (
          <View style={styles.summaryCard}>
            <View style={styles.calBlock}>
              <ProgressRing size={132} progress={cals / Math.max(calTarget, 1)} ticks={56} tickLength={14}>
                <Text style={styles.calValue}>{cals.toLocaleString()}</Text>
                <Text style={styles.calTarget}>/ {calTarget.toLocaleString()}</Text>
                <Text style={styles.calUnit}>Calories</Text>
              </ProgressRing>
            </View>
            <View style={styles.macroBlock}>
              <MacroRingRow
                label="Protein"
                value={summary.protein}
                target={summary.targets.protein}
                color={colors.accent}
              />
              <MacroRingRow
                label="Carbs"
                value={summary.carbs}
                target={summary.targets.carbs}
                color={colors.accentBright}
              />
              <MacroRingRow
                label="Fats"
                value={summary.fat}
                target={summary.targets.fat}
                color={colors.gold}
              />
            </View>
          </View>
        ) : null}

        {/* Today's Meals */}
        <Text style={styles.sectionTitle}>Today&apos;s Meals</Text>
        <View style={styles.mealStack}>
          {MEAL_TYPES.map((meal) => {
            const total = mealTotals[meal.key];
            return (
              <Pressable
                key={meal.key}
                style={({ pressed }) => [styles.mealCard, pressed && styles.pressed]}
                onPress={() => openLogger(meal.key)}
              >
                <View style={styles.mealIcon}>
                  <Ionicons name={meal.icon} size={22} color={colors.accent} />
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
                  <Ionicons name="add" size={22} color={colors.onAccent} />
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Food logger (revealed when adding to a meal) */}
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
                {foods?.map((item, index) => (
                  <ListRow
                    key={`${item.source}-${item.fdcId}-${item.name}`}
                    title={item.name}
                    subtitle={`${Math.round(item.calories)} cal · P${Math.round(item.protein)} C${Math.round(item.carbs)} F${Math.round(item.fat)} · ${item.source}`}
                    icon="restaurant-outline"
                    onPress={() => handleLogFood(item)}
                    right={<Text style={styles.addLabel}>{logMeal.isPending ? "…" : "+100g"}</Text>}
                    last={index === (foods?.length ?? 0) - 1}
                  />
                ))}
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
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const safeTarget = Math.max(target, 1);
  const pct = Math.round((value / safeTarget) * 100);
  return (
    <View style={styles.macroRow}>
      <ProgressRing size={52} progress={value / safeTarget} color={color} ticks={28} tickLength={7} tickWidth={2}>
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

const makeStyles = (colors: Palette) => StyleSheet.create({
  pad: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs },
  pageTitle: { fontSize: 30, fontWeight: "800", color: colors.text },
  goalsBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.accentMuted, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 12 },
  goalsBtnText: { color: colors.accent, fontSize: 14, fontWeight: "700" },

  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.card,
  },
  calBlock: { alignItems: "center", justifyContent: "center" },
  calValue: { fontSize: 24, fontWeight: "800", color: colors.text },
  calTarget: { fontSize: 12, color: colors.textMuted, marginTop: -1 },
  calUnit: { fontSize: 11, color: colors.textDim, fontWeight: "600" },
  macroBlock: { flex: 1, gap: spacing.md },
  macroRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  macroPct: { fontSize: 11, fontWeight: "800" },
  macroLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
  macroValue: { fontSize: 13, color: colors.textMuted },

  sectionTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  mealStack: { gap: spacing.md },
  mealCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.card,
  },
  mealIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  mealName: { fontSize: 16, fontWeight: "700", color: colors.text },
  mealSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7 },

  loggerSection: { gap: spacing.md },
  loggerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  doneLink: { fontSize: 15, fontWeight: "700", color: colors.accent },
  addLabel: { color: colors.accent, fontWeight: "700", fontSize: 14 },
  errorBox: {
    backgroundColor: colors.dangerMuted,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  errorTitle: { color: colors.danger, fontWeight: "700", fontSize: 16 },
  errorMsg: { color: colors.text, fontSize: 14, lineHeight: 20 },
  errorHint: { color: colors.accent, fontSize: 14, fontWeight: "700", marginTop: spacing.sm },
});
