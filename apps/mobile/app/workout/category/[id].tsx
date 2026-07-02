import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { HevyButton, ListGroup, ListRow, Screen, ThemedDialog } from "../../../src/components/ui";
import { HevyStackHeader } from "../../../src/components/hevy-ui";
import { getCategory } from "../../../src/lib/explore-data";
import { buildRoutinePayload, resolveExerciseIds } from "../../../src/lib/import-template";
import { trpc } from "../../../src/lib/trpc";
import { alertWorkoutConflict } from "../../../src/lib/workout-errors";
import { navigateToActiveWorkout } from "../../../src/lib/workout-navigation";
import { useThemedStyles, spacing, typography, type Palette } from "../../../src/lib/theme";

type DialogButton = {
  label: string;
  variant?: "primary" | "secondary";
  onPress?: () => void;
};

export default function CategoryDetailScreen() {
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const category = getCategory(id ?? "");
  const [saving, setSaving] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const pendingRoutineId = useRef<string | null>(null);
  const startingRef = useRef(false);
  const [dialog, setDialog] = useState<{
    title: string;
    message: string;
    buttons: DialogButton[];
  } | null>(null);

  const discardActive = trpc.workout.discardActive.useMutation();
  const createRoutine = trpc.routine.create.useMutation();
  const startRoutine = trpc.workout.startFromRoutine.useMutation({
    onSuccess: (workout) => {
      startingRef.current = false;
      setIsStarting(false);
      navigateToActiveWorkout(utils, router, workout);
    },
    onError: (e) => {
      startingRef.current = false;
      setIsStarting(false);
      alertWorkoutConflict(
        e,
        () => router.push("/workout/active"),
        async () => {
          const routineId = pendingRoutineId.current;
          if (!routineId) return;
          startingRef.current = true;
          setIsStarting(true);
          await discardActive.mutateAsync();
          await utils.workout.active.invalidate();
          startRoutine.mutate({ routineId });
        },
      );
    },
  });

  const busy = saving !== null || createRoutine.isPending || isStarting || startRoutine.isPending;

  if (!category) {
    return (
      <Screen>
        <HevyStackHeader title="Category" onBack={() => router.back()} />
        <Text style={styles.error}>Category not found</Text>
      </Screen>
    );
  }

  const startWorkout = (routineId: string) => {
    if (startingRef.current || isStarting || startRoutine.isPending) return;
    startingRef.current = true;
    setIsStarting(true);
    pendingRoutineId.current = routineId;
    setDialog(null);
    startRoutine.mutate({ routineId });
  };

  const saveTemplate = async (templateName: string, exerciseNames: string[]) => {
    if (busy) return;
    setSaving(templateName);
    try {
      const exercises = await resolveExerciseIds(utils, exerciseNames);
      if (exercises.length === 0) {
        setDialog({
          title: "No exercises found",
          message: "Try creating this routine manually.",
          buttons: [{ label: "OK", variant: "primary" }],
        });
        return;
      }
      const saved = await createRoutine.mutateAsync(
        buildRoutinePayload(`${category.label} · ${templateName}`, exercises),
      );
      await utils.routine.list.invalidate();
      setDialog({
        title: "Routine saved to My Routines",
        message: `"${templateName}" was added to My Routines.`,
        buttons: [
          {
            label: "Start Workout Now",
            variant: "primary",
            onPress: () => startWorkout(saved.id),
          },
          { label: "Done", variant: "secondary" },
        ],
      });
    } catch (e) {
      setDialog({
        title: "Error",
        message: e instanceof Error ? e.message : "Failed to save routine",
        buttons: [{ label: "OK", variant: "primary" }],
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Screen scroll padded={false}>
      <View style={styles.pad}>
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
              subtitle={
                saving === template.name
                  ? "Saving…"
                  : `${template.exerciseNames.length} exercises`
              }
              icon="barbell-outline"
              onPress={busy ? undefined : () => saveTemplate(template.name, template.exerciseNames)}
              last={index === category.templates.length - 1}
            />
          ))}
        </ListGroup>

        {busy ? (
          <HevyButton
            label={startRoutine.isPending ? "Starting workout…" : `Saving ${saving ?? "routine"}…`}
            onPress={() => {}}
            loading
          />
        ) : (
          <HevyButton
            label="Create custom routine"
            variant="secondary"
            onPress={() => router.push("/routine/create")}
          />
        )}
      </View>

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

const makeStyles = (colors: Palette) => StyleSheet.create({
  pad: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  error: { color: colors.textMuted, textAlign: "center", marginTop: 40 },
  hero: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg },
  heroIcon: { fontSize: 48 }, // Decorative emoji scale
  heroDesc: { ...typography.body, color: colors.textMuted, textAlign: "center", lineHeight: 22 },
  sectionTitle: { ...typography.h2, color: colors.text },
});
