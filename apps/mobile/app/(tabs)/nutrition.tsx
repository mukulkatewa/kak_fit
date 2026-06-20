import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from "react-native";
import {
  Chip,
  EmptyState,
  Header,
  ListRow,
  ProgressBar,
  Screen,
  SearchBar,
  SectionHeader,
} from "../../src/components/ui";
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
  const { data: foods, isLoading } = trpc.nutrition.searchFoods.useQuery(
    { query: search },
    { enabled: search.length >= 2 },
  );

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
          fdcId: item.fdcId || undefined,
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
      <Header eyebrow="NUTRITION" title="Meals" subtitle="USDA FoodData Central · Free" />

      {summaryLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : summary ? (
        <View style={styles.macroRow}>
          <MacroCard label="CAL" value={summary.calories} target={summary.targets.calories} color={colors.accentBright} />
          <MacroCard label="PROTEIN" value={summary.protein} target={summary.targets.protein} color={colors.successNeon} />
          <MacroCard label="CARBS" value={summary.carbs} target={summary.targets.carbs} color={colors.accentNeon} />
          <MacroCard label="FAT" value={summary.fat} target={summary.targets.fat} color={colors.gold} />
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

      <SearchBar value={search} onChangeText={setSearch} placeholder="Search foods (USDA database)..." />

      {search.length < 2 ? (
        <EmptyState
          icon="nutrition-outline"
          title="Search to log food"
          message="Type at least 2 characters. Tap a result to log 100g to your selected meal."
        />
      ) : isLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <FlatList
          data={foods ?? []}
          keyExtractor={(item) => `${item.source}-${item.fdcId}-${item.name}`}
          scrollEnabled={false}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState icon="search-outline" title="No foods found" message="Try a different search term." />
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              subtitle={`${Math.round(item.calories)} cal · P${Math.round(item.protein)} C${Math.round(item.carbs)} F${Math.round(item.fat)} / 100g`}
              icon="restaurant-outline"
              onPress={() => handleLogFood(item)}
              right={
                <View style={styles.addPill}>
                  <Text style={styles.addLabel}>{logMeal.isPending ? "…" : "+100g"}</Text>
                </View>
              }
            />
          )}
        />
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
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    gap: 4,
  },
  macroValue: { fontSize: 20, fontWeight: "800" },
  macroLabel: { fontSize: 9, color: colors.textMuted, fontWeight: "700", letterSpacing: 0.5 },
  macroTrackWrap: { width: "100%", marginTop: 2 },
  mealTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  list: { gap: spacing.sm, paddingTop: spacing.xs },
  addPill: {
    backgroundColor: colors.successMuted,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.success,
  },
  addLabel: { color: colors.successNeon, fontWeight: "700", fontSize: 12 },
});
