import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import {
  BrandMark,
  Button,
  Card,
  FitnessScoreRing,
  PRBadge,
  Screen,
  SectionHeader,
  StatPill,
  StreakBadge,
  Subtitle,
  Title,
  XPBar,
} from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors, spacing } from "../../src/lib/theme";
import { signOut } from "../../src/lib/auth";

export default function DashboardScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: user } = trpc.auth.me.useQuery();
  const { data: stats } = trpc.auth.stats.useQuery();
  const { data: active, isLoading } = trpc.workout.active.useQuery();
  const { data: recentPrs } = trpc.personalRecord.list.useQuery({ limit: 3 });

  const startEmpty = trpc.workout.startEmpty.useMutation({
    onSuccess: () => {
      utils.workout.active.invalidate();
      router.push("/workout/active");
    },
    onError: (e) => Alert.alert("Error", e.message),
  });

  const fitnessScore = Math.min(
    100,
    (stats?.workoutCount ?? 0) * 8 + (stats?.prCount ?? 0) * 5,
  );

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <View style={styles.greeting}>
          <BrandMark />
          <Title>Hey, {user?.name?.split(" ")[0] ?? "Athlete"}</Title>
          <Subtitle>Ready to crush it today?</Subtitle>
        </View>
        <FitnessScoreRing score={fitnessScore} />
      </View>

      <StreakBadge weeks={Math.max(1, Math.floor((stats?.workoutCount ?? 0) / 3))} />
      <XPBar current={(stats?.workoutCount ?? 0) * 120} max={1000} level={Math.floor((stats?.workoutCount ?? 0) / 5) + 1} />

      {stats ? (
        <View style={styles.statsRow}>
          <StatPill value={stats.workoutCount} label="Workouts" accent />
          <StatPill value={stats.prCount} label="PRs" gold />
          <StatPill value={stats.routineCount} label="Routines" />
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : active ? (
        <Card glow>
          <Text style={styles.activeLabel}>ACTIVE SESSION</Text>
          <Text style={styles.activeTitle}>{active.name ?? "Workout"}</Text>
          <Text style={styles.activeMeta}>
            {active.exercises.length} exercises · started{" "}
            {new Date(active.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
          <Button
            label="Continue Workout"
            icon="play"
            onPress={() => router.push("/workout/active")}
          />
        </Card>
      ) : (
        <Card>
          <Text style={styles.activeTitle}>Start Training</Text>
          <Subtitle>Log sets in under 2 seconds. Hit new PRs.</Subtitle>
          <Button
            label="Start Empty Workout"
            icon="add"
            onPress={() => startEmpty.mutate({})}
            loading={startEmpty.isPending}
          />
          <Button
            label="Browse Routines"
            variant="ghost"
            icon="barbell"
            onPress={() => router.push("/(tabs)/routines")}
          />
        </Card>
      )}

      {(recentPrs ?? []).length > 0 ? (
        <>
          <SectionHeader title="Recent PRs" action="See all" onAction={() => router.push("/(tabs)/profile")} />
          <View style={styles.prList}>
            {recentPrs?.map((pr) => (
              <View key={pr.id} style={styles.prRow}>
                <PRBadge label={pr.type.replace(/_/g, " ")} />
                <Text style={styles.prExercise}>{pr.exercise.name}</Text>
                <Text style={styles.prValue}>
                  {pr.type === "MAX_REPS" ? `${pr.value} reps` : `${pr.value.toFixed(1)} kg`}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greeting: { flex: 1, gap: spacing.xs },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  activeLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.accentNeon,
    letterSpacing: 2,
  },
  activeTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  activeMeta: { fontSize: 13, color: colors.textMuted },
  prList: { gap: spacing.sm },
  prRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  prExercise: { flex: 1, color: colors.text, fontWeight: "600", fontSize: 14 },
  prValue: { color: colors.gold, fontWeight: "700", fontSize: 14 },
});
