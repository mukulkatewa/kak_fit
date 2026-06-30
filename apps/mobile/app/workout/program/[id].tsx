import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { HevyButton, ListGroup, ListRow, Screen, ThemedDialog } from "../../../src/components/ui";
import { HevyProgramCard, HevyStackHeader } from "../../../src/components/hevy-ui";
import { getProgram, type ProgramRoutineTemplate } from "../../../src/lib/explore-data";
import { trpc } from "../../../src/lib/trpc";
import { alertWorkoutConflict } from "../../../src/lib/workout-errors";
import { navigateToActiveWorkout } from "../../../src/lib/workout-navigation";
import { spacing, useTheme, useThemedStyles, type Palette } from "../../../src/lib/theme";

type DialogButton = {
  label: string;
  variant?: "primary" | "secondary" | "destructive";
  onPress?: () => void;
};

type RoutineConfirm = {
  routine: ProgramRoutineTemplate;
  savedRoutineId?: string;
};

export default function ProgramDetailScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const program = getProgram(id ?? "");
  const { data: savedRoutines } = trpc.routine.list.useQuery();
  const [isStarting, setIsStarting] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startingTemplateName, setStartingTemplateName] = useState<string | null>(null);
  const [expandedRoutine, setExpandedRoutine] = useState<string | null>(null);
  const importActionRef = useRef<"save-only" | "start-after">("save-only");
  const [dialog, setDialog] = useState<{
    title: string;
    message: string;
    buttons: DialogButton[];
  } | null>(null);
  const [routineConfirm, setRoutineConfirm] = useState<RoutineConfirm | null>(null);

  const discardActive = trpc.workout.discardActive.useMutation();

  const programNamePrefix = useMemo(
    () => (program ? program.title.replace(/\s*\([^)]*\)\s*/g, "").trim() : ""),
    [program],
  );

  const findSavedRoutine = (templateName: string) => {
    const expectedName = `${programNamePrefix} · ${templateName}`;
    return savedRoutines?.find((routine) => routine.name === expectedName);
  };

  const startRoutine = trpc.workout.startFromRoutine.useMutation({
    onSuccess: (workout) => {
      setStartingId(null);
      setStartingTemplateName(null);
      setIsStarting(false);
      navigateToActiveWorkout(utils, router, workout);
    },
    onError: (e, vars) => {
      setStartingId(null);
      setStartingTemplateName(null);
      setIsStarting(false);
      alertWorkoutConflict(
        e,
        () => router.push("/workout/active"),
        async () => {
          setStartingId(vars.routineId);
          setIsStarting(true);
          await discardActive.mutateAsync();
          await utils.workout.active.invalidate();
          startRoutine.mutate(vars);
        },
      );
    },
  });

  const beginStart = (routineId: string) => {
    if (isStarting || startRoutine.isPending) return;
    setIsStarting(true);
    setStartingId(routineId);
    setDialog(null);
    startRoutine.mutate({ routineId });
  };

  const startFirstRoutine = (routineId: string) => {
    beginStart(routineId);
  };

  const importProgram = trpc.routine.importProgram.useMutation({
    onSuccess: async (result) => {
      await utils.routine.list.invalidate();

      if (importActionRef.current === "start-after") {
        importActionRef.current = "save-only";
        const saved = result.routines[0];
        if (saved) {
          beginStart(saved.id);
        } else {
          setStartingTemplateName(null);
          setDialog({
            title: "Could not save",
            message: "No matching exercises found in the library.",
            buttons: [{ label: "OK", variant: "primary" }],
          });
        }
        return;
      }

      const missing = result.missingExerciseNames.length;
      const skipped = result.skipped ?? 0;

      if (result.saved > 0) {
        const firstRoutine = result.routines[0];
        const missingNote =
          missing > 0 ? ` ${missing} exercise${missing === 1 ? "" : "s"} were not found.` : "";
        const skippedNote =
          skipped > 0
            ? ` ${skipped} routine${skipped === 1 ? " was" : "s were"} already saved and skipped.`
            : "";
        setDialog({
          title: "Program saved",
          message: `${result.saved} routine${result.saved === 1 ? "" : "s"} added to My Routines.${skippedNote}${missingNote}`,
          buttons: [
            {
              label: "Start First Routine",
              variant: "primary",
              onPress: () => {
                if (!firstRoutine) return;
                startFirstRoutine(firstRoutine.id);
              },
            },
            {
              label: "Go to My Routines",
              variant: "secondary",
              onPress: () => router.push("/workout/my-routines"),
            },
          ],
        });
      } else if (skipped > 0) {
        setDialog({
          title: "Already saved",
          message: `All ${skipped} routine${skipped === 1 ? "" : "s"} from this program are already in My Routines.`,
          buttons: [
            {
              label: "Go to My Routines",
              variant: "primary",
              onPress: () => router.push("/workout/my-routines"),
            },
            { label: "OK", variant: "secondary" },
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
      importActionRef.current = "save-only";
      setStartingTemplateName(null);
      setDialog({
        title: "Error",
        message: error.message,
        buttons: [{ label: "OK", variant: "primary" }],
      });
    },
  });

  const busy = importProgram.isPending || isStarting || startRoutine.isPending;

  const saveAndStartRoutine = (routine: ProgramRoutineTemplate) => {
    if (busy) return;
    const existing = findSavedRoutine(routine.name);
    if (existing) {
      beginStart(existing.id);
      return;
    }
    setStartingTemplateName(routine.name);
    importActionRef.current = "start-after";
    importProgram.mutate({
      programTitle: program!.title,
      routines: [{ name: routine.name, exerciseNames: routine.exerciseNames }],
    });
  };

  const handleRoutinePress = (routine: ProgramRoutineTemplate) => {
    if (busy) return;
    const saved = findSavedRoutine(routine.name);
    setRoutineConfirm({ routine, savedRoutineId: saved?.id });
  };

  const isRoutineRowBusy = (routine: ProgramRoutineTemplate) => {
    if (startingTemplateName === routine.name) return true;
    const saved = findSavedRoutine(routine.name);
    return saved != null && startingId === saved.id;
  };

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
    importActionRef.current = "save-only";
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
      <View style={styles.pad}>
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
          {program.routines.map((routine, index) => {
            const isExpanded = expandedRoutine === routine.name;
            const isLast = index === program.routines.length - 1;
            return (
              <View key={routine.name}>
                <ListRow
                  title={routine.name}
                  subtitle={`${routine.exerciseNames.length} exercises · tap to start`}
                  icon="list-outline"
                  last={isLast && !isExpanded}
                  onPress={
                    isRoutineRowBusy(routine) ? undefined : () => handleRoutinePress(routine)
                  }
                  right={
                    isRoutineRowBusy(routine) ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <Pressable
                        hitSlop={8}
                        onPress={() =>
                          setExpandedRoutine((current) =>
                            current === routine.name ? null : routine.name,
                          )
                        }
                        style={styles.expandBtn}
                      >
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={18}
                          color={colors.textDim}
                        />
                      </Pressable>
                    )
                  }
                />
                {isExpanded ? (
                  <View style={[styles.exerciseExpand, isLast && styles.exerciseExpandLast]}>
                    {routine.exerciseNames.map((name) => (
                      <View key={name} style={styles.exerciseRow}>
                        <Ionicons name="ellipse" size={6} color={colors.textDim} />
                        <Text style={styles.exerciseName}>{name}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ListGroup>
      </View>

      <ThemedDialog
        visible={routineConfirm !== null && !isStarting}
        title={
          routineConfirm?.savedRoutineId
            ? `Start ${routineConfirm.routine.name}?`
            : "Save & Start?"
        }
        message={
          routineConfirm?.savedRoutineId
            ? "Begin this workout now?"
            : `Add "${routineConfirm?.routine.name ?? "this routine"}" to My Routines and start now?`
        }
        onDismiss={() => {
          if (!isStarting) setRoutineConfirm(null);
        }}
        buttons={
          routineConfirm?.savedRoutineId
            ? [
                { label: "Cancel" },
                {
                  label: startRoutine.isPending ? "Starting…" : "Start",
                  variant: "primary",
                  onPress: () => {
                    const id = routineConfirm.savedRoutineId;
                    setRoutineConfirm(null);
                    if (id) beginStart(id);
                  },
                },
              ]
            : [
                { label: "Cancel" },
                {
                  label: importProgram.isPending ? "Saving…" : "Save & Start",
                  variant: "primary",
                  onPress: () => {
                    const routine = routineConfirm?.routine;
                    setRoutineConfirm(null);
                    if (routine) saveAndStartRoutine(routine);
                  },
                },
              ]
        }
      />

      <ThemedDialog
        visible={dialog !== null && !isStarting}
        title={dialog?.title ?? ""}
        message={dialog?.message}
        onDismiss={() => {
          if (!isStarting) setDialog(null);
        }}
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
  expandBtn: { padding: 4 },
  exerciseExpand: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  exerciseExpandLast: { borderBottomWidth: 0 },
  exerciseRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingLeft: spacing.sm },
  exerciseName: { color: colors.textMuted, fontSize: 15 },
});
