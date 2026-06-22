import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "../../src/components/ui";
import { HevyFilterBar, HevyProgramCard, HevyStackHeader } from "../../src/components/hevy-ui";
import {
  EXPLORE_PROGRAMS,
  FILTER_EQUIPMENT,
  FILTER_GOALS,
  FILTER_LEVELS,
  type ProgramEquipment,
  type ProgramGoal,
  type ProgramLevel,
} from "../../src/lib/explore-data";
import { useTheme, useThemedStyles, spacing, type Palette } from "../../src/lib/theme";

type FilterKey = "level" | "goal" | "equipment" | null;

export default function AllProgramsScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [openFilter, setOpenFilter] = useState<FilterKey>(null);
  const [level, setLevel] = useState<ProgramLevel | null>(null);
  const [goal, setGoal] = useState<ProgramGoal | null>(null);
  const [equipment, setEquipment] = useState<ProgramEquipment | null>(null);

  const filteredPrograms = useMemo(() => {
    return EXPLORE_PROGRAMS.filter((p) => {
      if (level && p.level !== level) return false;
      if (goal && p.goal !== goal) return false;
      if (equipment && p.equipment !== equipment) return false;
      return true;
    });
  }, [level, goal, equipment]);

  const hasFilters = level !== null || goal !== null || equipment !== null;

  const clearFilters = () => {
    setLevel(null);
    setGoal(null);
    setEquipment(null);
    setOpenFilter(null);
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
      onPress: () => setOpenFilter((p) => (p === "level" ? null : "level")),
    },
    {
      key: "goal",
      label: goal ?? "Goal",
      active: openFilter === "goal" || goal !== null,
      onPress: () => setOpenFilter((p) => (p === "goal" ? null : "goal")),
    },
    {
      key: "equipment",
      label: equipment ?? "Equipment",
      active: openFilter === "equipment" || equipment !== null,
      onPress: () => setOpenFilter((p) => (p === "equipment" ? null : "equipment")),
    },
  ];

  const renderFilterOptions = () => {
    if (!openFilter) return null;
    const options =
      openFilter === "level" ? FILTER_LEVELS : openFilter === "goal" ? FILTER_GOALS : FILTER_EQUIPMENT;
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
        <HevyStackHeader title="Programs" onBack={() => router.back()} />
        <HevyFilterBar chips={filterChips} />
        {renderFilterOptions()}
        <View style={styles.list}>
          {filteredPrograms.map((program) => (
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
        {filteredPrograms.length === 0 ? (
          <Text style={styles.empty}>No programs match these filters.</Text>
        ) : null}
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  pad: { paddingHorizontal: spacing.lg, gap: spacing.lg },
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
  list: { gap: spacing.md },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: spacing.xl },
});
