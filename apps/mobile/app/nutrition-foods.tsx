import { Ionicons } from "@expo/vector-icons";
import type { RouterOutputs } from "@kak-fit/api/router";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Card, EmptyState, ListGroup, ListRow, Screen, SectionHeader } from "../src/components/ui";
import { trpc } from "../src/lib/trpc";
import { radius, spacing, useTheme, useThemedStyles, type Palette } from "../src/lib/theme";

type CustomFood = RouterOutputs["nutrition"]["listCustomFoods"][number];

type FoodForm = {
  name: string;
  brand: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  servingSize: string;
  servingUnit: string;
};

const EMPTY_FORM: FoodForm = {
  name: "",
  brand: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  fiber: "",
  servingSize: "100",
  servingUnit: "g",
};

function numberValue(value: string, fallback = 0) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formFromFood(food: CustomFood): FoodForm {
  return {
    name: food.name,
    brand: food.brand ?? "",
    calories: String(food.calories),
    protein: String(food.protein),
    carbs: String(food.carbs),
    fat: String(food.fat),
    fiber: food.fiber != null ? String(food.fiber) : "",
    servingSize: String(food.servingSize ?? 100),
    servingUnit: food.servingUnit ?? "g",
  };
}

export default function NutritionFoodsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const utils = trpc.useUtils();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomFood | null>(null);
  const [form, setForm] = useState<FoodForm>(EMPTY_FORM);

  const { data: foods, isLoading } = trpc.nutrition.listCustomFoods.useQuery();

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const onSaved = () => {
    utils.nutrition.listCustomFoods.invalidate();
    utils.nutrition.searchFoods.invalidate();
    closeForm();
  };

  const createFood = trpc.nutrition.createCustomFood.useMutation({
    onSuccess: onSaved,
    onError: (error) => Alert.alert("Could not save food", error.message),
  });

  const updateFood = trpc.nutrition.updateCustomFood.useMutation({
    onSuccess: onSaved,
    onError: (error) => Alert.alert("Could not update food", error.message),
  });

  const deleteFood = trpc.nutrition.deleteCustomFood.useMutation({
    onSuccess: () => {
      utils.nutrition.listCustomFoods.invalidate();
      utils.nutrition.searchFoods.invalidate();
    },
    onError: (error) => Alert.alert("Could not delete food", error.message),
  });

  useEffect(() => {
    if (!editing) return;
    setForm(formFromFood(editing));
    setFormOpen(true);
  }, [editing]);

  const setField = (key: keyof FoodForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveFood = () => {
    const name = form.name.trim();
    if (name.length < 2) {
      Alert.alert("Name required", "Add a food name before saving.");
      return;
    }

    const payload = {
      name,
      brand: form.brand.trim() || null,
      calories: numberValue(form.calories),
      protein: numberValue(form.protein),
      carbs: numberValue(form.carbs),
      fat: numberValue(form.fat),
      fiber: form.fiber.trim() ? numberValue(form.fiber) : null,
      servingSize: numberValue(form.servingSize, 100),
      servingUnit: form.servingUnit.trim() || "g",
    };

    if (editing) {
      updateFood.mutate({ id: editing.id, ...payload });
    } else {
      createFood.mutate(payload);
    }
  };

  const confirmDelete = (food: CustomFood) => {
    Alert.alert("Delete food?", `Delete ${food.name} from your saved foods?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteFood.mutate({ id: food.id }) },
    ]);
  };

  const saving = createFood.isPending || updateFood.isPending;

  return (
    <Screen scroll padded={false}>
      <View style={styles.pad}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.accent} />
          </Pressable>
          <Text style={styles.title}>Saved Foods</Text>
          <Pressable
            onPress={() => {
              setEditing(null);
              setForm(EMPTY_FORM);
              setFormOpen((open) => !open);
            }}
            hitSlop={8}
            style={styles.addBtn}
          >
            <Ionicons name={formOpen ? "close" : "add"} size={22} color={colors.onAccent} />
          </Pressable>
        </View>

        {formOpen ? (
          <Card>
            <SectionHeader title={editing ? "Edit Food" : "Custom Food"} />
            <FormInput label="Name" value={form.name} onChangeText={(v) => setField("name", v)} />
            <FormInput label="Brand" value={form.brand} onChangeText={(v) => setField("brand", v)} />
            <View style={styles.grid}>
              <FormInput label="Calories" value={form.calories} onChangeText={(v) => setField("calories", v)} numeric />
              <FormInput label="Protein" value={form.protein} onChangeText={(v) => setField("protein", v)} numeric />
              <FormInput label="Carbs" value={form.carbs} onChangeText={(v) => setField("carbs", v)} numeric />
              <FormInput label="Fat" value={form.fat} onChangeText={(v) => setField("fat", v)} numeric />
              <FormInput label="Fiber" value={form.fiber} onChangeText={(v) => setField("fiber", v)} numeric />
              <FormInput label="Serving" value={form.servingSize} onChangeText={(v) => setField("servingSize", v)} numeric />
            </View>
            <FormInput label="Unit" value={form.servingUnit} onChangeText={(v) => setField("servingUnit", v)} />
            <Button label={editing ? "Update Food" : "Create Food"} onPress={saveFood} loading={saving} fullWidth />
            <Button label="Cancel" onPress={closeForm} variant="ghost" fullWidth />
          </Card>
        ) : null}

        {isLoading ? (
          <Text style={styles.muted}>Loading foods...</Text>
        ) : (foods ?? []).length === 0 ? (
          <EmptyState
            icon="fast-food-outline"
            title="No custom foods"
            message="Create foods you eat often so logging works even without a USDA result."
          />
        ) : (
          <ListGroup>
            {(foods ?? []).map((food, index) => (
              <ListRow
                key={food.id}
                title={food.name}
                subtitle={`${Math.round(food.calories)} cal · P${Math.round(food.protein)} C${Math.round(food.carbs)} F${Math.round(food.fat)} · ${food.servingSize ?? 100}${food.servingUnit ?? "g"}`}
                icon="fast-food-outline"
                onPress={() => setEditing(food)}
                right={
                  <Pressable hitSlop={8} onPress={() => confirmDelete(food)}>
                    <Ionicons name="trash-outline" size={18} color={colors.textDim} />
                  </Pressable>
                }
                last={index === (foods?.length ?? 0) - 1}
              />
            ))}
          </ListGroup>
        )}
      </View>
    </Screen>
  );
}

function FormInput({
  label,
  value,
  onChangeText,
  numeric,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  numeric?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? "decimal-pad" : "default"}
        placeholderTextColor={colors.textDim}
      />
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  pad: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  backBtn: { paddingVertical: 4 },
  title: { flex: 1, color: colors.text, fontSize: 28, fontWeight: "800" },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  field: { gap: 6, flexGrow: 1, flexBasis: "45%" },
  fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  input: {
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
    padding: spacing.md,
  },
  muted: { color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
});
