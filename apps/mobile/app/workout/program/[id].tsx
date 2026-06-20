import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HevyButton, ListGroup, ListRow, Screen } from "../../../src/components/ui";
import { HevyProgramCard, HevyStackHeader } from "../../../src/components/hevy-ui";
import { getProgram } from "../../../src/lib/explore-data";
import { buildRoutinePayload, resolveExerciseIds } from "../../../src/lib/import-template";
import { trpc } from "../../../src/lib/trpc";
import { colors, spacing } from "../../../src/lib/theme";

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const program = getProgram(id ?? "");
  const [saving, setSaving] = useState(false);

  const createRoutine = trpc.routine.create.useMutation();

  if (!program) {
    return (
      <Screen>
        <Text style={styles.error}>Program not found</Text>
      </Screen>
    );
  }

  const saveProgram = async () => {
    setSaving(true);
    try {
      let saved = 0;
      for (const template of program.routines) {
        const exercises = await resolveExerciseIds(utils, template.exerciseNames);
        if (exercises.length === 0) continue;
        await createRoutine.mutateAsync(
          buildRoutinePayload(`${program.title.split("(")[0]?.trim()} · ${template.name}`, exercises),
        );
        saved += 1;
      }
      await utils.routine.list.invalidate();
      Alert.alert(
        saved > 0 ? "Program saved" : "Could not save",
        saved > 0
          ? `${saved} routine${saved === 1 ? "" : "s"} added to My Routines.`
          : "No matching exercises found in the library.",
        [{ text: "OK", onPress: () => router.push("/workout/my-routines") }],
      );
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save program");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll padded={false}>
      <View style={[styles.pad, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <HevyStackHeader title="Program" onBack={() => router.back()} />

        <View pointerEvents="none">
          <HevyProgramCard
            badge={program.badge}
            badgeColor={program.badgeColor}
            title={program.title}
            routineCount={program.routines.length}
            onPress={() => {}}
          />
        </View>

        <View style={styles.metaRow}>
          <MetaPill label={program.level} />
          <MetaPill label={program.goal} />
          <MetaPill label={program.equipment} />
        </View>

        <HevyButton
          label={saving ? "Saving…" : "Save to My Routines"}
          onPress={saveProgram}
          loading={saving}
        />

        <Text style={styles.sectionTitle}>Routines in this program</Text>
        <ListGroup>
          {program.routines.map((routine, index) => (
            <ListRow
              key={routine.name}
              title={routine.name}
              subtitle={`${routine.exerciseNames.length} exercises`}
              icon="list-outline"
              last={index === program.routines.length - 1}
            />
          ))}
        </ListGroup>

        {program.routines.map((routine) => (
          <View key={routine.name} style={styles.routineBlock}>
            <Text style={styles.routineName}>{routine.name}</Text>
            {routine.exerciseNames.map((name) => (
              <View key={name} style={styles.exerciseRow}>
                <Ionicons name="ellipse" size={6} color={colors.textDim} />
                <Text style={styles.exerciseName}>{name}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </Screen>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  error: { color: colors.textMuted, textAlign: "center", marginTop: 40 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pill: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  pillText: { color: colors.textMuted, fontSize: 13, fontWeight: "500" },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  routineBlock: { gap: spacing.sm },
  routineName: { fontSize: 17, fontWeight: "600", color: colors.text },
  exerciseRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingLeft: spacing.sm },
  exerciseName: { color: colors.textMuted, fontSize: 15 },
});
