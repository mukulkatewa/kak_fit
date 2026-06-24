import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, HevyButton, ListGroup, ListRow, Screen } from "../../src/components/ui";
import {
  HevyCategoryTile,
  HevyFilterBar,
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
import { alertWorkoutConflict } from "../../src/lib/workout-errors";
import { navigateToActiveWorkout } from "../../src/lib/workout-navigation";
import { trpc, queryStaleTime } from "../../src/lib/trpc";
import { tonnageFromKg, weightLabel } from "../../src/lib/units";
import { useUserPreferences } from "../../src/lib/use-preferences";
import { spacing, useTheme, useThemedStyles, type Palette } from "../../src/lib/theme";

type FilterKey = "level" | "goal" | "equipment" | null;

const PREVIEW_COUNT = 3;
const ROUTINE_PREVIEW = 6;

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

  const { data: routines } = trpc.routine.list.useQuery(undefined, {
    staleTime: queryStaleTime.routineList,
  });
  const { data: recent } = trpc.workout.history.useQuery(
    { limit: 8 },
    { staleTime: queryStaleTime.workoutHistory },
  );

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
  const finishedRecent = (recent ?? []).filter((workout) => workout.finishedAt).slice(0, 3);

  const clearFilters = () => {
    setLevel(null);
    setGoal(null);
    setEquipment(null);
    setOpenFilter(null);
  };

  const toggleFilter = (key: FilterKey) => {
    setOpenFilter((prev) => (prev === key ? null : key));
  };

  const filterChips = [
    {
      key: "filters",
      label: hasFilters ? "Clear" : "Filters",
      icon: "options-outline" as const,
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
    <Screen scroll padded={false}>
      <View style={[styles.pad, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Text style={styles.pageTitle}>Workout</Text>

        <HevyButton
          label="Start Empty Workout"
          onPress={() => startEmpty.mutate({})}
          loading={startEmpty.isPending}
        />

        {finishedRecent.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Repeat Recent</Text>
            <ListGroup>
              {finishedRecent.map((workout, index) => (
                <ListRow
                  key={workout.id}
                  title={workout.name ?? "Workout"}
                  subtitle={`${workout.exerciseCount} exercises · ${Math.round(tonnageFromKg(workout.volume, weightUnit)).toLocaleString()} ${weightLabel(weightUnit)}`}
                  icon="time-outline"
                  last={index === finishedRecent.length - 1}
                  onPress={
                    pendingWorkoutId === workout.id
                      ? undefined
                      : () => {
                          setPendingWorkoutId(workout.id);
                          repeatWorkout.mutate({ workoutId: workout.id });
                        }
                  }
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

          {(routines ?? []).length === 0 ? (
            <EmptyState
              icon="barbell-outline"
              title="No routines yet"
              message="Create a template or save a workout as a routine."
            />
          ) : (
            <ListGroup>
              {routines!.slice(0, ROUTINE_PREVIEW).map((routine, index, arr) => (
                <ListRow
                  key={routine.id}
                  title={routine.name}
                  subtitle={`${routine.exercises.length} exercises`}
                  icon="barbell-outline"
                  last={index === arr.length - 1}
                  onPress={
                    pendingRoutineId === routine.id
                      ? undefined
                      : () => {
                          setPendingRoutineId(routine.id);
                          startRoutine.mutate({ routineId: routine.id });
                        }
                  }
                />
              ))}
            </ListGroup>
          )}

          {(routines?.length ?? 0) > ROUTINE_PREVIEW ? (
            <HevyOutlineButton
              label={`View all ${routines!.length} routines`}
              onPress={() => router.push("/workout/my-routines")}
            />
          ) : (
            <HevyOutlineButton label="Create routine" onPress={() => router.push("/routine/create")} />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Explore Programs</Text>
          <HevyFilterBar chips={filterChips} />
          {renderFilterOptions()}

          <View style={styles.programList}>
            {previewPrograms.map((program) => (
              <HevyProgramCard
                key={program.id}
                badge={program.badge}
                badgeColor={program.badgeColor}
                title={program.title}
                routineCount={program.routines.length}
                onPress={() => router.push(`/workout/program/${program.id}`)}
              />
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
              <HevyCategoryTile
                key={cat.id}
                label={cat.label}
                icon={cat.icon}
                onPress={() => router.push(`/workout/category/${cat.id}`)}
              />
            ))}
          </View>
        </View>
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    pad: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingTop: spacing.sm },
    pageTitle: { fontSize: 34, fontWeight: "800", color: colors.text },
    section: { gap: spacing.md },
    sectionTitle: { fontSize: 22, fontWeight: "700", color: colors.text },
    sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    manageLink: { fontSize: 15, fontWeight: "700", color: colors.accent },
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
  });
