import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  Card,
  HevyButton,
  Screen,
  SearchBar,
  SectionHeader,
} from "../../src/components/ui";
import { formatPreviousSet, pickPreviousForSet, type PreviousExerciseSession } from "../../src/lib/previous-set";
import { trpc } from "../../src/lib/trpc";
import { parseOptionalNumber } from "../../src/lib/workout-errors";
import { cycleRpe, formatRpe } from "../../src/lib/rpe";
import { useUserPreferences } from "../../src/lib/use-preferences";
import { fromKg, toKg, weightLabel } from "../../src/lib/units";
import { formatRestTime, useRestTimer } from "../../src/lib/rest-timer";
import {
  enqueueWorkoutMutation,
  getQueuedWorkoutMutationCount,
  isNetworkError,
  syncQueuedWorkoutMutations,
} from "../../src/lib/offline-workouts";
import { useTheme, useThemedStyles, spacing, radius, type Palette } from "../../src/lib/theme";

const SET_TYPES = ["NORMAL", "WARMUP", "DROP", "FAILURE"] as const;
type SetType = (typeof SET_TYPES)[number];

const SET_TYPE_LABEL: Record<SetType, string> = {
  NORMAL: "",
  WARMUP: "W",
  DROP: "D",
  FAILURE: "F",
};

const setTypeColor = (colors: Palette): Record<SetType, string> => ({
  NORMAL: colors.textMuted,
  WARMUP: colors.gold,
  DROP: colors.accentBright,
  FAILURE: colors.danger,
});

export default function ActiveWorkoutScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { weightUnit } = useUserPreferences();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const { data: workout, isLoading, isFetching, refetch } = trpc.workout.active.useQuery();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishName, setFinishName] = useState("");
  const [finishNotes, setFinishNotes] = useState("");
  const [pendingOffline, setPendingOffline] = useState(0);
  const [search, setSearch] = useState("");

  const exerciseIds = useMemo(
    () => workout?.exercises.map((e) => e.exercise.id) ?? [],
    [workout?.exercises],
  );

  const { data: previousMap } = trpc.workout.previousSets.useQuery(
    { exerciseIds },
    { enabled: exerciseIds.length > 0 },
  );

  const { data: exercises } = trpc.exercise.list.useQuery(
    { search: search || undefined, limit: 30 },
    { enabled: pickerOpen },
  );

  const { secondsLeft, isRunning, start, tick, stop } = useRestTimer();

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isRunning, tick]);

  useEffect(() => {
    let mounted = true;
    async function syncOffline() {
      const before = await getQueuedWorkoutMutationCount();
      if (mounted) setPendingOffline(before);
      const result = await syncQueuedWorkoutMutations();
      if (!mounted) return;
      setPendingOffline(result.remaining);
      if (result.synced > 0) {
        refetch();
        utils.workout.history.invalidate();
        utils.personalRecord.list.invalidate();
      }
    }
    syncOffline().catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [refetch, utils]);

  const updateSet = trpc.workout.updateSet.useMutation({
    onSuccess: () => refetch(),
    onError: async (e, variables) => {
      if (!isNetworkError(e)) {
        Alert.alert("Couldn't save set", e.message);
        return;
      }
      await enqueueWorkoutMutation("updateSet", variables);
      setPendingOffline(await getQueuedWorkoutMutationCount());
    },
  });
  const addSet = trpc.workout.addSet.useMutation({
    onSuccess: () => refetch(),
    onError: async (e, variables) => {
      if (!isNetworkError(e)) {
        Alert.alert("Couldn't add set", e.message);
        return;
      }
      await enqueueWorkoutMutation("addSet", variables);
      setPendingOffline(await getQueuedWorkoutMutationCount());
    },
  });
  const deleteSet = trpc.workout.deleteSet.useMutation({
    onSuccess: () => refetch(),
    onError: async (e, variables) => {
      if (!isNetworkError(e)) {
        Alert.alert("Couldn't delete set", e.message);
        return;
      }
      await enqueueWorkoutMutation("deleteSet", variables);
      setPendingOffline(await getQueuedWorkoutMutationCount());
    },
  });
  const updateExerciseNotes = trpc.workout.updateExerciseNotes.useMutation({
    onSuccess: () => refetch(),
    onError: async (e, variables) => {
      if (!isNetworkError(e)) {
        Alert.alert("Couldn't save notes", e.message);
        return;
      }
      await enqueueWorkoutMutation("updateExerciseNotes", variables);
      setPendingOffline(await getQueuedWorkoutMutationCount());
    },
  });

  const handleSetUpdate = (
    setId: string,
    data: { weight?: number; reps?: number; isCompleted?: boolean; setType?: SetType; rpe?: number | null },
  ) => {
    if (data.isCompleted === true) start();
    updateSet.mutate({ setId, ...data });
  };

  const cycleSetType = (current: SetType): SetType => {
    const idx = SET_TYPES.indexOf(current);
    return SET_TYPES[(idx + 1) % SET_TYPES.length]!;
  };

  const addExercise = trpc.workout.addExercise.useMutation({
    onSuccess: () => {
      setPickerOpen(false);
      setSearch("");
      refetch();
      utils.workout.previousSets.invalidate();
    },
    onError: async (e, variables) => {
      if (!isNetworkError(e)) {
        Alert.alert("Error", e.message);
        return;
      }
      await enqueueWorkoutMutation("addExercise", variables);
      setPendingOffline(await getQueuedWorkoutMutationCount());
      Alert.alert(
        "Saved offline",
        "Exercise will be added when you're back online. Pull to refresh after reconnecting.",
      );
    },
  });

  const finish = trpc.workout.finish.useMutation({
    onSuccess: (result) => {
      utils.workout.active.invalidate();
      utils.workout.history.invalidate();
      utils.personalRecord.list.invalidate();
      utils.progress.dashboard.invalidate();
      utils.progress.volumeHistory.invalidate();
      utils.progress.muscleDistribution.invalidate();
      utils.auth.stats.invalidate();
      const prCount = result.newRecords.length;
      const summary = result.summary;
      Alert.alert(
        "Workout saved",
        `${summary.completedSets} sets · ${summary.totalVolume} kg · ${summary.durationMinutes} min${
          prCount > 0 ? ` · ${prCount} PR${prCount > 1 ? "s" : ""}` : ""
        }`,
        [{ text: "Done", onPress: () => router.back() }],
      );
    },
    onError: async (e, variables) => {
      if (!isNetworkError(e)) {
        Alert.alert("Error", e.message);
        return;
      }
      await enqueueWorkoutMutation("finishWorkout", variables);
      setPendingOffline(await getQueuedWorkoutMutationCount());
      Alert.alert("Saved offline", "This workout will sync automatically when the API is reachable.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    },
  });

  const cancel = trpc.workout.cancel.useMutation({
    onSuccess: () => {
      utils.workout.active.invalidate();
      router.back();
    },
  });

  const volume = useMemo(() => {
    if (!workout) return 0;
    return workout.exercises.reduce(
      (sum, ex) =>
        sum +
        ex.sets.reduce(
          (s, set) => s + (set.isCompleted ? (set.weight ?? 0) * (set.reps ?? 0) : 0),
          0,
        ),
      0,
    );
  }, [workout]);

  const completedSetCount = useMemo(() => {
    if (!workout) return 0;
    return workout.exercises.reduce(
      (sum, ex) => sum + ex.sets.filter((set) => set.isCompleted).length,
      0,
    );
  }, [workout]);

  const elapsedMinutes = useMemo(() => {
    if (!workout) return 0;
    return Math.max(1, Math.round((Date.now() - new Date(workout.startedAt).getTime()) / 60000));
  }, [workout]);

  useEffect(() => {
    if (!workout) return;
    setFinishName(workout.name ?? "Workout");
    setFinishNotes(workout.notes ?? "");
  }, [workout?.id]);

  if (isLoading || (isFetching && !workout)) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} size="large" style={{ marginTop: 48 }} />
      </Screen>
    );
  }

  if (!workout) {
    return (
      <Screen>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.accent} />
          </Pressable>
        </View>
        <View style={{ alignItems: "center", marginTop: 64, gap: spacing.lg, paddingHorizontal: spacing.xl }}>
          <Ionicons name="barbell-outline" size={48} color={colors.textDim} />
          <Text style={styles.workoutTitle}>No active workout</Text>
          <Text style={styles.meta}>Start one from the Home or Workout tab.</Text>
          <Button label="Go back" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
        </Pressable>
        <Text style={styles.volume}>{Math.round(volume)} kg</Text>
      </View>

      <Text style={styles.workoutTitle}>{workout.name ?? "Workout"}</Text>
      <Text style={styles.meta}>
        {workout.exercises.length} exercises{pendingOffline > 0 ? ` · ${pendingOffline} offline edits` : ""}
      </Text>

      {isRunning ? (
        <Pressable style={styles.restBar} onPress={stop}>
          <Text style={styles.restLabel}>Rest</Text>
          <Text style={styles.restTime}>{formatRestTime(secondsLeft)}</Text>
          <Text style={styles.restHint}>Tap to skip</Text>
        </Pressable>
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {workout.exercises.map((exercise) => (
          <ExerciseBlock
            key={exercise.id}
            name={exercise.exercise.name}
            supersetGroup={exercise.supersetGroup ?? null}
            workoutExerciseId={exercise.id}
            sets={exercise.sets}
            notes={exercise.notes ?? null}
            previous={previousMap?.[exercise.exercise.id] ?? null}
            onUpdateSet={handleSetUpdate}
            onCycleSetType={(setId, setType) =>
              handleSetUpdate(setId, { setType: cycleSetType(setType) })
            }
            onAddSet={() => addSet.mutate({ workoutExerciseId: exercise.id })}
            onDeleteSet={(setId) => deleteSet.mutate({ setId })}
            onUpdateNotes={(notes) => updateExerciseNotes.mutate({ workoutExerciseId: exercise.id, notes })}
            weightUnit={weightUnit}
          />
        ))}

        {pickerOpen ? (
          <Card>
            <SectionHeader title="Add Exercise" />
            <SearchBar placeholder="Search exercise" value={search} onChangeText={setSearch} />
            <FlatList
              data={exercises ?? []}
              keyExtractor={(item) => item.id}
              style={styles.pickerList}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickerItem}
                  onPress={() =>
                    addExercise.mutate({
                      workoutId: workout.id,
                      exerciseId: item.id,
                      sets: [{ setNumber: 1, isCompleted: false }],
                    })
                  }
                >
                  <Text style={styles.pickerText}>{item.name}</Text>
                  <Ionicons name="add-circle" size={22} color={colors.accent} />
                </Pressable>
              )}
            />
            <Button label="Close" variant="ghost" fullWidth onPress={() => setPickerOpen(false)} />
          </Card>
        ) : (
          <Button label="Add Exercise" icon="add" fullWidth onPress={() => setPickerOpen(true)} variant="secondary" />
        )}

        {finishOpen ? (
          <Card>
            <SectionHeader title="Finish Workout" />
            <View style={styles.summaryGrid}>
              <SummaryItem label="Sets" value={completedSetCount} />
              <SummaryItem label="Volume" value={`${Math.round(volume)} kg`} />
              <SummaryItem label="Time" value={`${elapsedMinutes} min`} />
            </View>
            <TextInput
              style={styles.finishInput}
              value={finishName}
              onChangeText={setFinishName}
              placeholder="Workout name"
              placeholderTextColor={colors.textDim}
            />
            <TextInput
              style={[styles.finishInput, styles.finishNotes]}
              value={finishNotes}
              onChangeText={setFinishNotes}
              placeholder="Session notes"
              placeholderTextColor={colors.textDim}
              multiline
            />
            <HevyButton
              label="Save Workout"
              onPress={() =>
                finish.mutate({
                  workoutId: workout.id,
                  name: finishName.trim() || workout.name || "Workout",
                  notes: finishNotes.trim() || undefined,
                })
              }
              loading={finish.isPending}
            />
            <Button label="Keep logging" variant="ghost" fullWidth onPress={() => setFinishOpen(false)} />
          </Card>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <HevyButton
          label="Finish Workout"
          onPress={() => setFinishOpen(true)}
          loading={finish.isPending}
        />
        <Button
          label="Discard"
          variant="ghost"
          fullWidth
          onPress={() =>
            Alert.alert("Discard workout?", "This cannot be undone.", [
              { text: "Cancel", style: "cancel" },
              { text: "Discard", style: "destructive", onPress: () => cancel.mutate({ workoutId: workout.id }) },
            ])
          }
        />
      </View>
    </Screen>
  );
}


function SummaryItem({ label, value }: { label: string; value: string | number }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ExerciseBlock({
  name,
  workoutExerciseId,
  supersetGroup,
  sets,
  notes,
  previous,
  onUpdateSet,
  onCycleSetType,
  onAddSet,
  onDeleteSet,
  onUpdateNotes,
  weightUnit,
}: {
  name: string;
  workoutExerciseId: string;
  supersetGroup?: number | null;
  notes?: string | null;
  sets: Array<{
    id: string;
    setNumber: number;
    weight: number | null;
    reps: number | null;
    rpe: number | null;
    setType: SetType;
    isCompleted: boolean;
  }>;
  previous: PreviousExerciseSession | null;
  onUpdateSet: (
    setId: string,
    data: { weight?: number; reps?: number; isCompleted?: boolean; setType?: SetType; rpe?: number | null },
  ) => void;
  onCycleSetType: (setId: string, setType: SetType) => void;
  onAddSet: () => void;
  onDeleteSet: (setId: string) => void;
  onUpdateNotes: (notes: string | null) => void;
  weightUnit: "KG" | "LBS";
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const lastSet = sets[sets.length - 1];
  const [notesOpen, setNotesOpen] = useState(Boolean(notes));
  const [draftNotes, setDraftNotes] = useState(notes ?? "");

  useEffect(() => {
    setDraftNotes(notes ?? "");
    setNotesOpen(Boolean(notes));
  }, [notes, workoutExerciseId]);

  const copyLastSet = () => {
    if (!lastSet) return;
    const source = pickPreviousForSet(previous, lastSet.setNumber);
    if (!source) {
      Alert.alert("No previous data", "Complete this exercise in a past workout first.");
      return;
    }
    onUpdateSet(lastSet.id, {
      weight: source.weight ?? undefined,
      reps: source.reps ?? undefined,
    });
  };

  return (
    <Card>
      {supersetGroup != null ? (
        <View style={styles.supersetBadge}>
          <Ionicons name="git-merge" size={12} color={colors.accent} />
          <Text style={styles.supersetBadgeText}>Superset {supersetGroup}</Text>
        </View>
      ) : null}
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseName}>{name}</Text>
        <View style={styles.exerciseActions}>
          <Pressable onPress={() => setNotesOpen((open) => !open)} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name={notesOpen ? "document-text" : "document-text-outline"} size={17} color={colors.accent} />
          </Pressable>
          {previous ? (
            <Pressable onPress={copyLastSet} hitSlop={8} style={styles.copyBtn}>
              <Ionicons name="copy-outline" size={16} color={colors.accent} />
              <Text style={styles.copyBtnText}>Copy prev</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {notesOpen ? (
        <TextInput
          style={styles.exerciseNotesInput}
          value={draftNotes}
          onChangeText={setDraftNotes}
          onBlur={() => onUpdateNotes(draftNotes.trim() || null)}
          placeholder="Exercise notes"
          placeholderTextColor={colors.textDim}
          multiline
        />
      ) : null}

      {previous?.finishedAt ? (
        <Text style={styles.prevMeta}>
          Last: {formatPreviousSet(pickPreviousForSet(previous, 1))} ·{" "}
          {new Date(previous.finishedAt).toLocaleDateString()}
        </Text>
      ) : null}

      <View style={styles.setHeader}>
        <Text style={[styles.setCol, styles.setColNarrow]}>SET</Text>
        <Text style={[styles.setCol, styles.setColPrev]}>PREV</Text>
        <Text style={styles.setCol}>{weightLabel(weightUnit).toUpperCase()}</Text>
        <Text style={styles.setCol}>REPS</Text>
        <Text style={[styles.setCol, styles.setColRpe]}>RPE</Text>
        <Text style={[styles.setCol, styles.setColNarrow]}>✓</Text>
      </View>
      {sets.map((set) => (
        <SetRow
          key={set.id}
          set={set}
          weightUnit={weightUnit}
          previousValues={pickPreviousForSet(previous, set.setNumber)}
          onUpdateSet={onUpdateSet}
          onCycleSetType={onCycleSetType}
          onDeleteSet={onDeleteSet}
        />
      ))}
      <Pressable onPress={onAddSet} style={styles.addSetBtn}>
        <Ionicons name="add" size={16} color={colors.accent} />
        <Text style={styles.addSet}>Add Set</Text>
      </Pressable>
    </Card>
  );
}

function SetRow({
  set,
  weightUnit,
  previousValues,
  onUpdateSet,
  onCycleSetType,
  onDeleteSet,
}: {
  set: {
    id: string;
    setNumber: number;
    weight: number | null;
    reps: number | null;
    rpe: number | null;
    setType: SetType;
    isCompleted: boolean;
  };
  weightUnit: "KG" | "LBS";
  previousValues: ReturnType<typeof pickPreviousForSet>;
  onUpdateSet: (
    setId: string,
    data: { weight?: number; reps?: number; isCompleted?: boolean; setType?: SetType; rpe?: number | null },
  ) => void;
  onCycleSetType: (setId: string, setType: SetType) => void;
  onDeleteSet: (setId: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [weight, setWeight] = useState(
    set.weight != null ? String(fromKg(set.weight, weightUnit)) : "",
  );
  const [reps, setReps] = useState(set.reps?.toString() ?? "");
  const typeLabel = SET_TYPE_LABEL[set.setType] || String(set.setNumber);

  useEffect(() => {
    setWeight(set.weight != null ? String(fromKg(set.weight, weightUnit)) : "");
    setReps(set.reps?.toString() ?? "");
  }, [set.weight, set.reps, weightUnit]);

  const commit = () => {
    const w = parseOptionalNumber(weight);
    onUpdateSet(set.id, {
      weight: w !== undefined ? toKg(w, weightUnit) : undefined,
      reps: parseOptionalNumber(reps),
    });
  };

  const copyPrevious = () => {
    if (!previousValues) return;
    const w =
      previousValues.weight != null ? String(fromKg(previousValues.weight, weightUnit)) : "";
    const r = previousValues.reps?.toString() ?? "";
    setWeight(w);
    setReps(r);
    onUpdateSet(set.id, {
      weight: previousValues.weight ?? undefined,
      reps: previousValues.reps ?? undefined,
    });
  };

  const prevLabel = formatPreviousSet(previousValues);

  return (
    <View style={[styles.setRow, set.isCompleted && styles.setRowDone]}>
      <Pressable onPress={() => onCycleSetType(set.id, set.setType)} style={styles.setTypeBtn}>
        <Text style={[styles.setNumber, { color: setTypeColor(colors)[set.setType] }]}>{typeLabel}</Text>
      </Pressable>

      <Pressable
        onPress={copyPrevious}
        disabled={!previousValues}
        style={[styles.prevCell, !previousValues && styles.prevCellDisabled]}
      >
        <Text style={styles.prevText} numberOfLines={1}>
          {prevLabel}
        </Text>
      </Pressable>

      <TextInput
        style={[styles.setInput, set.isCompleted && styles.setInputDone]}
        value={weight}
        onChangeText={setWeight}
        onBlur={commit}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={colors.textDim}
      />
      <TextInput
        style={[styles.setInput, set.isCompleted && styles.setInputDone]}
        value={reps}
        onChangeText={setReps}
        onBlur={commit}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor={colors.textDim}
      />
      <Pressable
        onPress={() => onUpdateSet(set.id, { rpe: cycleRpe(set.rpe) })}
        style={styles.rpeCell}
      >
        <Text style={styles.rpeText}>{formatRpe(set.rpe)}</Text>
      </Pressable>
      <Pressable
        style={[styles.check, set.isCompleted && styles.checkDone]}
        onPress={() => onUpdateSet(set.id, { isCompleted: !set.isCompleted })}
      >
        {set.isCompleted ? (
          <Ionicons name="checkmark" size={18} color={colors.accent} />
        ) : null}
      </Pressable>
      <Pressable onPress={() => onDeleteSet(set.id)} hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.danger} />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  backBtn: { padding: 4 },
  volume: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
  workoutTitle: { fontSize: 28, fontWeight: "700", color: colors.text },
  meta: { color: colors.textMuted, fontSize: 15, marginTop: -4 },
  restBar: {
    backgroundColor: colors.accentMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  restLabel: { color: colors.accent, fontWeight: "600", fontSize: 15 },
  restTime: { flex: 1, color: colors.text, fontWeight: "700", fontSize: 28, textAlign: "center" },
  restHint: { color: colors.textDim, fontSize: 12 },
  scroll: { flex: 1 },
  scrollContent: { gap: spacing.md, paddingBottom: spacing.xl },
  exerciseHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  exerciseName: { flex: 1, color: colors.text, fontSize: 17, fontWeight: "600" },
  exerciseActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconBtn: { padding: 2 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  copyBtnText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  supersetBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 4 },
  supersetBadgeText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  prevMeta: { color: colors.textDim, fontSize: 12, marginTop: -4 },
  exerciseNotesInput: {
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 14,
    minHeight: 64,
    padding: spacing.sm,
    textAlignVertical: "top",
  },
  setHeader: { flexDirection: "row", gap: spacing.xs, paddingHorizontal: 2, marginTop: spacing.sm },
  setCol: { flex: 1, color: colors.textDim, fontSize: 11, fontWeight: "600", textAlign: "center" },
  setColNarrow: { flex: 0, width: 28 },
  setColPrev: { flex: 0, width: 48 },
  setColRpe: { flex: 0, width: 36 },
  setRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  setRowDone: { opacity: 0.85 },
  setNumber: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  setTypeBtn: { width: 28, alignItems: "center" },
  prevCell: {
    width: 48,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rpeCell: {
    width: 36,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.sm,
  },
  rpeText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  prevCellDisabled: { opacity: 0.35 },
  prevText: { fontSize: 11, color: colors.textMuted, fontWeight: "500", textAlign: "center" },
  setInput: {
    flex: 1,
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.sm,
    color: colors.text,
    paddingVertical: 8,
    paddingHorizontal: 6,
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    minWidth: 0,
  },
  setInputDone: { backgroundColor: colors.accentMuted },
  check: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceHover,
  },
  checkDone: { backgroundColor: colors.accentMuted },
  addSetBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.sm },
  addSet: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  pickerList: { maxHeight: 220 },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.md,
    marginBottom: 6,
  },
  pickerText: { color: colors.text, fontSize: 15, fontWeight: "500", flex: 1 },
  summaryGrid: { flexDirection: "row", gap: spacing.sm },
  summaryItem: {
    flex: 1,
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  summaryValue: { color: colors.text, fontSize: 18, fontWeight: "800" },
  summaryLabel: { color: colors.textDim, fontSize: 12, fontWeight: "600", marginTop: 2 },
  finishInput: {
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
    padding: spacing.md,
  },
  finishNotes: { minHeight: 86, textAlignVertical: "top" },
  footer: { gap: spacing.sm, paddingTop: spacing.sm },
});
