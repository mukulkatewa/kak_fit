import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HevyButton, ListGroup, ListRow, Screen, ThemedDialog } from "../../../src/components/ui";
import { HevyProgramCard, HevyStackHeader } from "../../../src/components/hevy-ui";
import { getProgram } from "../../../src/lib/explore-data";
import { trpc } from "../../../src/lib/trpc";
import { alertWorkoutConflict } from "../../../src/lib/workout-errors";
import { navigateToActiveWorkout } from "../../../src/lib/workout-navigation";
import { spacing, useTheme, useThemedStyles, type Palette } from "../../../src/lib/theme";

type DialogButton = {
  label: string;
  variant?: "primary" | "secondary";
  onPress?: () => void;
};

export default function ProgramDetailScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const program = getProgram(id ?? "");
  const pendingRoutineId = useRef<string | null>(null);
  const [dialog, setDialog] = useState<{
    title: string;
    message: string;
    buttons: DialogButton[];
  } | null>(null);

  const discardActive = trpc.workout.discardActive.useMutation();
  const startRoutine = trpc.workout.startFromRoutine.useMutation({
    onSuccess: (workout) => {
      navigateToActiveWorkout(utils, router, workout);
    },
    onError: (e) =>
      alertWorkoutConflict(
        e,
        () => router.push("/workout/active"),
        async () => {
          const routineId = pendingRoutineId.current;
          if (!routineId) return;
          await discardActive.mutateAsync();
          await utils.workout.active.invalidate();
          startRoutine.mutate({ routineId });
        },
      ),
  });

  const importProgram = trpc.routine.importProgram.useMutation({
    onSuccess: async (result) => {
      await utils.routine.list.invalidate();
      const missing = result.missingExerciseNames.length;
      if (result.saved > 0) {
        const firstRoutine = result.routines[0];
        const missingNote =
          missing > 0 ? ` ${missing} exercise${missing === 1 ? "" : "s"} were not found.` : "";
        setDialog({
          title: "Program saved",
          message: `${result.saved} routine${result.saved === 1 ? "" : "s"} added to My Routines.${missingNote}`,
          buttons: [
            {
              label: "Start First Routine",
              variant: "primary",
              onPress: () => {
                if (!firstRoutine) return;
                pendingRoutineId.current = firstRoutine.id;
                setDialog(null);
                startRoutine.mutate({ routineId: firstRoutine.id });
              },
            },
            {
              label: "Go to My Routines",
              variant: "secondary",
              onPress: () => router.push("/workout/my-routines"),
            },
          ],
        });
      } else {
        setDialog({
          title: "Could not save",
          message: "No matching exercises found in the library.",
          buttons: [{ label: "OK", variant: "primary" }],
        });
      }
    },
    onError: (error) => {
      setDialog({
        title: "Error",
        message: error.message,
        buttons: [{ label: "OK", variant: "primary" }],
      });
    },
  });

  const busy = importProgram.isPending || startRoutine.isPending;

  if (!program) {
    return (
      <Screen>
        <HevyStackHeader title="Program" onBack={() => router.back()} />
        <Text style={styles.error}>Program not found</Text>
      </Screen>
    );
  }

  const saveProgram = () => {
    if (busy) return;
    importProgram.mutate({
      programTitle: program.title,
      routines: program.routines.map((routine) => ({
        name: routine.name,
        exerciseNames: routine.exerciseNames,
      })),
    });
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
          label={
            importProgram.isPending
              ? "Saving…"
              : startRoutine.isPending
                ? "Starting workout…"
                : "Save to My Routines"
          }
          onPress={saveProgram}
          loading={busy}
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

      <ThemedDialog
        visible={dialog !== null}
        title={dialog?.title ?? ""}
        message={dialog?.message}
        onDismiss={() => setDialog(null)}
        buttons={dialog?.buttons ?? [{ label: "OK", variant: "primary" }]}
      />
    </Screen>
  );
}

function MetaPill({ label }: { label: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
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
