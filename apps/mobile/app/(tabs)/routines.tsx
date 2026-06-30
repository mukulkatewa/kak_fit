import { useRouter } from "expo-router";
import { useMemo, useState, useCallback, type ReactNode } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FireIcon } from "react-native-heroicons/solid";
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  EyeIcon,
  PlusCircleIcon,
  TrashIcon,
} from "react-native-heroicons/outline";
import Animated, {
  FadeInUp,
  SlideInDown,
} from "react-native-reanimated";
import { EmptyState, ListGroup, ListRow, Screen, ThemedDialog, useToast } from "../../src/components/ui";
import { QueryErrorState } from "../../src/components/query-error-state";
import { RoutineExpandableRow } from "../../src/components/routine-expandable-row";
import {
  HevyOutlineButton,
  HevyProgramCard,
} from "../../src/components/hevy-ui";
import {
  EXPLORE_PROGRAMS,
  FILTER_EQUIPMENT,
  FILTER_GOALS,
  FILTER_LEVELS,
  ROUTINE_CATEGORIES,
  type ProgramEquipment,
  type ProgramGoal,
  type ProgramLevel,
} from "../../src/lib/explore-data";
import { entranceDown, useSpringPress } from "../../src/lib/animations";
import { alertWorkoutConflict } from "../../src/lib/workout-errors";
import { navigateToActiveWorkout } from "../../src/lib/workout-navigation";
import { trpc, queryStaleTime } from "../../src/lib/trpc";
import {
  flattenFinishedWorkouts,
  useWorkoutHistoryInfinite,
} from "../../src/lib/workout-history-query";
import { tonnageFromKg, weightLabel } from "../../src/lib/units";
import { useUserPreferences } from "../../src/lib/use-preferences";
import { radius, spacing, useTheme, useThemedStyles, type Palette } from "../../src/lib/theme";

type FilterKey = "level" | "goal" | "equipment" | null;
type FilterChip = {
  key: string;
  label: string;
  showFilterIcon?: boolean;
  active?: boolean;
  onPress: () => void;
};

const PREVIEW_COUNT = 3;
const ROUTINE_PREVIEW = 6;

function AnimatedFilterChip({ chip }: { chip: FilterChip }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { scale, onPressIn, onPressOut } = useSpringPress();

  return (
    <Animated.View style={scale}>
      <Pressable
        onPress={chip.onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.filterChip, chip.active && styles.filterChipActive]}
      >
        {chip.showFilterIcon ? (
          <AdjustmentsHorizontalIcon
            color={chip.active ? "#fff" : colors.text}
            size={14}
          />
        ) : null}
        <Text style={[styles.filterChipText, chip.active && styles.filterChipTextActive]}>
          {chip.label}
        </Text>
        {chip.key !== "filters" ? (
          <ChevronDownIcon
            color={chip.active ? "#fff" : colors.textMuted}
            size={12}
          />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function AnimatedFilterBar({ chips }: { chips: FilterChip[] }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.filterRow}>
      {chips.map((chip) => (
        <AnimatedFilterChip key={chip.key} chip={chip} />
      ))}
    </View>
  );
}

function StartEmptyWorkoutButton({
  onPress,
  loading,
}: {
  onPress: () => void;
  loading: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const { scale, onPressIn, onPressOut } = useSpringPress();

  return (
    <Animated.View style={scale}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={loading}
        style={[styles.startEmptyButton, loading && styles.startEmptyDisabled]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <PlusCircleIcon color="#fff" size={22} />
            <Text style={styles.startEmptyLabel}>Start Empty Workout</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

function AnimatedRecentWorkoutRow({
  index,
  title,
  subtitle,
  last,
  onPress,
  onLongPress,
  disabled = false,
}: {
  index: number;
  title: string;
  subtitle: string;
  last: boolean;
  onPress: () => void;
  onLongPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const { scale, onPressIn, onPressOut } = useSpringPress();

  return (
    <Animated.View
      entering={entranceDown(index * 60)}
      style={[scale, disabled && { opacity: 0.5 }]}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled}
      >
        <ListRow
          title={title}
          subtitle={subtitle}
          icon="time-outline"
          last={last}
          right={
            disabled ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : undefined
          }
        />
      </Pressable>
    </Animated.View>
  );
}

function SpringOutlineButton({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { scale, onPressIn, onPressOut } = useSpringPress();

  return (
    <Animated.View style={scale}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.outlineBtn}
      >
        <Text style={styles.outlineBtnText}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function AnimatedCategoryTile({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { scale, onPressIn, onPressOut } = useSpringPress();

  return (
    <Animated.View style={[scale, styles.categoryTileWrap]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.categoryTile}
      >
        <Text style={styles.categoryLabel}>{label}</Text>
        <Text style={styles.categoryIcon}>{icon}</Text>
      </Pressable>
    </Animated.View>
  );
}

function MenuActionRow({
  index,
  icon,
  label,
  danger,
  onPress,
}: {
  index: number;
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);

  return (
    <Animated.View entering={entranceDown(index * 60)}>
      <Pressable style={styles.menuAction} onPress={onPress}>
        {icon}
        <Text style={[styles.menuActionText, danger && styles.menuActionDanger]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function WorkoutTabScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const { weightUnit } = useUserPreferences();
  const [openFilter, setOpenFilter] = useState<FilterKey>(null);
  const [level, setLevel] = useState<ProgramLevel | null>(null);
  const [goal, setGoal] = useState<ProgramGoal | null>(null);
  const [equipment, setEquipment] = useState<ProgramEquipment | null>(null);
  const [pendingRoutineId, setPendingRoutineId] = useState<string | null>(null);
  const [pendingWorkoutId, setPendingWorkoutId] = useState<string | null>(null);
  const [expandedRoutineIds, setExpandedRoutineIds] = useState<Set<string>>(() => new Set());
  const [workoutMenu, setWorkoutMenu] = useState<{
    visible: boolean;
    workoutId?: string;
    workoutName?: string;
  }>({ visible: false });
  const [deleteWorkoutDialog, setDeleteWorkoutDialog] = useState<{
    visible: boolean;
    workoutId?: string;
    workoutName?: string;
  }>({ visible: false });
  const [startConfirm, setStartConfirm] = useState<{ id: string; name: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { showToast } = useToast();

  const toggleRoutineExpanded = (id: string) => {
    setExpandedRoutineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const {
    data: routines,
    isError: isRoutinesError,
    refetch: refetchRoutines,
  } = trpc.routine.list.useQuery(undefined, {
    staleTime: queryStaleTime.routineList,
  });
  const {
    data: historyPages,
    isError: isRecentError,
    refetch: refetchRecent,
  } = useWorkoutHistoryInfinite(8);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        utils.routine.list.invalidate(),
        utils.workout.history.invalidate(),
        refetchRoutines(),
        refetchRecent(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [utils, refetchRoutines, refetchRecent]);

  const discardActive = trpc.workout.discardActive.useMutation();

  const startEmpty = trpc.workout.startEmpty.useMutation({
    onSuccess: (workout) => {
      navigateToActiveWorkout(utils, router, workout);
    },
    onError: (e) =>
      alertWorkoutConflict(
        e,
        () => router.push("/workout/active"),
        async () => {
          await discardActive.mutateAsync();
          await utils.workout.active.invalidate();
          startEmpty.mutate({});
        },
      ),
  });

  const startRoutine = trpc.workout.startFromRoutine.useMutation({
    onSuccess: (workout) => {
      setPendingRoutineId(null);
      navigateToActiveWorkout(utils, router, workout);
    },
    onError: (e, vars) => {
      setPendingRoutineId(null);
      alertWorkoutConflict(
        e,
        () => router.push("/workout/active"),
        async () => {
          setPendingRoutineId(vars.routineId);
          await discardActive.mutateAsync();
          await utils.workout.active.invalidate();
          startRoutine.mutate(vars);
        },
      );
    },
  });

  const repeatWorkout = trpc.workout.startFromWorkout.useMutation({
    onSuccess: (workout) => {
      setPendingWorkoutId(null);
      navigateToActiveWorkout(utils, router, workout);
    },
    onError: (e, vars) => {
      setPendingWorkoutId(null);
      alertWorkoutConflict(
        e,
        () => router.push("/workout/active"),
        async () => {
          setPendingWorkoutId(vars.workoutId);
          await discardActive.mutateAsync();
          await utils.workout.active.invalidate();
          repeatWorkout.mutate(vars);
        },
      );
    },
  });

  const deleteWorkout = trpc.workout.delete.useMutation({
    onSuccess: () => {
      setDeleteWorkoutDialog({ visible: false });
      setWorkoutMenu({ visible: false });
      void Promise.all([
        utils.workout.history.invalidate(),
        utils.auth.stats.invalidate(),
        utils.progress.weeklyVolume.invalidate(),
        utils.progress.dashboard.invalidate(),
        utils.progress.volumeHistory.invalidate(),
        utils.progress.muscleDistribution.invalidate(),
        utils.personalRecord.list.invalidate(),
      ]);
      showToast("Workout deleted", "success");
    },
    onError: (e) => showToast(e.message, "error"),
  });

  const filteredPrograms = useMemo(() => {
    return EXPLORE_PROGRAMS.filter((p) => {
      if (level && p.level !== level) return false;
      if (goal && p.goal !== goal) return false;
      if (equipment && p.equipment !== equipment) return false;
      return true;
    });
  }, [level, goal, equipment]);

  const previewPrograms = filteredPrograms.slice(0, PREVIEW_COUNT);
  const hasFilters = level !== null || goal !== null || equipment !== null;
  const finishedRecent = flattenFinishedWorkouts(historyPages?.pages).slice(0, 3);

  const clearFilters = () => {
    setLevel(null);
    setGoal(null);
    setEquipment(null);
    setOpenFilter(null);
  };

  const toggleFilter = (key: FilterKey) => {
    setOpenFilter((prev) => (prev === key ? null : key));
  };

  const filterChips: FilterChip[] = [
    {
      key: "filters",
      label: hasFilters ? "Clear" : "Filters",
      showFilterIcon: true,
      active: hasFilters,
      onPress: hasFilters ? clearFilters : () => setOpenFilter("level"),
    },
    {
      key: "level",
      label: level ?? "Level",
      active: openFilter === "level" || level !== null,
      onPress: () => toggleFilter("level"),
    },
    {
      key: "goal",
      label: goal ?? "Goal",
      active: openFilter === "goal" || goal !== null,
      onPress: () => toggleFilter("goal"),
    },
    {
      key: "equipment",
      label: equipment ?? "Equipment",
      active: openFilter === "equipment" || equipment !== null,
      onPress: () => toggleFilter("equipment"),
    },
  ];

  const renderFilterOptions = () => {
    if (!openFilter) return null;

    const options =
      openFilter === "level"
        ? FILTER_LEVELS
        : openFilter === "goal"
          ? FILTER_GOALS
          : FILTER_EQUIPMENT;

    const current = openFilter === "level" ? level : openFilter === "goal" ? goal : equipment;

    return (
      <View style={styles.filterOptions}>
        {options.map((opt) => {
          const selected = current === opt;
          return (
            <Pressable
              key={opt}
              style={[styles.filterOption, selected && styles.filterOptionActive]}
              onPress={() => {
                if (openFilter === "level") setLevel(selected ? null : (opt as ProgramLevel));
                if (openFilter === "goal") setGoal(selected ? null : (opt as ProgramGoal));
                if (openFilter === "equipment") setEquipment(selected ? null : (opt as ProgramEquipment));
                setOpenFilter(null);
              }}
            >
              <Text style={[styles.filterOptionText, selected && styles.filterOptionTextActive]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <Screen
      scroll
      padded={false}
      variant="tab"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      <View style={styles.pad}>
        <Animated.View entering={entranceDown()} style={styles.pageTitleRow}>
          <Text style={styles.pageTitle}>Workout</Text>
          <FireIcon color={colors.accent} size={28} />
        </Animated.View>

        <StartEmptyWorkoutButton
          onPress={() => startEmpty.mutate({})}
          loading={startEmpty.isPending}
        />

        {isRecentError ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Workouts</Text>
            <QueryErrorState
              message="Couldn't load workouts. Check your connection."
              onRetry={() => void refetchRecent()}
            />
          </View>
        ) : finishedRecent.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Workouts</Text>
              <Pressable hitSlop={8} onPress={() => router.push("/workout/history")}>
                <Text style={styles.manageLink}>View all</Text>
              </Pressable>
            </View>
            <ListGroup>
              {finishedRecent.map((workout, index) => (
                <AnimatedRecentWorkoutRow
                  key={workout.id}
                  index={index}
                  title={workout.name ?? "Workout"}
                  subtitle={`${workout.exerciseCount} exercises · ${Math.round(tonnageFromKg(workout.volume, weightUnit)).toLocaleString()} ${weightLabel(weightUnit)}`}
                  last={index === finishedRecent.length - 1}
                  onPress={() => router.push(`/workout/${workout.id}`)}
                  onLongPress={() =>
                    setWorkoutMenu({
                      visible: true,
                      workoutId: workout.id,
                      workoutName: workout.name ?? "Workout",
                    })
                  }
                  disabled={pendingWorkoutId === workout.id}
                />
              ))}
            </ListGroup>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>My Routines</Text>
            <Pressable hitSlop={8} onPress={() => router.push("/workout/my-routines")}>
              <Text style={styles.manageLink}>Manage</Text>
            </Pressable>
          </View>

          {isRoutinesError ? (
            <QueryErrorState
              message="Couldn't load routines. Check your connection."
              onRetry={() => void refetchRoutines()}
            />
          ) : (routines ?? []).length === 0 ? (
            <EmptyState
              icon="barbell-outline"
              title="No routines yet"
              message="Create a template or save a workout as a routine."
            />
          ) : (
            <ListGroup>
              {routines!.slice(0, ROUTINE_PREVIEW).map((routine, index, arr) => (
                <Animated.View
                  key={routine.id}
                  entering={entranceDown(index * 70)}
                >
                  <RoutineExpandableRow
                    routine={routine}
                    expanded={expandedRoutineIds.has(routine.id)}
                    onToggleExpand={() => toggleRoutineExpanded(routine.id)}
                    last={index === arr.length - 1}
                    disabled={pendingRoutineId === routine.id}
                    onStart={() => setStartConfirm({ id: routine.id, name: routine.name })}
                  />
                </Animated.View>
              ))}
            </ListGroup>
          )}

          {(routines?.length ?? 0) > ROUTINE_PREVIEW ? (
            <HevyOutlineButton
              label={`View all ${routines!.length} routines`}
              onPress={() => router.push("/workout/my-routines")}
            />
          ) : (
            <SpringOutlineButton label="Create routine" onPress={() => router.push("/routine/create")} />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Explore Programs</Text>
          <AnimatedFilterBar chips={filterChips} />
          {renderFilterOptions()}

          <View style={styles.programList}>
            {previewPrograms.map((program, index) => (
              <Animated.View
                key={program.id}
                entering={FadeInUp.delay(index * 80).springify().damping(16)}
              >
                <HevyProgramCard
                  badge={program.badge}
                  badgeColor={program.badgeColor}
                  title={program.title}
                  routineCount={program.routines.length}
                  onPress={() => router.push(`/workout/program/${program.id}`)}
                />
              </Animated.View>
            ))}
          </View>

          {filteredPrograms.length > PREVIEW_COUNT ? (
            <HevyOutlineButton
              label={`Show all ${filteredPrograms.length} programs`}
              onPress={() => router.push("/workout/programs")}
            />
          ) : null}

          <View style={styles.categoryGrid}>
            {ROUTINE_CATEGORIES.map((cat) => (
              <AnimatedCategoryTile
                key={cat.id}
                label={cat.label}
                icon={cat.icon}
                onPress={() => router.push(`/workout/category/${cat.id}`)}
              />
            ))}
          </View>
        </View>
      </View>

      <Modal
        visible={workoutMenu.visible}
        animationType="fade"
        transparent
        onRequestClose={() => setWorkoutMenu({ visible: false })}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setWorkoutMenu({ visible: false })}>
          <Animated.View
            entering={SlideInDown.springify().damping(18)}
            style={[styles.menuCard, { paddingBottom: insets.bottom + spacing.md }]}
          >
            <Text style={styles.menuTitle} numberOfLines={1}>
              {workoutMenu.workoutName ?? "Workout"}
            </Text>
            <MenuActionRow
              index={0}
              icon={<EyeIcon color={colors.text} size={20} />}
              label="View Workout"
              onPress={() => {
                if (workoutMenu.workoutId) {
                  setWorkoutMenu({ visible: false });
                  router.push(`/workout/${workoutMenu.workoutId}`);
                }
              }}
            />
            <MenuActionRow
              index={1}
              icon={<ArrowPathIcon color={colors.text} size={20} />}
              label="Repeat Workout"
              onPress={() => {
                if (!workoutMenu.workoutId) return;
                setWorkoutMenu({ visible: false });
                setPendingWorkoutId(workoutMenu.workoutId);
                repeatWorkout.mutate({ workoutId: workoutMenu.workoutId });
              }}
            />
            <MenuActionRow
              index={2}
              icon={<TrashIcon color={colors.danger} size={20} />}
              label="Delete Workout"
              danger
              onPress={() => {
                setWorkoutMenu({ visible: false });
                setDeleteWorkoutDialog({
                  visible: true,
                  workoutId: workoutMenu.workoutId,
                  workoutName: workoutMenu.workoutName,
                });
              }}
            />
            <Animated.View entering={entranceDown(180)}>
              <Pressable style={styles.menuCancel} onPress={() => setWorkoutMenu({ visible: false })}>
                <Text style={styles.menuCancelText}>Cancel</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </Pressable>
      </Modal>

      <ThemedDialog
        visible={startConfirm !== null}
        title="Start workout?"
        message={
          startConfirm ? `Begin "${startConfirm.name}" now?` : undefined
        }
        onDismiss={() => setStartConfirm(null)}
        buttons={[
          { label: "Cancel" },
          {
            label: "Start",
            variant: "primary",
            onPress: () => {
              if (!startConfirm) return;
              setPendingRoutineId(startConfirm.id);
              startRoutine.mutate({ routineId: startConfirm.id });
              setStartConfirm(null);
            },
          },
        ]}
      />

      <ThemedDialog
        visible={deleteWorkoutDialog.visible}
        title="Delete workout?"
        message={
          deleteWorkoutDialog.workoutName
            ? `Remove "${deleteWorkoutDialog.workoutName}" from your history? This cannot be undone.`
            : "Remove this workout from your history? This cannot be undone."
        }
        onDismiss={() => setDeleteWorkoutDialog({ visible: false })}
        buttons={[
          { label: "Cancel" },
          {
            label: deleteWorkout.isPending ? "Deleting…" : "Delete",
            variant: "destructive",
            onPress: () => {
              if (deleteWorkoutDialog.workoutId) {
                deleteWorkout.mutate({ id: deleteWorkoutDialog.workoutId });
              }
            },
          },
        ]}
      />
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    pad: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingTop: spacing.sm },
    pageTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    pageTitle: { fontSize: 34, fontWeight: "800", color: colors.text },
    startEmptyButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: colors.accent,
      borderRadius: radius.lg,
      minHeight: 52,
      paddingHorizontal: spacing.xl,
    },
    startEmptyDisabled: { opacity: 0.6 },
    startEmptyLabel: { fontSize: 16, fontWeight: "700", color: "#fff" },
    section: { gap: spacing.md },
    sectionTitle: { fontSize: 22, fontWeight: "700", color: colors.text },
    sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    manageLink: { fontSize: 15, fontWeight: "700", color: colors.accent },
    filterRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.surface,
      borderRadius: radius.full,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    filterChipActive: { backgroundColor: colors.accent },
    filterChipText: { color: colors.text, fontSize: 14, fontWeight: "500" },
    filterChipTextActive: { color: "#fff" },
    filterOptions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    filterOption: {
      backgroundColor: colors.surface,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    filterOptionActive: { backgroundColor: colors.accent },
    filterOptionText: { color: colors.text, fontSize: 14, fontWeight: "500" },
    filterOptionTextActive: { color: "#fff" },
    programList: { gap: spacing.md },
    categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "space-between" },
    categoryTileWrap: {
      flexBasis: "48%",
      flexGrow: 1,
      maxWidth: "48%",
    },
    categoryTile: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 64,
    },
    categoryLabel: { fontSize: 16, fontWeight: "500", color: colors.text, flex: 1 },
    categoryIcon: { fontSize: 28 },
    outlineBtn: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingVertical: 16,
      alignItems: "center",
    },
    outlineBtnText: { fontSize: 16, fontWeight: "600", color: colors.text },
    menuBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    menuCard: {
      backgroundColor: colors.bgElevated,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      paddingTop: spacing.lg,
      paddingHorizontal: spacing.lg,
      gap: spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    menuTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: spacing.sm,
    },
    menuAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    menuActionText: { fontSize: 16, fontWeight: "600", color: colors.text },
    menuActionDanger: { color: colors.danger },
    menuCancel: {
      alignItems: "center",
      paddingVertical: spacing.md,
      marginTop: spacing.xs,
    },
    menuCancelText: { fontSize: 16, fontWeight: "600", color: colors.textMuted },
  });
