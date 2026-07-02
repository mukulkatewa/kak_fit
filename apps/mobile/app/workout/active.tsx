import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RectButton, Swipeable } from "react-native-gesture-handler";
import { ExerciseAvatar } from "../../src/components/exercise-avatar";
import {
  addExerciseToWorkout,
  createOptimisticExercise,
  patchExerciseNotes,
  reorderExercisesInWorkout,
  type ActiveWorkout,
} from "../../src/lib/active-workout-cache";
import { ReorderableExerciseList } from "../../src/components/reorderable-exercises";
import { QueryErrorBoundary } from "../../src/components/query-error-boundary";
import {
  Button,
  Card,
  HevyButton,
  Screen,
  SearchBar,
  SectionHeader,
  ThemedDialog,
  useToast,
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
import { useWorkoutSetMutationQueue } from "../../src/lib/workout-mutation-queue";
import { flexFill, webFlexScreen } from "../../src/lib/layout-constants";
import {
  WORKOUT_HISTORY_PAGE_SIZE,
  workoutHistoryInfiniteOptions,
} from "../../src/lib/workout-history-query";
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

function ActiveWorkoutScreen() {
  const mounted = useRef(true);
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { weightUnit, defaultRestSeconds } = useUserPreferences();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const { showToast } = useToast();
  const savePrefs = trpc.auth.updatePreferences.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
    onError: (e) => showToast(e.message, "error"),
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
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [restSettingsOpen, setRestSettingsOpen] = useState(false);
  const [deleteSetDialog, setDeleteSetDialog] = useState<{ visible: boolean; setId: string | null }>({
    visible: false,
    setId: null,
  });
  const [deleteExerciseDialog, setDeleteExerciseDialog] = useState<{
    visible: boolean;
    workoutExerciseId?: string;
    name?: string;
  }>({ visible: false });

  const closePicker = () => {
    setPickerOpen(false);
    setSearch("");
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const exerciseIds = useMemo(
    () => workout?.exercises.map((e) => e.exercise.id) ?? [],
    [workout?.exercises],
  );

  const previousMap = workout?.previousSets;

  useEffect(() => {
    void utils.workout.history.prefetchInfinite(
      { limit: WORKOUT_HISTORY_PAGE_SIZE },
      workoutHistoryInfiniteOptions,
    );
    void utils.personalRecord.list.prefetch(undefined, {
      staleTime: queryStaleTime.progress,
    });
  }, [utils]);

  useEffect(() => {
    if (!workout?.exercises.length) return;
    const urls = workout.exercises
      .map((e) => e.exercise.imageUrl)
      .filter((url): url is string => Boolean(url));
    if (urls.length > 0) {
      void Image.prefetch(urls, "memory-disk");
    }
  }, [workout?.exercises]);

  const exercisesInWorkout = useMemo(() => new Set(exerciseIds), [exerciseIds]);

  const { data: exercises } = trpc.exercise.list.useQuery(
    { search: search || undefined, limit: 30 },
    { enabled: pickerOpen },
  );

  const { secondsLeft, isRunning, start, tick, stop, setDefault, addSeconds } = useRestTimer();

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    const id = setInterval(() => {
      if (mounted.current) {
        tick();
      }
    }, 1000);

    return () => {
      clearInterval(id);
    };
  }, [isRunning, tick]);

  useEffect(() => {
    let syncMounted = true;
    let syncTimer: ReturnType<typeof setTimeout> | null = null;

    async function syncOffline() {
      if (!syncMounted) return;

      try {
        const before = await getQueuedWorkoutMutationCount();
        if (!syncMounted) return;

        if (mounted.current) {
          setPendingOffline(before);
        }

        const result = await syncQueuedWorkoutMutations({
          invalidateActiveWorkout: () => utils.workout.active.invalidate(),
        });

        if (!syncMounted) return;

        if (mounted.current) {
          setPendingOffline(result.remaining);
        }

        if (result.synced > 0) {
          refetch();
          utils.workout.history.invalidate();
          utils.personalRecord.list.invalidate();
        }
        if (result.syncFailed) {
          showToast("Some workout changes couldn't be saved to the server.", "error");
        }

        if (result.remaining > 0 && syncMounted) {
          syncTimer = setTimeout(() => {
            void syncOffline();
          }, 5000);
        }
      } catch {
        // Ignore sync errors — will retry on next interval or remount
      }
    }

    void syncOffline();

    return () => {
      syncMounted = false;
      if (syncTimer) clearTimeout(syncTimer);
    };
  }, [refetch, utils, showToast]);

  const patchActiveWorkout = useCallback(
    (updater: (workout: ActiveWorkout) => ActiveWorkout) => {
      utils.workout.active.setData(undefined, (current) => {
        if (!current) return current;
        return updater(current);
      });
    },
    [utils.workout.active],
  );

  const getActiveWorkout = useCallback(
    () => utils.workout.active.getData(),
    [utils.workout.active],
  );

  const setActiveWorkout = useCallback(
    (updater: (current: ActiveWorkout | null | undefined) => ActiveWorkout | null | undefined) => {
      utils.workout.active.setData(undefined, updater);
    },
    [utils.workout.active],
  );

  const {
    updateSet,
    addSet,
    deleteSet,
    retrySync,
    pendingCount: pendingSetMutations,
    isProcessing: isSyncingSets,
    isReplaying: isReplayingSetMutations,
    isReady: setMutationQueueReady,
    lastError: setMutationError,
  } = useWorkoutSetMutationQueue({
    workoutId: workout?.id,
    getWorkout: getActiveWorkout,
    setWorkout: setActiveWorkout,
    onError: (message) => showToast(message, "error"),
  });
  const totalPendingMutations = pendingOffline + pendingSetMutations;
  const deleteExercise = trpc.workout.deleteExercise.useMutation({
    onSuccess: (updatedWorkout) => {
      patchActiveWorkout((workout) => ({
        ...updatedWorkout,
        previousSets: workout.previousSets ?? {},
      }));
      setDeleteExerciseDialog({ visible: false });
    },
    onError: (e) => showToast(e.message, "error"),
  });
  const updateExerciseNotes = trpc.workout.updateExerciseNotes.useMutation({
    onSuccess: (_updated, { workoutExerciseId, notes }) => {
      patchActiveWorkout((workout) => patchExerciseNotes(workout, workoutExerciseId, notes));
    },
    onError: async (e, variables) => {
      if (!isNetworkError(e)) {
        showToast(e.message, "error");
        return;
      }
      await enqueueWorkoutMutation("updateExerciseNotes", variables);
      setPendingOffline(await getQueuedWorkoutMutationCount());
    },
  });

  const reorderExercises = trpc.workout.reorderExercises.useMutation({
    onSuccess: (updatedWorkout) => {
      utils.workout.active.setData(undefined, (current) =>
        current ? { ...updatedWorkout, previousSets: current.previousSets ?? {} } : null,
      );
    },
    onError: (e) => showToast(e.message, "error"),
  });

  const handleSetUpdate = (
    setId: string,
    data: { weight?: number; reps?: number; isCompleted?: boolean; setType?: SetType; rpe?: number | null },
  ) => {
    if (data.isCompleted === true) start();
    updateSet({ setId, ...data });
  };

  const handleAddSet = (workoutExerciseId: string) => {
    addSet({ workoutExerciseId });
  };

  const handleDeleteSet = (setId: string) => {
    deleteSet({ setId });
    setDeleteSetDialog({ visible: false, setId: null });
  };

  const addExercise = trpc.workout.addExercise.useMutation({
    onMutate: async (variables) => {
      const fetched = await utils.workout.previousSets.fetch({
        exerciseIds: [variables.exerciseId],
      });
      return { previousSets: fetched };
    },
    onSuccess: (newExercise, variables, context) => {
      patchActiveWorkout((workout) => {
        const updated = addExerciseToWorkout(workout, newExercise);
        return {
          ...updated,
          previousSets: {
            ...(workout.previousSets ?? {}),
            ...(context?.previousSets ?? {}),
          },
        };
      });

      const exerciseName =
        exercises?.find((e) => e.id === variables.exerciseId)?.name ?? "Exercise";
      showToast(`${exerciseName} added`, "success");
    },
    onError: async (e, variables) => {
      if (!isNetworkError(e)) {
        showToast(e.message, "error");
        return;
      }
      await enqueueWorkoutMutation("addExercise", variables);
      setPendingOffline(await getQueuedWorkoutMutationCount());

      const meta = exercises?.find((item) => item.id === variables.exerciseId);
      patchActiveWorkout((workout) =>
        addExerciseToWorkout(
          workout,
          createOptimisticExercise(workout, variables, {
            name: meta?.name ?? "Exercise",
            imageUrl: meta?.imageUrl ?? null,
          }),
        ),
      );
      showToast(`${meta?.name ?? "Exercise"} added (will sync later)`, "info");
    },
  });

  const finish = trpc.workout.finish.useMutation({
    onSuccess: (result) => {
      setFinishOpen(false);
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
        showToast(e.message, "error");
        return;
      }
      await enqueueWorkoutMutation("finishWorkout", variables);
      utils.workout.active.setData(undefined, null);
      setPendingOffline(await getQueuedWorkoutMutationCount());
      showToast("Saved offline — will sync when you're back online.", "info");
      router.back();
    },
  });

  const cancel = trpc.workout.discardActive.useMutation({
    onSuccess: () => {
      setDiscardConfirmOpen(false);
      setDiscardError(null);
      utils.workout.active.setData(undefined, null);
      utils.workout.active.invalidate();
      router.back();
    },
    onError: (e) => {
      setDiscardError(e.message);
      setDiscardConfirmOpen(true);
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

  const restTimerLabel = isRunning
    ? formatRestTime(secondsLeft)
    : defaultRestSeconds === 0
      ? "OFF"
      : formatRestTime(defaultRestSeconds);

  useEffect(() => {
    if (!workout) {
      if (mounted.current) {
        setElapsedSeconds(0);
      }
      return;
    }

    const startedAt = new Date(workout.startedAt).getTime();

    const updateElapsed = () => {
      if (!mounted.current) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      setElapsedSeconds(elapsed);
    };

    updateElapsed();
    const id = setInterval(updateElapsed, 1000);

    return () => {
      clearInterval(id);
    };
  }, [workout?.id, workout?.startedAt]);

  useEffect(() => {
    if (!workout) return;
    if (!mounted.current) return;
    setFinishName(workout.name ?? "Workout");
    setFinishNotes(workout.notes ?? "");
  }, [workout?.id, workout?.name, workout?.notes]);

  const openRestTimerSettings = () => {
    setRestSettingsOpen(true);
  };

  const handleRequestDeleteSet = (setId: string, hasData: boolean) => {
    if (!hasData) {
      handleDeleteSet(setId);
      return;
    }
    setDeleteSetDialog({ visible: true, setId });
  };

  const openDiscardConfirm = () => {
    setDiscardError(null);
    setDiscardConfirmOpen(true);
  };

  const handleDiscardWorkout = () => {
    cancel.mutate();
  };

  if (isLoading || (isFetching && !workout) || (workout && !setMutationQueueReady)) {
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
    <Screen padded={false} style={flexFill}>
      <View style={styles.mainColumn}>
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

      {isReplayingSetMutations ? (
        <View style={styles.syncBanner}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.syncBannerText}>Restoring unsaved changes…</Text>
        </View>
      ) : isSyncingSets ? (
        <View style={styles.syncBanner}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.syncBannerText}>
            {totalPendingMutations > 1
              ? `Syncing ${totalPendingMutations} changes…`
              : "Syncing changes…"}
          </Text>
        </View>
      ) : totalPendingMutations > 0 ? (
        <Text style={styles.offlineMeta}>
          {totalPendingMutations} change{totalPendingMutations === 1 ? "" : "s"} pending sync
        </Text>
      ) : null}

      {setMutationError ? (
        <Pressable style={styles.syncErrorBanner} onPress={retrySync}>
          <Ionicons name="cloud-offline-outline" size={16} color={colors.danger} />
          <Text style={styles.syncErrorText}>{setMutationError}</Text>
          <Text style={styles.syncRetryText}>Tap to retry</Text>
        </Pressable>
      ) : null}

      {isRunning ? (
        <View style={[styles.restBar, styles.contentPad]}>
          <Pressable onPress={() => addSeconds(-60)} hitSlop={8} style={styles.restAdjustBtn}>
            <Text style={styles.restAdjustText}>-1m</Text>
          </Pressable>
          <Pressable onPress={stop} style={styles.restCenter}>
            <View style={styles.restCenterTop}>
              <Text style={styles.restLabel}>Rest</Text>
              <Text style={styles.restTime}>{formatRestTime(secondsLeft)}</Text>
            </View>
            <Text style={styles.restHint}>Tap to skip</Text>
          </Pressable>
          <Pressable onPress={() => addSeconds(60)} hitSlop={8} style={styles.restAdjustBtn}>
            <Text style={styles.restAdjustText}>+1m</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, styles.contentPad]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={Platform.OS !== "web"}
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
              onRemove={(index) => {
                const exercise = workout.exercises[index];
                if (!exercise) return;
                setDeleteExerciseDialog({
                  visible: true,
                  workoutExerciseId: exercise.id,
                  name: exercise.exercise.name,
                });
              }}
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
              onAddSet={() => handleAddSet(exercise.id)}
              onRequestDeleteSet={handleRequestDeleteSet}
              onUpdateNotes={(notes) => updateExerciseNotes.mutate({ workoutExerciseId: exercise.id, notes })}
              onRequestDeleteExercise={() =>
                setDeleteExerciseDialog({
                  visible: true,
                  workoutExerciseId: exercise.id,
                  name: exercise.exercise.name,
                })
              }
              restTimerLabel={restTimerLabel}
              weightUnit={weightUnit}
            />
          ))
        )}

        {!reorderMode ? (
          <View style={styles.workoutActions}>
            <Button
              label="Add Exercise"
              icon="add"
              variant="primary"
              fullWidth
              onPress={() => setPickerOpen(true)}
            />
            <View style={styles.secondaryActionsRow}>
              <Pressable onPress={() => setSettingsOpen(true)} hitSlop={8} style={styles.secondaryActionBtn}>
                <Text style={styles.settingsText}>Settings</Text>
              </Pressable>
              <Pressable onPress={openDiscardConfirm} hitSlop={8} style={styles.secondaryActionBtn}>
                <Text style={styles.discardText}>Discard Workout</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
      </View>
    </Screen>

    <Modal
      visible={finishOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setFinishOpen(false)}
    >
      <Screen scroll style={styles.finishModal}>
        <View style={styles.finishModalHeader}>
          <Pressable onPress={() => setFinishOpen(false)} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.finishModalTitle}>Finish Workout</Text>
          <View style={styles.finishModalHeaderSpacer} />
        </View>

        <View style={styles.summaryGrid}>
          <SummaryItem label="Duration" value={formatElapsedDuration(elapsedSeconds)} />
          <SummaryItem
            label="Volume"
            value={`${Math.round(completedVolume).toLocaleString()} ${weightLabel(weightUnit)}`}
          />
          <SummaryItem label="Sets" value={completedSetCount} />
          <SummaryItem label="Exercises" value={workout.exercises.length} />
        </View>

        <Text style={styles.finishFieldLabel}>Workout name</Text>
        <TextInput
          style={styles.finishInput}
          value={finishName}
          onChangeText={setFinishName}
          placeholder="Workout name"
          placeholderTextColor={colors.textDim}
        />

        <Text style={styles.finishFieldLabel}>Notes</Text>
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
        <Button label="Cancel" variant="ghost" fullWidth onPress={() => setFinishOpen(false)} />
      </Screen>
    </Modal>

    <Modal
      visible={pickerOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closePicker}
    >
      <View style={[styles.pickerModal, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom }]}>
        <View style={styles.pickerHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pickerTitle}>Add Exercise</Text>
            {workout.exercises.length > 0 && (
              <Text style={[styles.pickerSubtitle, { color: colors.textMuted }]}>
                {workout.exercises.length} exercise{workout.exercises.length !== 1 ? "s" : ""} in
                workout
              </Text>
            )}
          </View>
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
          renderItem={({ item }) => {
            const isAlreadyAdded = exercisesInWorkout.has(item.id);
            const isAdding =
              addExercise.isPending && addExercise.variables?.exerciseId === item.id;

            return (
              <Pressable
                style={[
                  styles.pickerItem,
                  isAlreadyAdded && { opacity: 0.5, backgroundColor: colors.bgElevated },
                ]}
                onPress={() => {
                  if (isAlreadyAdded) {
                    showToast(`${item.name} is already in this workout`, "info");
                    return;
                  }
                  addExercise.mutate({
                    workoutId: workout.id,
                    exerciseId: item.id,
                    sets: [{ setNumber: 1, isCompleted: false }],
                  });
                }}
                disabled={isAdding}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerText}>{item.name}</Text>
                  {isAlreadyAdded && (
                    <Text style={[styles.pickerSubtitle, { color: colors.textMuted }]}>
                      Already added
                    </Text>
                  )}
                </View>
                {isAdding ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : isAlreadyAdded ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                ) : (
                  <Ionicons name="add-circle" size={22} color={colors.accent} />
                )}
              </Pressable>
            );
          }}
        />
        <Button
          label={workout.exercises.length > 0 ? "Done" : "Close"}
          variant="primary"
          fullWidth
          onPress={closePicker}
        />
      </View>
    </Modal>

    <Modal
      visible={settingsOpen}
      animationType="fade"
      transparent
      onRequestClose={() => setSettingsOpen(false)}
    >
      <Pressable style={styles.confirmBackdrop} onPress={() => setSettingsOpen(false)}>
        <Pressable style={styles.confirmCard} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.confirmTitle}>Workout settings</Text>
          <Pressable
            style={styles.confirmAction}
            onPress={() => {
              setSettingsOpen(false);
              router.push("/settings");
            }}
          >
            <Text style={styles.confirmActionText}>Workout Settings</Text>
          </Pressable>
          <Pressable
            style={styles.confirmAction}
            onPress={() => {
              setSettingsOpen(false);
              setReorderMode((current) => !current);
            }}
          >
            <Text style={styles.confirmActionText}>
              {reorderMode ? "Done reordering" : "Reorder exercises"}
            </Text>
          </Pressable>
          <Pressable style={styles.confirmAction} onPress={() => setSettingsOpen(false)}>
            <Text style={styles.confirmActionMutedText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal
      visible={restSettingsOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setRestSettingsOpen(false)}
    >
      <Screen scroll style={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom }}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>Rest Timer</Text>
          <Pressable onPress={() => setRestSettingsOpen(false)} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <Text style={styles.restTimerDisplay}>
          {defaultRestSeconds === 0 ? "OFF" : formatRestTime(defaultRestSeconds)}
        </Text>

        {REST_PRESETS.map((seconds) => (
          <Pressable
            key={seconds}
            onPress={() => {
              setDefault(seconds);
              savePrefs.mutate({ defaultRestSeconds: seconds });
              setRestSettingsOpen(false);
            }}
            style={[
              styles.restPresetRow,
              defaultRestSeconds === seconds && { backgroundColor: colors.accentMuted },
            ]}
          >
            <Text style={styles.restPresetLabel}>{formatRestTime(seconds)}</Text>
            {defaultRestSeconds === seconds ? (
              <Ionicons name="checkmark" size={20} color={colors.accent} />
            ) : null}
          </Pressable>
        ))}

        <Pressable
          onPress={() => {
            setDefault(0);
            savePrefs.mutate({ defaultRestSeconds: 0 });
            setRestSettingsOpen(false);
          }}
          style={[
            styles.restPresetRow,
            defaultRestSeconds === 0 && { backgroundColor: colors.accentMuted },
          ]}
        >
          <Text style={styles.restPresetLabel}>OFF (no rest timer)</Text>
          {defaultRestSeconds === 0 ? (
            <Ionicons name="checkmark" size={20} color={colors.accent} />
          ) : null}
        </Pressable>
      </Screen>
    </Modal>

    <ThemedDialog
      visible={discardConfirmOpen}
      title="Discard workout?"
      message={
        discardError
          ? `${discardError}\n\nThis cannot be undone.`
          : "This cannot be undone."
      }
      onDismiss={() => {
        setDiscardConfirmOpen(false);
        setDiscardError(null);
      }}
      buttons={[
        { label: "Cancel" },
        {
          label: cancel.isPending ? "Discarding…" : "Discard Workout",
          variant: "destructive",
          onPress: handleDiscardWorkout,
        },
      ]}
    />

    <ThemedDialog
      visible={deleteExerciseDialog.visible}
      title="Remove exercise?"
      message={
        deleteExerciseDialog.name
          ? `Remove "${deleteExerciseDialog.name}" from this workout?`
          : "Remove this exercise from the workout?"
      }
      onDismiss={() => setDeleteExerciseDialog({ visible: false })}
      buttons={[
        { label: "Cancel" },
        {
          label: deleteExercise.isPending ? "Removing…" : "Remove",
          variant: "destructive",
          onPress: () => {
            if (deleteExerciseDialog.workoutExerciseId) {
              deleteExercise.mutate({ workoutExerciseId: deleteExerciseDialog.workoutExerciseId });
            }
          },
        },
      ]}
    />

    <ThemedDialog
      visible={deleteSetDialog.visible}
      title="Delete set?"
      message="Remove this set from the workout?"
      onDismiss={() => setDeleteSetDialog({ visible: false, setId: null })}
      buttons={[
        { label: "Cancel" },
        {
          label: isSyncingSets ? "Deleting…" : "Delete",
          variant: "destructive",
          onPress: () => {
            if (deleteSetDialog.setId) {
              handleDeleteSet(deleteSetDialog.setId);
            }
          },
        },
      ]}
    />
    </>
  );
}

export default function ActiveWorkoutScreenWithErrorBoundary() {
  const utils = trpc.useUtils();

  return (
    <QueryErrorBoundary onRetry={() => void utils.workout.active.invalidate()}>
      <ActiveWorkoutScreen />
    </QueryErrorBoundary>
  );
}


function StatsItem({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.statsItem}>
      <Text style={styles.statsValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
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
  onRequestDeleteSet,
  onUpdateNotes,
  onRequestDeleteExercise,
  restTimerLabel,
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
  onRequestDeleteSet: (setId: string, hasData: boolean) => void;
  onUpdateNotes: (notes: string | null) => void;
  onRequestDeleteExercise: () => void;
  restTimerLabel: string;
  weightUnit: "KG" | "LBS";
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [draftNotes, setDraftNotes] = useState(notes ?? "");

  useEffect(() => {
    setDraftNotes(notes ?? "");
  }, [notes, workoutExerciseId]);

  return (
    <View style={styles.exerciseBlock}>
      {supersetGroup != null ? (
        <View style={styles.supersetBadge}>
          <Ionicons name="git-merge" size={12} color={colors.accent} />
          <Text style={styles.supersetBadgeText}>Superset {supersetGroup}</Text>
        </View>
      ) : null}
      <View style={styles.exerciseHeader}>
        <Pressable onLongPress={onRequestDeleteExercise} style={styles.exerciseHeaderMain}>
          <ExerciseAvatar name={name} imageUrl={imageUrl} size={40} />
          <Text style={styles.exerciseName} numberOfLines={1}>
            {name}
          </Text>
        </Pressable>
        <Pressable onPress={onRequestDeleteExercise} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="trash-outline" size={24} color={colors.danger} />
        </Pressable>
      </View>

      <TextInput
        style={styles.exerciseNotesInput}
        value={draftNotes}
        onChangeText={setDraftNotes}
        onBlur={() => onUpdateNotes(draftNotes.trim() || null)}
        placeholder="Add notes here..."
        placeholderTextColor={colors.textMuted}
      />

      <View style={styles.exerciseRestRow}>
        <Ionicons name="timer-outline" size={20} color={colors.accent} />
        <Text style={styles.exerciseRestText}>Rest Timer: {restTimerLabel}</Text>
      </View>

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
          <Ionicons name="barbell" size={13} color={colors.textDim} />
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
          onRequestDeleteSet={onRequestDeleteSet}
        />
      ))}
      <Pressable onPress={onAddSet} style={styles.addSetBtn}>
        <Ionicons name="add" size={24} color={colors.text} />
        <Text style={styles.addSet}>Add Set</Text>
      </Pressable>
    </View>
  );
}

function SetRow({
  set,
  weightUnit,
  previousValues,
  onUpdateSet,
  onRequestDeleteSet,
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
  onRequestDeleteSet: (setId: string, hasData: boolean) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const initialWeight =
    set.weight != null && set.weight > 0 ? String(fromKg(set.weight, weightUnit)) : "";
  const initialReps = set.reps != null && set.reps > 0 ? String(set.reps) : "";
  const [weight, setWeight] = useState(initialWeight);
  const [reps, setReps] = useState(initialReps);
  const weightRef = useRef(initialWeight);
  const repsRef = useRef(initialReps);
  const weightInputRef = useRef<TextInput>(null);
  const repsInputRef = useRef<TextInput>(null);
  const completingRef = useRef(false);
  const typeLabel = SET_TYPE_LABEL[set.setType] || String(set.setNumber);

  useEffect(() => {
    const nextWeight =
      set.weight != null && set.weight > 0 ? String(fromKg(set.weight, weightUnit)) : "";
    const nextReps = set.reps != null && set.reps > 0 ? String(set.reps) : "";
    weightRef.current = nextWeight;
    repsRef.current = nextReps;
    setWeight(nextWeight);
    setReps(nextReps);
  }, [set.weight, set.reps, weightUnit]);

  const flushDraft = (useGhost = false) => {
    const parsedWeight = parseOptionalNumber(weightRef.current);
    const parsedReps = parseOptionalNumber(repsRef.current);

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

  const dismissSetInputs = () => {
    Keyboard.dismiss();
    weightInputRef.current?.blur();
    repsInputRef.current?.blur();
  };

  const commit = () => {
    if (completingRef.current) return;
    onUpdateSet(set.id, flushDraft());
  };

  const handleCompletePressIn = () => {
    completingRef.current = true;
    dismissSetInputs();
  };

  const handleCompletePress = () => {
    onUpdateSet(set.id, { ...flushDraft(true), isCompleted: !set.isCompleted });
    completingRef.current = false;
  };

  const weightPlaceholder = "0";
  const repsPlaceholder = "0";

  const prevDisplay = (() => {
    const w = previousValues?.weight != null ? fromKg(previousValues.weight, weightUnit) : null;
    const r = previousValues?.reps != null ? previousValues.reps : null;
    if (w != null && r != null) return `${w}×${r}`;
    if (w != null) return `${w}`;
    if (r != null) return `×${r}`;
    return "-";
  })();

  const confirmDelete = () => {
    const hasData = set.weight != null || set.reps != null || set.rpe != null || set.isCompleted;
    onRequestDeleteSet(set.id, hasData);
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
          ref={weightInputRef}
          style={[styles.setInput, set.isCompleted && styles.setInputDone]}
          value={weight}
          onChangeText={(text) => {
            weightRef.current = text;
            setWeight(text);
          }}
          onBlur={commit}
          keyboardType="decimal-pad"
          placeholder={weightPlaceholder}
          placeholderTextColor={colors.textDim}
        />
        <TextInput
          ref={repsInputRef}
          style={[styles.setInput, set.isCompleted && styles.setInputDone]}
          value={reps}
          onChangeText={(text) => {
            repsRef.current = text;
            setReps(text);
          }}
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
          onPressIn={handleCompletePressIn}
          onPress={handleCompletePress}
        >
          {set.isCompleted ? (
            <Ionicons name="checkmark" size={20} color={colors.onAccent} />
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
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bgElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  headerSide: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    flex: 1,
    textAlign: "left",
    fontSize: 20,
    fontWeight: "500",
    color: colors.text,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.md,
  },
  headerIconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  statsItem: { flex: 1, minWidth: 0, alignItems: "flex-start", justifyContent: "center", gap: 4 },
  statsIconCell: { width: 44, alignItems: "center", justifyContent: "center" },
  statsValue: { width: "100%", fontSize: 20, fontWeight: "600", color: colors.text, lineHeight: 24 },
  statsLabel: { fontSize: 12, fontWeight: "500", color: colors.textMuted },
  statsDivider: { display: "none" },
  offlineMeta: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  syncBannerText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  syncErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: "rgba(239,68,68,0.1)",
  },
  syncErrorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
    fontWeight: "600",
  },
  syncRetryText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  contentPad: { paddingHorizontal: 0 },
  mainColumn: { flex: 1, minHeight: 0 },
  workoutTitle: { fontSize: 28, fontWeight: "700", color: colors.text },
  meta: { color: colors.textMuted, fontSize: 15, marginTop: 2 },
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
  restCenter: { flex: 1, alignItems: "center" },
  restCenterTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  restTime: { color: colors.text, fontWeight: "700", fontSize: 28 },
  restHint: { color: colors.textDim, fontSize: 12 },
  restAdjustBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 44,
    alignItems: "center",
  },
  restAdjustText: { fontSize: 14, fontWeight: "600", color: colors.accent },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { paddingBottom: spacing.xxl },
  exerciseBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    backgroundColor: colors.bg,
  },
  exerciseHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  exerciseHeaderMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.md },
  exerciseName: { flex: 1, minWidth: 0, color: colors.accent, fontSize: 18, lineHeight: 22, fontWeight: "600" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  supersetBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 4 },
  supersetBadgeText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  prevMeta: { color: colors.textDim, fontSize: 12, marginTop: spacing.sm },
  exerciseNotesInput: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
  },
  exerciseRestRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.md },
  exerciseRestText: { color: colors.accent, fontSize: 14, lineHeight: 18, fontWeight: "500" },
  setHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: 2,
    marginBottom: spacing.sm,
  },
  setCol: { flex: 1, minWidth: 0, color: colors.textDim, fontSize: 11, fontWeight: "600", textAlign: "center" },
  setColNarrow: { flex: 0, width: 36 },
  setColRpe: { flex: 0, width: 44 },
  setColPrev: { flex: 0, width: 72 },
  setColKgHeader: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  setColKgHeaderText: { color: colors.textDim, fontSize: 11, fontWeight: "600" },
  prevCol: { width: 72, alignItems: "center" as const, justifyContent: "center" as const },
  prevColText: { color: colors.textMuted, fontSize: 13, textAlign: "center" as const },
  setRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: 2,
    backgroundColor: colors.bg,
  },
  setRowDone: { backgroundColor: colors.successMuted },
  setNumber: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  setTypeBtn: { width: 36, alignItems: "center", justifyContent: "center" },
  rpeCell: {
    width: 44,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  rpeText: { color: colors.text, fontSize: 14, fontWeight: "500", textAlign: "center" },
  setInput: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.sm,
  },
  setInputDone: { color: colors.text },
  check: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceHover,
  },
  checkDone: { backgroundColor: colors.success },
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
  addSetBtn: {
    minHeight: 48,
    marginTop: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHover,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  addSet: { color: colors.text, fontSize: 16, fontWeight: "600" },
  pickerModal: {
    flex: 1,
    ...webFlexScreen,
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
  pickerSubtitle: { fontSize: 12, marginTop: 2 },
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
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  summaryItem: {
    flexGrow: 1,
    flexBasis: "45%",
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
  finishModal: { gap: spacing.md, paddingBottom: spacing.xxl },
  finishModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  finishModalTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  finishModalHeaderSpacer: { width: 24 },
  finishFieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  confirmBackdropBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  confirmCard: {
    width: "100%",
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmTitle: { fontSize: 18, fontWeight: "800", color: colors.text, textAlign: "center" },
  confirmSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  confirmError: { color: colors.danger, fontSize: 14, textAlign: "center" },
  confirmAction: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHover,
  },
  confirmActionDanger: { backgroundColor: "rgba(239,68,68,0.12)" },
  confirmActionText: { color: colors.text, fontSize: 16, fontWeight: "600" },
  confirmActionMutedText: { color: colors.textMuted, fontSize: 16, fontWeight: "600" },
  confirmActionDangerText: { color: colors.danger, fontSize: 16, fontWeight: "700" },
  restTimerDisplay: {
    textAlign: "center",
    fontSize: 48,
    fontWeight: "700",
    color: colors.accent,
    marginVertical: spacing.lg,
  },
  restPresetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceHover,
  },
  restPresetLabel: { fontSize: 18, fontWeight: "600", color: colors.text },
  workoutActions: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.md },
  secondaryActionsRow: { flexDirection: "row", gap: spacing.md },
  secondaryActionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHover,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: { display: "none" },
  footerSide: { display: "none" },
  footerSideEnd: { display: "none" },
  discardText: { color: colors.danger, fontSize: 15, fontWeight: "600" },
  settingsText: { color: colors.text, fontSize: 15, fontWeight: "600" },
});
