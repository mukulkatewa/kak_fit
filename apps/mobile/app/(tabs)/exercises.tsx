import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  EmptyState,
  Header,
  ListGroup,
  ListRow,
  Screen,
  SearchBar,
} from "../../src/components/ui";
import { ListSkeleton } from "../../src/components/skeleton";
import { trpc } from "../../src/lib/trpc";
import { spacing, typography, useTheme, useThemedStyles, type Palette } from "../../src/lib/theme";

export default function ExercisesTab() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [search, setSearch] = useState("");
  const [muscleId, setMuscleId] = useState<string | null>(null);
  const [customOnly, setCustomOnly] = useState(false);

  const utils = trpc.useUtils();

  useEffect(() => {
    void utils.exercise.muscles.prefetch();
  }, [utils]);

  const { data: muscles, isPending: musclesPending } = trpc.exercise.muscles.useQuery();
  const {
    data: exercises,
    isPending,
    isError,
    error,
    refetch,
  } = trpc.exercise.list.useQuery({
    search: search || undefined,
    muscleId: muscleId || undefined,
    customOnly: customOnly || undefined,
    limit: 50,
  });
  const { data: count } = trpc.exerciseCount.useQuery();

  const loading = (isPending && exercises === undefined) || (musclesPending && muscles === undefined);

  return (
    <Screen scroll variant="tab">
      <Header
        title="Exercises"
        subtitle={`${count?.count ?? 0} exercises`}
        action={
          <Pressable
            style={styles.addBtn}
            hitSlop={8}
            onPress={() => router.push("/exercise/create")}
          >
            <Ionicons name="add" size={22} color={colors.onAccent} />
          </Pressable>
        }
      />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search exercises" />

      {!loading ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <FilterChip label="All" active={!muscleId && !customOnly} onPress={() => { setMuscleId(null); setCustomOnly(false); }} />
          <FilterChip label="Custom" active={customOnly} onPress={() => { setCustomOnly((v) => !v); setMuscleId(null); }} />
          {(muscles ?? []).map((m) => (
            <FilterChip
              key={m.id}
              label={m.name}
              active={muscleId === m.id}
              onPress={() => { setMuscleId((cur) => (cur === m.id ? null : m.id)); setCustomOnly(false); }}
            />
          ))}
        </ScrollView>
      ) : null}

      {loading ? (
        <ListSkeleton rows={8} />
      ) : isError ? (
        <View style={{ marginTop: spacing.xxl, gap: spacing.md, alignItems: "center" }}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Could not load exercises"
            message={error.message}
          />
          <Button label="Retry" variant="secondary" onPress={() => refetch()} />
        </View>
      ) : (exercises ?? []).length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No exercises found"
          message={customOnly ? "Create your first custom exercise with +." : "Try a different search or filter."}
        />
      ) : (
        <ListGroup>
          {exercises?.map((item, index) => {
            const primary = item.muscles.find((m) => m.isPrimary)?.muscle.name;
            return (
              <ListRow
                key={item.id}
                title={item.name}
                subtitle={[primary, item.category?.name, item.isCustom ? "Custom" : null]
                  .filter(Boolean)
                  .join(" · ")}
                onPress={() => router.push(`/exercise/${item.id}`)}
                last={index === (exercises?.length ?? 0) - 1}
              />
            );
          })}
        </ListGroup>
      )}
    </Screen>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    addBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    filterRow: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.lg },
    chip: {
      backgroundColor: colors.surface,
      borderRadius: radiusFull,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { ...typography.caption, color: colors.textMuted },
    chipTextActive: { color: colors.onAccent, fontWeight: "700" },
  });

const radiusFull = 999;
