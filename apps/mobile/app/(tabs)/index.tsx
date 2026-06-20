import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
import { colors, radius, spacing } from "../../src/lib/theme";

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

  const workoutCount = stats?.workoutCount ?? 0;
  const prCount = stats?.prCount ?? 0;
  const fitnessScore = Math.min(100, workoutCount * 8 + prCount * 5);
  const level = Math.floor(workoutCount / 5) + 1;

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

      <View style={styles.badgeRow}>
        <StreakBadge weeks={Math.max(1, Math.floor(workoutCount / 3))} />
      </View>

      <Card>
        <XPBar current={(workoutCount % 5) * 200} max={1000} level={level} />
      </Card>

      {stats ? (
        <View style={styles.statsRow}>
          <StatPill value={workoutCount} label="WORKOUTS" accent />
          <StatPill value={prCount} label="PRS" gold />
          <StatPill value={stats.routineCount} label="ROUTINES" />
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : active ? (
        <Card glow>
          <View style={styles.activeTop}>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.activeLabel}>ACTIVE SESSION</Text>
            </View>
            <Ionicons name="barbell" size={20} color={colors.accentBright} />
          </View>
          <Text style={styles.activeTitle}>{active.name ?? "Workout"}</Text>
          <Text style={styles.activeMeta}>
            {active.exercises.length} exercises · started{" "}
            {new Date(active.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
          <Button
            label="Continue Workout"
            icon="play"
            fullWidth
            onPress={() => router.push("/workout/active")}
          />
        </Card>
      ) : (
        <Card>
          <View style={styles.ctaIconWrap}>
            <Ionicons name="flash" size={22} color={colors.accentNeon} />
          </View>
          <Text style={styles.activeTitle}>Start Training</Text>
          <Subtitle>Log sets in under 2 seconds. Hit new PRs.</Subtitle>
          <Button
            label="Start Empty Workout"
            icon="add"
            fullWidth
            onPress={() => startEmpty.mutate({})}
            loading={startEmpty.isPending}
          />
          <Button
            label="Browse Routines"
            variant="ghost"
            icon="barbell-outline"
            fullWidth
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
                <Text style={styles.prExercise} numberOfLines={1}>
                  {pr.exercise.name}
                </Text>
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
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greeting: { flex: 1, gap: spacing.xs },
  badgeRow: { flexDirection: "row" },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  activeTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accentNeon },
  activeLabel: { fontSize: 10, fontWeight: "800", color: colors.accentNeon, letterSpacing: 1.5 },
  ctaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTitle: { fontSize: 21, fontWeight: "800", color: colors.text, letterSpacing: -0.4 },
  activeMeta: { fontSize: 13, color: colors.textMuted },
  prList: { gap: spacing.sm },
  prRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  prExercise: { flex: 1, color: colors.text, fontWeight: "600", fontSize: 14 },
  prValue: { color: colors.gold, fontWeight: "800", fontSize: 14 },
});
