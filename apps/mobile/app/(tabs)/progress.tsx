import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { BarChart } from "../../src/components/charts";
import { MuscleHeatmap } from "../../src/components/muscle-heatmap";
import {
  Header,
  ListGroup,
  ListRow,
  PRBadge,
  Screen,
  SectionHeader,
  StatBlock,
} from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { spacing, useTheme, useThemedStyles, type Palette } from "../../src/lib/theme";

export default function ProgressScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { data: volume, isLoading: volLoading } = trpc.progress.volumeHistory.useQuery({ limit: 10 });
  const { data: muscleData, isLoading: muscleLoading } = trpc.progress.muscleDistribution.useQuery({ days: 30 });
  const { data: topExercises } = trpc.progress.topExercises.useQuery({ limit: 6 });
  const { data: prs } = trpc.personalRecord.list.useQuery({ limit: 8 });
  const { data: dashboard } = trpc.progress.dashboard.useQuery();

  return (
    <Screen scroll>
      <Header title="Progress" subtitle="Charts, PRs, and muscle volume" />

      {dashboard ? (
        <View style={styles.statsRow}>
          <StatBlock value={dashboard.streakWeeks} label="Week streak" />
          <StatBlock value={`${(dashboard.weekVolume / 1000).toFixed(1)}k`} label="Week vol (kg)" />
          <StatBlock value={dashboard.monthPrs} label="PRs (month)" />
        </View>
      ) : null}

      <SectionHeader title="Volume" />
      {volLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <BarChart
          data={(volume ?? []).map((v) => ({ label: v.label, value: v.volume }))}
          color={colors.accent}
          unit=""
        />
      )}

      <SectionHeader title="Muscle Heatmap" />
      <Text style={styles.sectionSub}>
        Last 30 days{muscleData?.totalVolume ? ` · ${muscleData.totalVolume.toLocaleString()} kg total` : ""}
      </Text>
      {muscleLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <MuscleHeatmap data={muscleData?.heatmap ?? []} />
      )}

      <SectionHeader title="Top Exercises" />
      <ListGroup>
        {(topExercises ?? []).map((ex, i) => (
          <ListRow
            key={ex.id}
            title={ex.name}
            subtitle={`${ex.count} sessions`}
            onPress={() => router.push(`/exercise/${ex.id}`)}
            last={i === (topExercises?.length ?? 0) - 1}
          />
        ))}
      </ListGroup>

      <SectionHeader title="Recent PRs" />
      <View style={styles.prList}>
        {(prs ?? []).length === 0 ? (
          <Text style={styles.empty}>Hit new PRs by completing workouts.</Text>
        ) : (
          prs?.map((pr) => (
            <Pressable
              key={pr.id}
              style={styles.prRow}
              onPress={() => router.push(`/exercise/${pr.exercise.id}`)}
            >
              <PRBadge label={pr.type.replace(/_/g, " ")} />
              <Text style={styles.prName} numberOfLines={1}>
                {pr.exercise.name}
              </Text>
              <Text style={styles.prVal}>
                {pr.type === "MAX_REPS" ? `${pr.value} reps` : `${pr.value.toFixed(1)} kg`}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      <Pressable style={styles.measureLink} onPress={() => router.push("/measurements")}>
        <Text style={styles.measureLinkText}>Body Measurements →</Text>
      </Pressable>
    </Screen>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  prList: { gap: spacing.sm },
  prRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
  },
  prName: { flex: 1, color: colors.text, fontSize: 15 },
  prVal: { color: colors.gold, fontWeight: "700", fontSize: 15 },
  empty: { color: colors.textMuted, fontSize: 14, textAlign: "center", paddingVertical: spacing.lg },
  measureLink: { alignItems: "center", paddingVertical: spacing.lg },
  measureLinkText: { color: colors.accent, fontSize: 16, fontWeight: "600" },
  sectionSub: { fontSize: 13, color: colors.textMuted, marginTop: -8, marginBottom: spacing.sm },
});
