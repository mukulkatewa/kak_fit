import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HevyButton, ListGroup, ListRow, Screen } from "../../../src/components/ui";
import { HevyStackHeader } from "../../../src/components/hevy-ui";
import { getCategory } from "../../../src/lib/explore-data";
import { buildRoutinePayload, resolveExerciseIds } from "../../../src/lib/import-template";
import { trpc } from "../../../src/lib/trpc";
import { colors, spacing } from "../../../src/lib/theme";

export default function CategoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const category = getCategory(id ?? "");
  const [saving, setSaving] = useState<string | null>(null);

  const createRoutine = trpc.routine.create.useMutation();

  if (!category) {
    return (
      <Screen>
        <Text style={styles.error}>Category not found</Text>
      </Screen>
    );
  }

  const saveTemplate = async (templateName: string, exerciseNames: string[]) => {
    setSaving(templateName);
    try {
      const exercises = await resolveExerciseIds(utils, exerciseNames);
      if (exercises.length === 0) {
        Alert.alert("No exercises found", "Try creating this routine manually.");
        return;
      }
      await createRoutine.mutateAsync(buildRoutinePayload(`${category.label} · ${templateName}`, exercises));
      await utils.routine.list.invalidate();
      Alert.alert("Routine saved", `"${templateName}" was added to My Routines.`, [
        { text: "View", onPress: () => router.push("/workout/my-routines") },
        { text: "OK" },
      ]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save routine");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Screen scroll padded={false}>
      <View style={[styles.pad, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <HevyStackHeader title={category.label} onBack={() => router.back()} />

        <View style={styles.hero}>
          <Text style={styles.heroIcon}>{category.icon}</Text>
          <Text style={styles.heroDesc}>{category.description}</Text>
        </View>

        <Text style={styles.sectionTitle}>Suggested routines</Text>
        <ListGroup>
          {category.templates.map((template, index) => (
            <ListRow
              key={template.name}
              title={template.name}
              subtitle={`${template.exerciseNames.length} exercises`}
              icon="barbell-outline"
              onPress={() => saveTemplate(template.name, template.exerciseNames)}
              last={index === category.templates.length - 1}
            />
          ))}
        </ListGroup>

        {saving ? (
          <HevyButton label={`Saving ${saving}…`} onPress={() => {}} loading />
        ) : (
          <HevyButton label="Create custom routine" variant="secondary" onPress={() => router.push("/routine/create")} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  error: { color: colors.textMuted, textAlign: "center", marginTop: 40 },
  hero: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg },
  heroIcon: { fontSize: 48 },
  heroDesc: { color: colors.textMuted, fontSize: 15, textAlign: "center", lineHeight: 22 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
});
