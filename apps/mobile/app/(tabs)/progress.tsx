import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
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
import { trpc, queryStaleTime } from "../../src/lib/trpc";
import { formatWeight, tonnageFromKg, weightLabel } from "../../src/lib/units";
import { useUserPreferences } from "../../src/lib/use-preferences";
import { spacing, useTheme, useThemedStyles, type Palette } from "../../src/lib/theme";

export default function ProgressScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { weightUnit } = useUserPreferences();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: volume,
    isLoading: volLoading,
    isError: volError,
    refetch: refetchVolume,
  } = trpc.progress.volumeHistory.useQuery(
    { limit: 10 },
    { staleTime: queryStaleTime.progress },
  );
  const {
    data: muscleData,
    isLoading: muscleLoading,
    isError: muscleError,
    refetch: refetchMuscle,
  } = trpc.progress.muscleDistribution.useQuery(
    { days: 30 },
    { staleTime: queryStaleTime.progress },
  );
  const {
    data: topExercises,
    isError: topExError,
    refetch: refetchTopExercises,
  } = trpc.progress.topExercises.useQuery(
    { limit: 6 },
    { staleTime: queryStaleTime.progress },
  );
  const {
    data: prs,
    isError: prsError,
    refetch: refetchPrs,
  } = trpc.personalRecord.list.useQuery(
    { limit: 8 },
    { staleTime: queryStaleTime.progress },
  );
  const {
    data: dashboard,
    isError: dashError,
    refetch: refetchDashboard,
  } = trpc.progress.dashboard.useQuery(undefined, { staleTime: queryStaleTime.progress });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchVolume(),
        refetchMuscle(),
        refetchTopExercises(),
        refetchPrs(),
        refetchDashboard(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchVolume, refetchMuscle, refetchTopExercises, refetchPrs, refetchDashboard]);

  const weekVolumeDisplay = dashboard
    ? tonnageFromKg(dashboard.weekVolume, weightUnit) / 1000
    : 0;

  return (
    <Screen
      scroll
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void handleRefresh()}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      <Header title="Progress" subtitle="Charts, PRs, and muscle volume" />

      {dashboard ? (
        <View style={styles.statsRow}>
          <StatBlock value={dashboard.streakWeeks} label="Week streak" />
          <StatBlock value={`${weekVolumeDisplay.toFixed(1)}k`} label={`Week vol (${weightLabel(weightUnit)})`} />
          <StatBlock value={dashboard.monthPrs} label="PRs (month)" />
        </View>
      ) : dashError ? (
        <Text style={styles.empty}>Couldn't load stats. Pull to refresh.</Text>
      ) : null}

      <SectionHeader title="Volume" />
      {volLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : volError ? (
        <Text style={styles.empty}>Couldn't load volume chart.</Text>
      ) : (
        <BarChart
          data={(volume ?? []).map((v) => ({ label: v.label, value: v.volume }))}
          color={colors.accent}
          unit="kg"
        />
      )}

      <SectionHeader title="Muscle Heatmap" />
      <Text style={styles.sectionSub}>
        Last 30 days
        {muscleData?.totalVolume
          ? ` · ${Math.round(tonnageFromKg(muscleData.totalVolume, weightUnit)).toLocaleString()} ${weightLabel(weightUnit)} total`
          : ""}
      </Text>
      {muscleLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : muscleError ? (
        <Text style={styles.empty}>Couldn't load muscle data.</Text>
      ) : (
        <MuscleHeatmap data={muscleData?.heatmap ?? []} />
      )}

      <SectionHeader title="Top Exercises" />
      {topExError ? (
        <View style={styles.retryBlock}>
          <Text style={styles.empty}>Couldn't load top exercises.</Text>
          <Pressable onPress={() => void refetchTopExercises()} hitSlop={8}>
            <Text style={styles.retry}>Tap to retry</Text>
          </Pressable>
        </View>
      ) : (topExercises ?? []).length === 0 ? (
        <Text style={styles.empty}>No exercises logged yet</Text>
      ) : (
        <ListGroup>
          {topExercises?.map((ex, i) => (
            <ListRow
              key={ex.id}
              title={ex.name}
              subtitle={`${ex.count} sessions`}
              onPress={() => router.push(`/exercise/${ex.id}`)}
              last={i === (topExercises?.length ?? 0) - 1}
            />
          ))}
        </ListGroup>
      )}

      <SectionHeader title="Recent PRs" />
      <View style={styles.prList}>
        {prsError ? (
          <View style={styles.retryBlock}>
            <Text style={styles.empty}>Couldn't load personal records.</Text>
            <Pressable onPress={() => void refetchPrs()} hitSlop={8}>
              <Text style={styles.retry}>Tap to retry</Text>
            </Pressable>
          </View>
        ) : (prs ?? []).length === 0 ? (
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
                {pr.type === "MAX_REPS"
                  ? `${pr.value} reps`
                  : `${formatWeight(pr.value, weightUnit)} ${weightLabel(weightUnit)}`}
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
  retryBlock: { alignItems: "center", gap: spacing.xs },
  retry: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  measureLink: { alignItems: "center", paddingVertical: spacing.lg },
  measureLinkText: { color: colors.accent, fontSize: 16, fontWeight: "600" },
  sectionSub: { fontSize: 13, color: colors.textMuted, marginTop: -8, marginBottom: spacing.sm },
});
