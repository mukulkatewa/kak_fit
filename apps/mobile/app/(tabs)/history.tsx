import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { EmptyState, ListItem, Screen, Title } from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors, spacing } from "../../src/lib/theme";

export default function HistoryTab() {
  const { data: workouts, isLoading } = trpc.workout.history.useQuery({ limit: 30 });
  const { data: prs } = trpc.personalRecord.list.useQuery({ limit: 10 });

  return (
    <Screen>
      <Title>History & PRs</Title>

      <Text style={styles.section}>Recent workouts</Text>
      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <FlatList
          data={workouts ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState title="No workouts yet" message="Finish a session to see it here." />
          }
          renderItem={({ item }) => (
            <ListItem
              title={item.name ?? "Workout"}
              subtitle={`${item.exerciseCount} exercises • ${Math.round(item.volume)} kg volume • ${item.finishedAt ? new Date(item.finishedAt).toLocaleDateString() : ""}`}
            />
          )}
        />
      )}

      <Text style={styles.section}>Personal records</Text>
      <View style={styles.prList}>
        {(prs ?? []).length === 0 ? (
          <EmptyState title="No PRs yet" message="Hit new bests and they'll show up here." />
        ) : (
          prs?.map((pr) => (
            <View key={pr.id} style={styles.prItem}>
              <Text style={styles.prExercise}>{pr.exercise.name}</Text>
              <Text style={styles.prValue}>
                {pr.type.replace(/_/g, " ")}: {formatPr(pr.type, pr.value)}
              </Text>
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}

function formatPr(type: string, value: number) {
  if (type === "MAX_DURATION") return `${value}s`;
  if (type === "MAX_REPS") return `${value} reps`;
  return `${value.toFixed(1)} kg`;
}

const styles = StyleSheet.create({
  section: { color: colors.textMuted, fontSize: 13, fontWeight: "600", marginTop: spacing.sm },
  list: { gap: spacing.sm },
  prList: { gap: spacing.sm, marginTop: spacing.sm },
  prItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
    padding: spacing.md,
    gap: 4,
  },
  prExercise: { color: colors.text, fontSize: 15, fontWeight: "600" },
  prValue: { color: colors.primary, fontSize: 13, fontWeight: "600" },
});
