import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { BarChart } from "../../src/components/charts";
import { Button, Header, ListGroup, ListRow, Screen, SectionHeader } from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors, spacing } from "../../src/lib/theme";

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: exercise, isLoading } = trpc.exercise.getById.useQuery({ id: id! }, { enabled: !!id });
  const { data: chart } = trpc.progress.exerciseChart.useQuery(
    { exerciseId: id!, limit: 10 },
    { enabled: !!id },
  );
  const { data: prs } = trpc.personalRecord.byExercise.useQuery({ exerciseId: id! }, { enabled: !!id });
  const { data: previous } = trpc.exercise.previousPerformance.useQuery({ exerciseId: id! }, { enabled: !!id });

  if (isLoading || !exercise) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} size="large" />
      </Screen>
    );
  }

  const primary = exercise.muscles.find((m) => m.isPrimary)?.muscle.name;
  const secondary = exercise.muscles.filter((m) => !m.isPrimary).map((m) => m.muscle.name);

  return (
    <Screen scroll>
      <Header
        title={exercise.name}
        subtitle={[primary, exercise.category?.name].filter(Boolean).join(" · ")}
        action={<Button label="Back" variant="ghost" size="sm" onPress={() => router.back()} />}
      />

      {previous ? (
        <View style={styles.prevBox}>
          <Text style={styles.prevLabel}>Last performance</Text>
          <Text style={styles.prevVal}>
            {previous.weight ?? "—"} kg × {previous.reps ?? "—"} reps
          </Text>
          <Text style={styles.prevMeta}>
            {previous.workoutName} · {previous.finishedAt ? new Date(previous.finishedAt).toLocaleDateString() : ""}
          </Text>
        </View>
      ) : null}

      <SectionHeader title="Max Weight" />
      <BarChart
        data={(chart ?? []).map((p) => ({ label: p.label, value: p.maxWeight }))}
        color={colors.accent}
        unit=" kg"
      />

      <SectionHeader title="Personal Records" />
      {(prs ?? []).length === 0 ? (
        <Text style={styles.empty}>No PRs yet for this exercise.</Text>
      ) : (
        <ListGroup>
          {prs?.map((pr, i) => (
            <ListRow
              key={pr.id}
              title={pr.type.replace(/_/g, " ")}
              subtitle={new Date(pr.achievedAt).toLocaleDateString()}
              right={
                <Text style={styles.prVal}>
                  {pr.type === "MAX_REPS" ? `${pr.value} reps` : `${pr.value.toFixed(1)} kg`}
                </Text>
              }
              last={i === (prs?.length ?? 0) - 1}
            />
          ))}
        </ListGroup>
      )}

      {secondary.length > 0 ? (
        <>
          <SectionHeader title="Secondary Muscles" />
          <Text style={styles.muscles}>{secondary.join(", ")}</Text>
        </>
      ) : null}

      {exercise.instructions ? (
        <>
          <SectionHeader title="Instructions" />
          <Text style={styles.instructions}>{exercise.instructions}</Text>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  prevBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    gap: 4,
  },
  prevLabel: { fontSize: 13, color: colors.textMuted },
  prevVal: { fontSize: 20, fontWeight: "700", color: colors.text },
  prevMeta: { fontSize: 13, color: colors.textDim },
  empty: { color: colors.textMuted, fontSize: 14, textAlign: "center", paddingVertical: spacing.lg },
  muscles: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  instructions: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  prVal: { color: colors.gold, fontWeight: "700", fontSize: 15 },
});
