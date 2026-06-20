import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import {
  Chip,
  EmptyState,
  Header,
  ListGroup,
  ListRow,
  ProgressBar,
  Screen,
  SearchBar,
  SectionHeader,
} from "../../src/components/ui";
import { ListSkeleton } from "../../src/components/skeleton";
import { trpc } from "../../src/lib/trpc";
import { colors, radius, spacing } from "../../src/lib/theme";

const MEAL_TYPES = [
  { key: "BREAKFAST" as const, label: "Breakfast" },
  { key: "LUNCH" as const, label: "Lunch" },
  { key: "DINNER" as const, label: "Dinner" },
  { key: "SNACK" as const, label: "Snack" },
];

export default function NutritionScreen() {
  const [search, setSearch] = useState("");
  const [mealType, setMealType] = useState<(typeof MEAL_TYPES)[number]["key"]>("LUNCH");
  const utils = trpc.useUtils();

  const { data: summary, isLoading: summaryLoading } = trpc.nutrition.dailySummary.useQuery();
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
      Alert.alert("Logged", "Food added to your daily macros.");
    },
    onError: (err) => Alert.alert("Error", err.message),
  });

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

  return (
    <Screen scroll>
      <Header title="Meals" subtitle="USDA FoodData Central" />

      {summaryLoading ? (
        <ListSkeleton rows={2} />
      ) : summary ? (
        <View style={styles.macroRow}>
          <MacroCard label="Cal" value={summary.calories} target={summary.targets.calories} color={colors.text} />
          <MacroCard label="Protein" value={summary.protein} target={summary.targets.protein} color={colors.accent} />
          <MacroCard label="Carbs" value={summary.carbs} target={summary.targets.carbs} color={colors.success} />
          <MacroCard label="Fat" value={summary.fat} target={summary.targets.fat} color={colors.gold} />
        </View>
      ) : null}

      <SectionHeader title="Log Food" />
      <View style={styles.mealTypeRow}>
        {MEAL_TYPES.map((meal) => (
          <Chip
            key={meal.key}
            label={meal.label}
            active={mealType === meal.key}
            onPress={() => setMealType(meal.key)}
          />
        ))}
      </View>

      <SearchBar value={search} onChangeText={setSearch} placeholder="Search foods (e.g. chicken, rice, egg)" />

      {search.length < 2 ? (
        <EmptyState
          icon="nutrition-outline"
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
    </Screen>
  );
}

function MacroCard({
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
  const pct = Math.min((value / target) * 100, 100);
  return (
    <View style={styles.macroCard}>
      <Text style={[styles.macroValue, { color }]}>{Math.round(value)}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
      <View style={styles.macroTrackWrap}>
        <ProgressBar pct={pct} color={color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  macroRow: { flexDirection: "row", gap: spacing.sm },
  macroCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    gap: 4,
  },
  macroValue: { fontSize: 18, fontWeight: "700" },
  macroLabel: { fontSize: 11, color: colors.textMuted },
  macroTrackWrap: { width: "100%", marginTop: 2 },
  mealTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  addLabel: { color: colors.accent, fontWeight: "600", fontSize: 14 },
  errorBox: {
    backgroundColor: colors.dangerMuted,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  errorTitle: { color: colors.danger, fontWeight: "700", fontSize: 16 },
  errorMsg: { color: colors.text, fontSize: 14, lineHeight: 20 },
  errorHint: { color: colors.accent, fontSize: 14, fontWeight: "600", marginTop: spacing.sm },
});
