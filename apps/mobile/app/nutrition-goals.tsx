import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { HevyModalHeader } from "../src/components/hevy-ui";
import { trpc } from "../src/lib/trpc";
import { radius, spacing, typography, useTheme, useThemedStyles, type Palette } from "../src/lib/theme";
import { TOUCH_TARGET_MIN } from "../src/lib/layout-constants";

export default function NutritionGoalsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const utils = trpc.useUtils();

  const { data: targets } = trpc.nutrition.getTargets.useQuery();
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  useEffect(() => {
    if (targets) {
      setCalories(String(targets.calories));
      setProtein(String(targets.protein));
      setCarbs(String(targets.carbs));
      setFat(String(targets.fat));
    }
  }, [targets]);

  const save = trpc.nutrition.setTargets.useMutation({
    onSuccess: () => {
      utils.nutrition.getTargets.invalidate();
      utils.nutrition.dailySummary.invalidate();
      router.back();
    },
    onError: (e) => Alert.alert("Couldn't save", e.message),
  });

  const handleSave = () => {
    const c = Number(calories), p = Number(protein), cb = Number(carbs), f = Number(fat);
    if ([c, p, cb, f].some((n) => !Number.isFinite(n) || n < 0)) {
      Alert.alert("Invalid", "Enter valid numbers for all goals.");
      return;
    }
    save.mutate({ calories: Math.round(c), protein: Math.round(p), carbs: Math.round(cb), fat: Math.round(f) });
  };

  const rows: Array<[string, string, (v: string) => void, string]> = [
    ["Calories", calories, setCalories, "kcal"],
    ["Protein", protein, setProtein, "g"],
    ["Carbs", carbs, setCarbs, "g"],
    ["Fat", fat, setFat, "g"],
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.headerPad}>
        <HevyModalHeader
          title="Daily Goals"
          onCancel={() => router.back()}
          onSave={handleSave}
          saveLoading={save.isPending}
        />
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {rows.map(([label, value, setter, unit]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.inputWrap}>
              <TextInput
                value={value}
                onChangeText={setter}
                keyboardType="number-pad"
                placeholderTextColor={colors.textDim}
                style={styles.input}
              />
              <Text style={styles.unit}>{unit}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.hint}>Used for the rings on your Meals tab.</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    headerPad: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxl },
    body: { padding: spacing.lg, gap: spacing.md },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    label: { ...typography.body, color: colors.text, fontWeight: "600" },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      minWidth: 130,
      minHeight: TOUCH_TARGET_MIN,
    },
    input: { flex: 1, color: colors.text, ...typography.body, paddingVertical: spacing.md, textAlign: "right" },
    unit: { ...typography.bodySmall, color: colors.textMuted },
    hint: { ...typography.caption, color: colors.textDim, marginTop: spacing.sm },
  });
