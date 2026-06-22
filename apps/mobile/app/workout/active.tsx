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
import { formatRestTime, useRestTimer } from "../../src/lib/rest-timer";
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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const { data: workout, isLoading, refetch } = trpc.workout.active.useQuery();
  const [pickerOpen, setPickerOpen] = useState(false);
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

  const updateSet = trpc.workout.updateSet.useMutation({ onSuccess: () => refetch() });
  const addSet = trpc.workout.addSet.useMutation({ onSuccess: () => refetch() });
  const deleteSet = trpc.workout.deleteSet.useMutation({ onSuccess: () => refetch() });

  const handleSetUpdate = (
    setId: string,
    data: { weight?: number; reps?: number; isCompleted?: boolean; setType?: SetType },
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
    onError: (e) => Alert.alert("Error", e.message),
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
      Alert.alert(
        "Workout saved!",
        prCount > 0 ? `You hit ${prCount} new personal record${prCount > 1 ? "s" : ""}!` : "Great session.",
        [{ text: "Done", onPress: () => router.back() }],
      );
    },
    onError: (e) => Alert.alert("Error", e.message),
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

  if (isLoading || !workout) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} size="large" />
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
      <Text style={styles.meta}>{workout.exercises.length} exercises</Text>

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
            sets={exercise.sets}
            previous={previousMap?.[exercise.exercise.id] ?? null}
            onUpdateSet={handleSetUpdate}
            onCycleSetType={(setId, setType) =>
              handleSetUpdate(setId, { setType: cycleSetType(setType) })
            }
            onAddSet={() => addSet.mutate({ workoutExerciseId: exercise.id })}
            onDeleteSet={(setId) => deleteSet.mutate({ setId })}
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
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <HevyButton
          label="Finish Workout"
          onPress={() => finish.mutate({ workoutId: workout.id })}
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

function ExerciseBlock({
  name,
  supersetGroup,
  sets,
  previous,
  onUpdateSet,
  onCycleSetType,
  onAddSet,
  onDeleteSet,
}: {
  name: string;
  supersetGroup?: number | null;
  sets: Array<{
    id: string;
    setNumber: number;
    weight: number | null;
    reps: number | null;
    setType: SetType;
    isCompleted: boolean;
  }>;
  previous: PreviousExerciseSession | null;
  onUpdateSet: (
    setId: string,
    data: { weight?: number; reps?: number; isCompleted?: boolean; setType?: SetType },
  ) => void;
  onCycleSetType: (setId: string, setType: SetType) => void;
  onAddSet: () => void;
  onDeleteSet: (setId: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const lastSet = sets[sets.length - 1];

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
        {previous ? (
          <Pressable onPress={copyLastSet} hitSlop={8} style={styles.copyBtn}>
            <Ionicons name="copy-outline" size={16} color={colors.accent} />
            <Text style={styles.copyBtnText}>Copy prev</Text>
          </Pressable>
        ) : null}
      </View>

      {previous?.finishedAt ? (
        <Text style={styles.prevMeta}>
          Last: {formatPreviousSet(pickPreviousForSet(previous, 1))} ·{" "}
          {new Date(previous.finishedAt).toLocaleDateString()}
        </Text>
      ) : null}

      <View style={styles.setHeader}>
        <Text style={[styles.setCol, styles.setColNarrow]}>SET</Text>
        <Text style={[styles.setCol, styles.setColPrev]}>PREV</Text>
        <Text style={styles.setCol}>KG</Text>
        <Text style={styles.setCol}>REPS</Text>
        <Text style={[styles.setCol, styles.setColNarrow]}>✓</Text>
      </View>
      {sets.map((set) => (
        <SetRow
          key={set.id}
          set={set}
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
    setType: SetType;
    isCompleted: boolean;
  };
  previousValues: ReturnType<typeof pickPreviousForSet>;
  onUpdateSet: (
    setId: string,
    data: { weight?: number; reps?: number; isCompleted?: boolean; setType?: SetType },
  ) => void;
  onCycleSetType: (setId: string, setType: SetType) => void;
  onDeleteSet: (setId: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [weight, setWeight] = useState(set.weight?.toString() ?? "");
  const [reps, setReps] = useState(set.reps?.toString() ?? "");
  const typeLabel = SET_TYPE_LABEL[set.setType] || String(set.setNumber);

  useEffect(() => {
    setWeight(set.weight?.toString() ?? "");
    setReps(set.reps?.toString() ?? "");
  }, [set.weight, set.reps]);

  const commit = () => {
    onUpdateSet(set.id, {
      weight: weight ? Number(weight) : undefined,
      reps: reps ? Number(reps) : undefined,
    });
  };

  const copyPrevious = () => {
    if (!previousValues) return;
    const w = previousValues.weight?.toString() ?? "";
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
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  copyBtnText: { color: colors.accent, fontSize: 13, fontWeight: "600" },
  supersetBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 4 },
  supersetBadgeText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  prevMeta: { color: colors.textDim, fontSize: 12, marginTop: -4 },
  setHeader: { flexDirection: "row", gap: spacing.xs, paddingHorizontal: 2, marginTop: spacing.sm },
  setCol: { flex: 1, color: colors.textDim, fontSize: 11, fontWeight: "600", textAlign: "center" },
  setColNarrow: { flex: 0, width: 28 },
  setColPrev: { flex: 0, width: 52 },
  setRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  setRowDone: { opacity: 0.85 },
  setNumber: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  setTypeBtn: { width: 28, alignItems: "center" },
  prevCell: {
    width: 52,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
  },
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
  footer: { gap: spacing.sm, paddingTop: spacing.sm },
});
