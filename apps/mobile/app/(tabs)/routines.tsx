import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "../../src/components/ui";
import {
  HevyCategoryTile,
  HevyFilterBar,
  HevyIconButton,
  HevyOutlineButton,
  HevyProgramCard,
  HevyTrainerCard,
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
import { trpc } from "../../src/lib/trpc";
import { spacing, useTheme, useThemedStyles, type Palette } from "../../src/lib/theme";

type FilterKey = "level" | "goal" | "equipment" | null;

const PREVIEW_COUNT = 4;

export default function WorkoutExploreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const [openFilter, setOpenFilter] = useState<FilterKey>(null);
  const [level, setLevel] = useState<ProgramLevel | null>(null);
  const [goal, setGoal] = useState<ProgramGoal | null>(null);
  const [equipment, setEquipment] = useState<ProgramEquipment | null>(null);

  const { data: routines } = trpc.routine.list.useQuery();

  const discardActive = trpc.workout.discardActive.useMutation();

  const startEmpty = trpc.workout.startEmpty.useMutation({
    onSuccess: () => {
      utils.workout.active.invalidate();
      router.push("/workout/active");
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
        <View style={styles.topRow}>
          <Pressable style={styles.myRoutinesBtn} onPress={() => router.push("/workout/my-routines")}>
            <Ionicons name="folder-outline" size={18} color={colors.accent} />
            <Text style={styles.myRoutinesText}>
              My Routines{(routines?.length ?? 0) > 0 ? ` (${routines!.length})` : ""}
            </Text>
          </Pressable>
          <View style={styles.topActions}>
            <HevyIconButton icon="add-circle-outline" onPress={() => router.push("/routine/create")} />
            <HevyIconButton
              icon="play-circle-outline"
              onPress={() => startEmpty.mutate({})}
            />
          </View>
        </View>

        <Text style={styles.pageTitle}>Workout Library</Text>

        <HevyTrainerCard
          onPress={() =>
            Alert.alert("Trainer", "AI personalised programs are coming in a future update.")
          }
        />

        <Text style={styles.sectionTitle}>Programs</Text>
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

        <Text style={styles.sectionTitle}>Routines</Text>
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
    </Screen>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  pad: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topActions: { flexDirection: "row", gap: spacing.sm },
  myRoutinesBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  myRoutinesText: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  pageTitle: { fontSize: 34, fontWeight: "800", color: colors.text, marginTop: -spacing.sm },
  sectionTitle: { fontSize: 22, fontWeight: "700", color: colors.text },
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
