import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RectButton, Swipeable } from "react-native-gesture-handler";
import { ExerciseAvatar } from "../../src/components/exercise-avatar";
import {
  addSetToWorkout,
  addExerciseToWorkout,
  patchExerciseNotes,
  patchSetInWorkout,
  removeSetFromWorkout,
  reorderExercisesInWorkout,
  type ActiveWorkout,
} from "../../src/lib/active-workout-cache";
import { ReorderableExerciseList } from "../../src/components/reorderable-exercises";
import {
  Button,
  Card,
  HevyButton,
  Screen,
  SearchBar,
  SectionHeader,
} from "../../src/components/ui";
import { formatPreviousSet, pickPreviousForSet, type PreviousExerciseSession } from "../../src/lib/previous-set";
import { trpc, queryStaleTime } from "../../src/lib/trpc";
import { parseOptionalNumber } from "../../src/lib/workout-errors";
import { cycleRpe, formatRpe } from "../../src/lib/rpe";
import { useUserPreferences } from "../../src/lib/use-preferences";
import { fromKg, sumWorkoutSetVolume, toKg, tonnageFromKg, weightLabel } from "../../src/lib/units";
import { formatRestTime, useRestTimer } from "../../src/lib/rest-timer";
import {
  enqueueWorkoutMutation,
  getQueuedWorkoutMutationCount,
  isNetworkError,
  syncQueuedWorkoutMutations,
} from "../../src/lib/offline-workouts";
import { formatElapsedDuration } from "../../src/lib/format-duration";
import { useTheme, useThemedStyles, spacing, radius, type Palette } from "../../src/lib/theme";

const SET_TYPES = ["NORMAL", "WARMUP", "DROP", "FAILURE"] as const;
type SetType = (typeof SET_TYPES)[number];

const SET_TYPE_LABEL: Record<SetType, string> = {
  NORMAL: "",
  WARMUP: "W",
  DROP: "D",
  FAILURE: "F",
};

function cycleSetType(current: SetType): SetType {
  const idx = SET_TYPES.indexOf(current);
  return SET_TYPES[(idx + 1) % SET_TYPES.length]!;
}

const setTypeColor = (colors: Palette): Record<SetType, string> => ({
  NORMAL: colors.textMuted,
  WARMUP: colors.gold,
  DROP: colors.accentBright,
  FAILURE: colors.danger,
});

const REST_PRESETS = [60, 90, 120, 180, 300] as const;

function exercisesToSuperLinks(exercises: ActiveWorkout["exercises"]): boolean[] {
  return exercises.map(
    (exercise, index) =>
      index > 0 &&
      exercise.supersetGroup != null &&
      exercises[index - 1]?.supersetGroup != null &&
      exercise.supersetGroup === exercises[index - 1]?.supersetGroup,
  );
}

export default function ActiveWorkoutScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { weightUnit, defaultRestSeconds } = useUserPreferences();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const savePrefs = trpc.auth.updatePreferences.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
  });
  const { data: workout, isLoading, isFetching, refetch } = trpc.workout.active.useQuery(undefined, {
    staleTime: queryStaleTime.workoutActive,
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishName, setFinishName] = useState("");
  const [finishNotes, setFinishNotes] = useState("");
  const [pendingOffline, setPendingOffline] = useState(0);
  const [search, setSearch] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [reorderMode, setReorderMode] = useState(false);

  const closePicker = () => {
    setPickerOpen(false);
    setSearch("");
  };

  const exerciseIds = useMemo(
    () => workout?.exercises.map((e) => e.exercise.id) ?? [],
    [workout?.exercises],
  );

  const { data: previousMap } = trpc.workout.previousSets.useQuery(
    { exerciseIds },
    { enabled: exerciseIds.length > 0, staleTime: 60 * 1000 },
  );

  const { data: exercises } = trpc.exercise.list.useQuery(
    { search: search || undefined, limit: 30 },
    { enabled: pickerOpen },
  );

  const { secondsLeft, isRunning, start, tick, stop, setDefault } = useRestTimer();

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
      const result = await syncQueuedWorkoutMutations({
        invalidateActiveWorkout: () => utils.workout.active.invalidate(),
      });
      if (!mounted) return;
      setPendingOffline(result.remaining);
      if (result.synced > 0) {
        refetch();
        utils.workout.history.invalidate();
        utils.personalRecord.list.invalidate();
      }
      if (result.syncFailed) {
        Alert.alert("Sync failed", "Some workout changes couldn't be saved to the server.");
      }
    }
    syncOffline().catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [refetch, utils]);

  const patchActiveWorkout = (updater: (workout: ActiveWorkout) => ActiveWorkout) => {
    utils.workout.active.setData(undefined, (current) => {
      if (!current) return current;
      return updater(current);
    });
  };

  const updateSet = trpc.workout.updateSet.useMutation({
    onSuccess: (updatedSet) => {
      patchActiveWorkout((workout) => patchSetInWorkout(workout, updatedSet));
    },
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
    onSuccess: (newSet, { workoutExerciseId }) => {
      patchActiveWorkout((workout) => addSetToWorkout(workout, workoutExerciseId, newSet));
    },
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
    onSuccess: (_result, { setId }) => {
      patchActiveWorkout((workout) => removeSetFromWorkout(workout, setId));
    },
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
    onSuccess: (_updated, { workoutExerciseId, notes }) => {
      patchActiveWorkout((workout) => patchExerciseNotes(workout, workoutExerciseId, notes));
    },
    onError: async (e, variables) => {
      if (!isNetworkError(e)) {
        Alert.alert("Couldn't save notes", e.message);
        return;
      }
      await enqueueWorkoutMutation("updateExerciseNotes", variables);
      setPendingOffline(await getQueuedWorkoutMutationCount());
    },
  });

  const reorderExercises = trpc.workout.reorderExercises.useMutation({
    onSuccess: (updatedWorkout) => {
      utils.workout.active.setData(undefined, updatedWorkout);
    },
    onError: (e) => Alert.alert("Couldn't reorder", e.message),
  });

  const handleSetUpdate = (
    setId: string,
    data: { weight?: number; reps?: number; isCompleted?: boolean; setType?: SetType; rpe?: number | null },
  ) => {
    if (data.isCompleted === true) start();
    updateSet.mutate({ setId, ...data });
  };

  const addExercise = trpc.workout.addExercise.useMutation({
    onSuccess: (newExercise) => {
      closePicker();
      patchActiveWorkout((workout) => addExerciseToWorkout(workout, newExercise));
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
      router.replace(`/workout/${result.workout.id}`);
    },
    onError: async (e, variables) => {
      if (!isNetworkError(e)) {
        Alert.alert("Error", e.message);
        return;
      }
      await enqueueWorkoutMutation("finishWorkout", variables);
      utils.workout.active.setData(undefined, null);
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

  const completedVolume = useMemo(() => {
    if (!workout) return 0;
    return sumWorkoutSetVolume(workout.exercises, weightUnit, { completedOnly: true });
  }, [workout, weightUnit]);

  const displayVolume = useMemo(() => {
    if (!workout) return 0;
    return sumWorkoutSetVolume(workout.exercises, weightUnit, { completedOnly: false });
  }, [workout, weightUnit]);

  const completedSetCount = useMemo(() => {
    if (!workout) return 0;
    return workout.exercises.reduce(
      (sum, ex) => sum + ex.sets.filter((set) => set.isCompleted).length,
      0,
    );
  }, [workout]);

  useEffect(() => {
    if (!workout) return;

    const startedAt = workout.startedAt;
    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));

    const id = setInterval(() => {
      const fresh = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      setElapsedSeconds(Math.max(0, fresh));
    }, 1000);

    return () => clearInterval(id);
  }, [workout?.id, workout?.startedAt?.getTime()]);

  useEffect(() => {
    if (!workout) return;
    setFinishName(workout.name ?? "Workout");
    setFinishNotes(workout.notes ?? "");
  }, [workout?.id]);

  const openRestTimerSettings = () => {
    Alert.alert(
      "Rest timer",
      `Default rest between sets: ${formatRestTime(defaultRestSeconds)}`,
      [
        ...REST_PRESETS.map((seconds) => ({
          text: formatRestTime(seconds),
          onPress: () => {
            setDefault(seconds);
            savePrefs.mutate({ defaultRestSeconds: seconds });
          },
        })),
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const openWorkoutSettings = () => {
    Alert.alert("Workout settings", undefined, [
      { text: "Workout Settings", onPress: () => router.push("/settings") },
      ...(reorderMode
        ? [{ text: "Done reordering", onPress: () => setReorderMode(false) }]
        : [{ text: "Reorder exercises", onPress: () => setReorderMode(true) }]),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const confirmDiscard = () => {
    Alert.alert("Discard workout?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => cancel.mutate({ workoutId: workout!.id }) },
    ]);
  };

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
            <Ionicons name="chevron-down" size={24} color={colors.accent} />
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
    <>
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerSide} hitSlop={8}>
          <Ionicons name="chevron-down" size={24} color={colors.accent} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {workout.name ?? "Log Workout"}
        </Text>
        <View style={styles.headerActions}>
          <Pressable onPress={openRestTimerSettings} hitSlop={8} style={styles.headerIconBtn}>
            <Ionicons name="timer-outline" size={22} color={colors.text} />
          </Pressable>
          <Button
            label="Finish"
            size="sm"
            variant="primary"
            onPress={() => setFinishOpen(true)}
            loading={finish.isPending}
          />
        </View>
      </View>

      <View style={styles.statsBar}>
        <StatsItem label="Duration" value={formatElapsedDuration(elapsedSeconds)} />
        <View style={styles.statsDivider} />
        <StatsItem
          label="Volume"
          value={`${Math.round(displayVolume).toLocaleString()} ${weightLabel(weightUnit)}`}
        />
        <View style={styles.statsDivider} />
        <StatsItem label="Sets" value={String(completedSetCount)} />
        <View style={styles.statsDivider} />
        <Pressable
          style={styles.statsIconCell}
          onPress={() => router.push("/(tabs)/progress")}
          hitSlop={8}
        >
          <Ionicons name="body-outline" size={22} color={colors.accent} />
        </Pressable>
      </View>

      {pendingOffline > 0 ? (
        <Text style={styles.offlineMeta}>{pendingOffline} offline edits pending sync</Text>
      ) : null}

      {isRunning ? (
        <Pressable style={[styles.restBar, styles.contentPad]} onPress={stop}>
          <Text style={styles.restLabel}>Rest</Text>
          <Text style={styles.restTime}>{formatRestTime(secondsLeft)}</Text>
          <Text style={styles.restHint}>Tap to skip</Text>
        </Pressable>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, styles.contentPad]}
      >
        {reorderMode ? (
          <Card>
            <SectionHeader title="Reorder exercises" />
            <ReorderableExerciseList
              items={workout.exercises.map((exercise) => ({
                exerciseId: exercise.id,
                name: exercise.exercise.name,
              }))}
              superLinks={exercisesToSuperLinks(workout.exercises)}
              onReorder={(items) => {
                const orderedIds = items.map((item) => item.exerciseId);
                patchActiveWorkout((current) => reorderExercisesInWorkout(current, orderedIds));
                reorderExercises.mutate({
                  workoutId: workout.id,
                  workoutExerciseIds: orderedIds,
                });
              }}
              onToggleLink={() => undefined}
              onRemove={() => undefined}
            />
            <Button label="Done reordering" fullWidth onPress={() => setReorderMode(false)} />
          </Card>
        ) : (
          workout.exercises.map((exercise) => (
            <ExerciseBlock
              key={exercise.id}
              name={exercise.exercise.name}
              imageUrl={exercise.exercise.imageUrl ?? null}
              supersetGroup={exercise.supersetGroup ?? null}
              workoutExerciseId={exercise.id}
              sets={exercise.sets}
              notes={exercise.notes ?? null}
              previous={previousMap?.[exercise.exercise.id] ?? null}
              onUpdateSet={handleSetUpdate}
              onAddSet={() => addSet.mutate({ workoutExerciseId: exercise.id })}
              onDeleteSet={(setId) => deleteSet.mutate({ setId })}
              onUpdateNotes={(notes) => updateExerciseNotes.mutate({ workoutExerciseId: exercise.id, notes })}
              weightUnit={weightUnit}
            />
          ))
        )}

        {!reorderMode && finishOpen ? (
          <Card>
            <SectionHeader title="Finish Workout" />
            <View style={styles.summaryGrid}>
              <SummaryItem label="Sets" value={completedSetCount} />
              <SummaryItem
                label="Volume"
                value={`${Math.round(completedVolume).toLocaleString()} ${weightLabel(weightUnit)}`}
              />
              <SummaryItem label="Time" value={formatElapsedDuration(elapsedSeconds)} />
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
        <Pressable onPress={confirmDiscard} hitSlop={8} style={styles.footerSide}>
          <Text style={styles.discardText}>Discard Workout</Text>
        </Pressable>
        {!reorderMode ? (
          <Button
            label="Add Exercise"
            icon="add"
            variant="secondary"
            size="sm"
            onPress={() => setPickerOpen(true)}
          />
        ) : (
          <View style={styles.footerSide} />
        )}
        <Pressable onPress={openWorkoutSettings} hitSlop={8} style={[styles.footerSide, styles.footerSideEnd]}>
          <Text style={styles.settingsText}>Settings</Text>
        </Pressable>
      </View>
    </Screen>

    <Modal
      visible={pickerOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closePicker}
    >
      <View style={[styles.pickerModal, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom }]}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>Add Exercise</Text>
          <Pressable onPress={closePicker} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
        <SearchBar placeholder="Search exercise" value={search} onChangeText={setSearch} />
        <FlatList
          data={exercises ?? []}
          keyExtractor={(item) => item.id}
          style={styles.pickerList}
          contentContainerStyle={styles.pickerListContent}
          keyboardShouldPersistTaps="handled"
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
        <Button label="Close" variant="ghost" fullWidth onPress={closePicker} />
      </View>
    </Modal>
    </>
  );
}


function StatsItem({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.statsItem}>
      <Text style={styles.statsValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statsLabel}>{label}</Text>
    </View>
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
  imageUrl,
  workoutExerciseId,
  supersetGroup,
  sets,
  notes,
  previous,
  onUpdateSet,
  onAddSet,
  onDeleteSet,
  onUpdateNotes,
  weightUnit,
}: {
  name: string;
  imageUrl?: string | null;
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
  onAddSet: () => void;
  onDeleteSet: (setId: string) => void;
  onUpdateNotes: (notes: string | null) => void;
  weightUnit: "KG" | "LBS";
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [notesOpen, setNotesOpen] = useState(Boolean(notes));
  const [draftNotes, setDraftNotes] = useState(notes ?? "");

  useEffect(() => {
    setDraftNotes(notes ?? "");
    setNotesOpen(Boolean(notes));
  }, [notes, workoutExerciseId]);

  return (
    <Card>
      {supersetGroup != null ? (
        <View style={styles.supersetBadge}>
          <Ionicons name="git-merge" size={12} color={colors.accent} />
          <Text style={styles.supersetBadgeText}>Superset {supersetGroup}</Text>
        </View>
      ) : null}
      <View style={styles.exerciseHeader}>
        <ExerciseAvatar name={name} imageUrl={imageUrl} size={36} />
        <Text style={styles.exerciseName}>{name}</Text>
        <Pressable onPress={() => setNotesOpen((open) => !open)} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name={notesOpen ? "document-text" : "document-text-outline"} size={17} color={colors.accent} />
        </Pressable>
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
        <Text style={[styles.setCol, styles.setColPrev]}>PREVIOUS</Text>
        <View style={styles.setColKgHeader}>
          <Ionicons name="flash-outline" size={11} color={colors.textDim} />
          <Text style={styles.setColKgHeaderText}>{weightLabel(weightUnit).toUpperCase()}</Text>
        </View>
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
  onDeleteSet: (setId: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [weight, setWeight] = useState(
    set.weight != null && set.weight > 0 ? String(fromKg(set.weight, weightUnit)) : "",
  );
  const [reps, setReps] = useState(set.reps != null && set.reps > 0 ? String(set.reps) : "");
  const typeLabel = SET_TYPE_LABEL[set.setType] || String(set.setNumber);

  useEffect(() => {
    setWeight(set.weight != null && set.weight > 0 ? String(fromKg(set.weight, weightUnit)) : "");
    setReps(set.reps != null && set.reps > 0 ? String(set.reps) : "");
  }, [set.weight, set.reps, weightUnit]);

  const flushDraft = (useGhost = false) => {
    const parsedWeight = parseOptionalNumber(weight);
    const parsedReps = parseOptionalNumber(reps);

    let weightKg: number | undefined;
    if (parsedWeight !== undefined) {
      weightKg = toKg(parsedWeight, weightUnit);
    } else if (useGhost && previousValues?.weight != null) {
      weightKg = previousValues.weight;
    }

    let repsValue: number | undefined;
    if (parsedReps !== undefined) {
      repsValue = parsedReps;
    } else if (useGhost && previousValues?.reps != null) {
      repsValue = previousValues.reps;
    }

    return { weight: weightKg, reps: repsValue };
  };

  const commit = () => {
    onUpdateSet(set.id, flushDraft());
  };

  const weightPlaceholder = "—";
  const repsPlaceholder = "—";

  const prevDisplay = (() => {
    const w = previousValues?.weight != null ? fromKg(previousValues.weight, weightUnit) : null;
    const r = previousValues?.reps != null ? previousValues.reps : null;
    if (w != null && r != null) return `${w}×${r}`;
    if (w != null) return `${w}`;
    if (r != null) return `×${r}`;
    return "—";
  })();

  const confirmDelete = () => {
    const hasData = set.weight != null || set.reps != null || set.isCompleted;
    if (!hasData) {
      onDeleteSet(set.id);
      return;
    }
    Alert.alert("Delete set?", "Remove this set from the workout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDeleteSet(set.id) },
    ]);
  };

  const renderDeleteAction = () => (
    <RectButton style={styles.deleteAction} onPress={confirmDelete}>
      <Text style={styles.deleteActionText}>Delete</Text>
    </RectButton>
  );

  return (
    <Swipeable renderRightActions={renderDeleteAction} overshootRight={false} friction={2}>
      <View style={[styles.setRow, set.isCompleted && styles.setRowDone]}>
        <Pressable
          onPress={() => onUpdateSet(set.id, { ...flushDraft(), setType: cycleSetType(set.setType) })}
          style={styles.setTypeBtn}
        >
          <Text style={[styles.setNumber, { color: setTypeColor(colors)[set.setType] }]}>{typeLabel}</Text>
        </Pressable>

        <View style={styles.prevCol}>
          <Text style={styles.prevColText}>{prevDisplay}</Text>
        </View>

        <TextInput
          style={[styles.setInput, set.isCompleted && styles.setInputDone]}
          value={weight}
          onChangeText={setWeight}
          onBlur={commit}
          keyboardType="decimal-pad"
          placeholder={weightPlaceholder}
          placeholderTextColor={colors.textDim}
        />
        <TextInput
          style={[styles.setInput, set.isCompleted && styles.setInputDone]}
          value={reps}
          onChangeText={setReps}
          onBlur={commit}
          keyboardType="number-pad"
          placeholder={repsPlaceholder}
          placeholderTextColor={colors.textDim}
        />
        <Pressable
          onPress={() => onUpdateSet(set.id, { ...flushDraft(), rpe: cycleRpe(set.rpe) })}
          style={styles.rpeCell}
        >
          <Text style={styles.rpeText}>{formatRpe(set.rpe)}</Text>
        </Pressable>
        <Pressable
          style={[styles.check, set.isCompleted && styles.checkDone]}
          onPress={() =>
            onUpdateSet(set.id, { ...flushDraft(true), isCompleted: !set.isCompleted })
          }
        >
          {set.isCompleted ? (
            <Ionicons name="checkmark" size={18} color={colors.accent} />
          ) : null}
        </Pressable>
      </View>
    </Swipeable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  backBtn: { padding: 4 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  headerSide: { flex: 1, justifyContent: "center" },
  headerTitle: {
    flex: 2,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  headerActions: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.xs,
  },
  headerIconBtn: { padding: 2 },
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    backgroundColor: colors.bgElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  statsItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 1 },
  statsIconCell: { flex: 1, alignItems: "center", justifyContent: "center", gap: 1 },
  statsValue: { fontSize: 13, fontWeight: "800", color: colors.text },
  statsLabel: { fontSize: 10, fontWeight: "600", color: colors.textMuted },
  statsDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    backgroundColor: colors.separator,
  },
  offlineMeta: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  contentPad: { paddingHorizontal: spacing.lg },
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
  iconBtn: { padding: 2 },
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
  setColRpe: { flex: 0, width: 36 },
  setColPrev: { flex: 0, width: 70 },
  setColKgHeader: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
  setColKgHeaderText: { color: colors.textDim, fontSize: 11, fontWeight: "600" },
  prevCol: { width: 70, alignItems: "center" as const, justifyContent: "center" as const },
  prevColText: { color: colors.textMuted, fontSize: 13, textAlign: "center" as const },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.bgElevated,
  },
  setRowDone: { opacity: 0.85 },
  setNumber: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  setTypeBtn: { width: 28, alignItems: "center" },
  rpeCell: {
    width: 36,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.sm,
  },
  rpeText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
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
  deleteAction: {
    backgroundColor: colors.danger,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    marginVertical: 1,
    borderRadius: radius.sm,
    width: 88,
  },
  deleteActionText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  addSetBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.sm },
  addSet: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  pickerModal: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  pickerList: { flex: 1 },
  pickerListContent: { paddingBottom: spacing.md, gap: 6 },
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
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  footerSide: { minWidth: 88 },
  footerSideEnd: { alignItems: "flex-end" },
  discardText: { color: colors.danger, fontSize: 14, fontWeight: "600" },
  settingsText: { color: colors.accent, fontSize: 14, fontWeight: "600" },
});
