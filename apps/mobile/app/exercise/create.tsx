import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { HevyModalHeader } from "../../src/components/hevy-ui";
import { trpc } from "../../src/lib/trpc";
import { useScreenTopInset } from "../../src/lib/layout-constants";
import {
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Palette,
} from "../../src/lib/theme";

export default function CreateExerciseScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const topInset = useScreenTopInset("modal");
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [primaryMuscleId, setPrimaryMuscleId] = useState<string | null>(null);

  const { data: muscles } = trpc.exercise.muscles.useQuery();

  const create = trpc.exercise.createCustom.useMutation({
    onSuccess: () => {
      utils.exercise.list.invalidate();
      utils.exerciseCount.invalidate();
      router.back();
    },
    onError: (e) => Alert.alert("Couldn't save", e.message),
  });

  const canSave = name.trim().length >= 2 && Boolean(primaryMuscleId);

  const sortedMuscles = useMemo(
    () => [...(muscles ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [muscles],
  );

  const handleSave = () => {
    if (!canSave || !primaryMuscleId) return;
    create.mutate({
      name: name.trim(),
      instructions: instructions.trim() || undefined,
      primaryMuscleId,
      secondaryMuscleIds: [],
    });
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.headerPad, { paddingTop: topInset }]}>
        <HevyModalHeader
          title="New Exercise"
          onCancel={() => router.back()}
          onSave={handleSave}
          saveDisabled={!canSave}
          saveLoading={create.isPending}
        />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Cable Lateral Raise"
          placeholderTextColor={colors.textDim}
          style={styles.input}
          autoFocus
        />

        <Text style={styles.label}>Primary muscle</Text>
        <View style={styles.muscleGrid}>
          {sortedMuscles.map((m) => {
            const active = primaryMuscleId === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setPrimaryMuscleId(m.id)}
                style={[styles.muscleChip, active && styles.muscleChipActive]}
              >
                <Text style={[styles.muscleChipText, active && styles.muscleChipTextActive]}>
                  {m.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Instructions (optional)</Text>
        <TextInput
          value={instructions}
          onChangeText={setInstructions}
          placeholder="How to perform this exercise…"
          placeholderTextColor={colors.textDim}
          style={[styles.input, styles.textArea]}
          multiline
        />
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    headerPad: { paddingHorizontal: spacing.lg },
    body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
      marginTop: spacing.lg,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      color: colors.text,
      fontSize: 16,
    },
    textArea: { minHeight: 100, textAlignVertical: "top" },
    muscleGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    muscleChip: {
      backgroundColor: colors.surface,
      borderRadius: radius.full,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    muscleChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    muscleChipText: { color: colors.text, fontSize: 14, fontWeight: "500" },
    muscleChipTextActive: { color: colors.onAccent, fontWeight: "700" },
  });
