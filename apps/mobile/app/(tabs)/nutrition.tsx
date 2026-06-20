import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  EmptyState,
  ListRow,
  Screen,
  SearchBar,
  SectionHeader,
  Title,
} from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors, radius, spacing } from "../../src/lib/theme";

const MEAL_TYPES = [
  { key: "BREAKFAST" as const, label: "Breakfast", icon: "sunny-outline" as const },
  { key: "LUNCH" as const, label: "Lunch", icon: "restaurant-outline" as const },
  { key: "DINNER" as const, label: "Dinner", icon: "moon-outline" as const },
  { key: "SNACK" as const, label: "Snack", icon: "cafe-outline" as const },
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
      <Title>Meals</Title>
      <Text style={styles.subtitle}>USDA FoodData Central · Zero platform cost</Text>

      {summaryLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : summary ? (
        <View style={styles.macroRow}>
          <MacroCard label="Cal" value={summary.calories} target={summary.targets.calories} color={colors.accent} />
          <MacroCard label="Protein" value={summary.protein} target={summary.targets.protein} color={colors.successNeon} />
          <MacroCard label="Carbs" value={summary.carbs} target={summary.targets.carbs} color={colors.accentNeon} />
          <MacroCard label="Fat" value={summary.fat} target={summary.targets.fat} color={colors.gold} />
        </View>
      ) : null}

      <SectionHeader title="Meal Builder" />
      <View style={styles.mealTypeRow}>
        {MEAL_TYPES.map((meal) => (
          <Pressable
            key={meal.key}
            onPress={() => setMealType(meal.key)}
            style={[styles.mealChip, mealType === meal.key && styles.mealChipActive]}
          >
            <Text style={[styles.mealChipText, mealType === meal.key && styles.mealChipTextActive]}>
              {meal.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <SearchBar
        value={search}
        onChangeText={setSearch}
        placeholder="Search foods (USDA database)..."
      />

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
            <EmptyState
              icon="search-outline"
              title="No foods found"
              message="Try a different search term."
            />
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              subtitle={`${Math.round(item.calories)} cal · P${Math.round(item.protein)}g C${Math.round(item.carbs)}g F${Math.round(item.fat)}g per 100g`}
              icon="restaurant-outline"
              onPress={() => handleLogFood(item)}
              right={
                <Text style={styles.addLabel}>
                  {logMeal.isPending ? "…" : "+100g"}
                </Text>
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
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: -8 },
  macroRow: { flexDirection: "row", gap: spacing.sm },
  macroCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: "center",
    gap: 2,
  },
  macroValue: { fontSize: 18, fontWeight: "800" },
  macroLabel: { fontSize: 10, color: colors.textMuted, fontWeight: "600" },
  macroTrack: {
    width: "100%",
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginTop: 4,
    overflow: "hidden",
  },
  macroFill: { height: "100%", borderRadius: 2 },
  mealTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  mealChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mealChipActive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  mealChipText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  mealChipTextActive: { color: colors.accentNeon },
  list: { gap: spacing.sm },
  addLabel: { color: colors.successNeon, fontWeight: "700", fontSize: 13 },
});
