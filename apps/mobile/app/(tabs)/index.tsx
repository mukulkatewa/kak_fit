import { useRouter } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, HevyButton, Screen } from "../../src/components/ui";
import { QueryErrorState } from "../../src/components/query-error-state";
import { RoutineExpandableCard } from "../../src/components/routine-expandable-row";
import { LineChart } from "../../src/components/charts";
import { SkeletonCards } from "../../src/components/skeleton";
import { trpc, authMeQueryOptions, queryStaleTime } from "../../src/lib/trpc";
import { alertWorkoutConflict } from "../../src/lib/workout-errors";
import { navigateToActiveWorkout } from "../../src/lib/workout-navigation";
import { tonnageFromKg, weightLabel } from "../../src/lib/units";
import { useUserPreferences } from "../../src/lib/use-preferences";
import { radius, shadows, spacing, useTheme, useThemedStyles, type Palette } from "../../src/lib/theme";

export default function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const utils = trpc.useUtils();
  const { weightUnit } = useUserPreferences();
  const { data: me } = trpc.auth.me.useQuery(undefined, authMeQueryOptions);
  const { data: stats, isPending: statsPending } = trpc.auth.stats.useQuery(undefined, {
    staleTime: queryStaleTime.authStats,
  });
  const {
    data: active,
    isPending: activePending,
    isError: activeError,
    refetch: refetchActive,
  } = trpc.workout.active.useQuery(undefined, { staleTime: queryStaleTime.workoutActive });
  const {
    data: recent,
    isPending: recentPending,
    isError: recentError,
    refetch: refetchRecent,
  } = trpc.workout.history.useQuery(
    { limit: 8 },
    { staleTime: queryStaleTime.workoutHistory },
  );
  const { data: weeklyChart, isPending: weeklyPending } = trpc.progress.weeklyVolume.useQuery(undefined, {
    staleTime: queryStaleTime.weeklyVolume,
  });
  const {
    data: routines,
    isPending: routinesPending,
    isError: routinesError,
    refetch: refetchRoutines,
  } = trpc.routine.list.useQuery(undefined, {
    staleTime: queryStaleTime.routineList,
  });

  const statsLoading = statsPending && stats === undefined;
  const weeklyLoading = weeklyPending && weeklyChart === undefined;
  const recentLoading = recentPending && recent === undefined;
  const routinesLoading = routinesPending && routines === undefined;
  const activeLoading = activePending && active === undefined;

  const [startingRoutineId, setStartingRoutineId] = useState<string | null>(null);
  const [expandedRoutineIds, setExpandedRoutineIds] = useState<Set<string>>(() => new Set());

  const toggleRoutineExpanded = (id: string) => {
    setExpandedRoutineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
      setStartingRoutineId(null);
      navigateToActiveWorkout(utils, router, workout);
    },
    onError: (e, vars) => {
      setStartingRoutineId(null);
      alertWorkoutConflict(
        e,
        () => router.push("/workout/active"),
        async () => {
          setStartingRoutineId(vars.routineId);
          await discardActive.mutateAsync();
          await utils.workout.active.invalidate();
          startRoutine.mutate(vars);
        },
      );
    },
  });

  // Weekly progress — all workouts in the last 7 calendar days
  const finished = (recent ?? []).filter((w) => w.finishedAt);
  const chartData = weeklyChart ?? [];
  const totalVolumeKg = chartData.reduce((sum, d) => sum + d.value, 0);
  const totalVolume = tonnageFromKg(totalVolumeKg, weightUnit);
  const volumeUnit = weightLabel(weightUnit);

  return (
    <Screen scroll padded={false}>
      <View style={styles.pad}>
        {/* Profile stat header */}
        <View style={styles.statHeader}>
          <Pressable onPress={() => router.push("/(tabs)/profile")}>
            <Avatar name={me?.name} size={48} />
          </Pressable>
          <View style={styles.statsRow}>
            <Stat
              value={statsLoading ? "–" : (stats?.workoutCount ?? 0)}
              label="Workouts"
              onPress={() => router.push("/(tabs)/progress")}
            />
            <Stat
              value={statsLoading ? "–" : (stats?.routineCount ?? 0)}
              label="Routines"
              onPress={() => router.push("/(tabs)/routines")}
            />
            <Stat
              value={statsLoading ? "–" : (stats?.prCount ?? 0)}
              label="PRs"
              onPress={() => router.push({ pathname: "/(tabs)/progress", params: { tab: "prs" } })}
            />
          </View>
          <Pressable
            hitSlop={8}
            style={styles.gear}
            onPress={() => router.push("/settings")}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Weekly progress hero card */}
        <Pressable
          style={({ pressed }) => [styles.heroCard, pressed && styles.pressed]}
          onPress={() => router.push("/(tabs)/progress")}
        >
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Weekly Progress</Text>
              <View style={styles.heroBigRow}>
                <Text style={styles.heroBig}>
                  {weeklyLoading ? "–" : Math.round(totalVolume).toLocaleString()}
                </Text>
                {!weeklyLoading ? <Text style={styles.heroUnit}>{volumeUnit}</Text> : null}
              </View>
              <Text style={styles.heroSub}>
                {weeklyLoading
                  ? "Loading weekly volume…"
                  : totalVolume > 0
                    ? "lifted in the last 7 days"
                    : "No workouts yet this week"}
              </Text>
            </View>
            <View style={styles.heroBadge}>
              <Ionicons name="trending-up" size={22} color={colors.onAccent} />
            </View>
          </View>

          {weeklyLoading ? (
            <View style={styles.heroChartSkeleton}>
              {[0.35, 0.55, 0.4, 0.75, 0.5, 0.3, 0.65].map((h, i) => (
                <View key={i} style={[styles.heroBarSkeleton, { height: 120 * h }]} />
              ))}
            </View>
          ) : (
            <LineChart data={chartData} height={120} />
          )}

          <View style={styles.heroLabels}>
            {(weeklyLoading ? ["M", "T", "W", "T", "F", "S", "S"] : chartData.map((d) => d.label)).map(
              (label, i) => (
                <Text key={`${label}-${i}`} style={styles.heroDay}>
                  {label}
                </Text>
              ),
            )}
          </View>
        </Pressable>

        {/* Primary CTA / continue active workout */}
        {activeError ? (
          <QueryErrorState
            message="Couldn't check active workout. Check your connection."
            onRetry={() => void refetchActive()}
          />
        ) : active ? (
          <Pressable style={styles.activeCard} onPress={() => router.push("/workout/active")}>
            <View style={styles.activeIcon}>
              <Ionicons name="barbell" size={20} color={colors.onAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTitle}>{active.name ?? "Workout in progress"}</Text>
              <Text style={styles.activeSub}>{active.exercises.length} exercises · tap to continue</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </Pressable>
        ) : !activeLoading ? (
          <HevyButton
            label="Start Empty Workout"
            onPress={() => startEmpty.mutate({})}
            loading={startEmpty.isPending}
          />
        ) : null}

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {recentError ? (
          <QueryErrorState
            message="Couldn't load workouts. Check your connection."
            onRetry={() => void refetchRecent()}
          />
        ) : recentLoading ? (
          <SkeletonCards count={3} />
        ) : finished.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No completed workouts yet</Text>
            <Text style={styles.emptyHint}>
              Start a workout above, then tap Finish to see it here.
            </Text>
          </View>
        ) : (
          <View style={styles.cardStack}>
            {finished.slice(0, 3).map((w) => (
              <ActivityCard
                key={w.id}
                icon="fitness"
                title={w.name ?? "Workout"}
                subtitle={`${w.exerciseCount} exercises · ${Math.round(tonnageFromKg(w.volume, weightUnit)).toLocaleString()} ${weightLabel(weightUnit)}`}
                onPress={() => router.push(`/workout/${w.id}`)}
              />
            ))}
          </View>
        )}

        {/* My Routines */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>My Routines</Text>
          {!routinesLoading && (routines?.length ?? 0) > 0 ? (
            <Pressable hitSlop={8} onPress={() => router.push("/workout/my-routines")}>
              <Text style={styles.viewAll}>View all</Text>
            </Pressable>
          ) : null}
        </View>

        {routinesError ? (
          <QueryErrorState
            message="Couldn't load routines. Check your connection."
            onRetry={() => void refetchRoutines()}
          />
        ) : routinesLoading ? (
          <SkeletonCards count={2} />
        ) : (routines ?? []).length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No routines yet</Text>
            <HevyButton
              label="Create Routine"
              variant="secondary"
              onPress={() => router.push("/routine/create")}
            />
          </View>
        ) : (
          <View style={styles.cardStack}>
            {routines?.slice(0, 4).map((item) => (
              <RoutineExpandableCard
                key={item.id}
                routine={item}
                expanded={expandedRoutineIds.has(item.id)}
                onToggleExpand={() => toggleRoutineExpanded(item.id)}
                disabled={startingRoutineId === item.id}
                loading={startingRoutineId === item.id}
                onStart={() => {
                  setStartingRoutineId(item.id);
                  startRoutine.mutate({ routineId: item.id });
                }}
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

function Stat({
  value,
  label,
  onPress,
}: {
  value: string | number;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.statCol, pressed && styles.pressed]}
      hitSlop={4}
    >
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

function ActivityCard({
  icon,
  title,
  subtitle,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.activityCard,
        pressed && !disabled && styles.pressed,
        disabled && { opacity: 0.5 },
      ]}
      onPress={onPress}
    >
      <View style={styles.activityIcon}>
        <Ionicons name={icon} size={20} color={colors.onAccent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.activityTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.activitySub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  pad: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },

  statHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  statsRow: { flex: 1, flexDirection: "row", justifyContent: "space-around" },
  statCol: { alignItems: "center", gap: 1 },
  statValueRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  statValue: { fontSize: 18, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  gear: { padding: 2 },

  heroCard: {
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.glow,
  },
  heroTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  heroTitle: { fontSize: 15, fontWeight: "700", color: colors.onAccentMuted, letterSpacing: 0.3 },
  heroBigRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 4 },
  heroBig: { fontSize: 40, fontWeight: "800", color: colors.onAccent, lineHeight: 44 },
  heroUnit: { fontSize: 16, fontWeight: "700", color: colors.onAccentMuted, marginBottom: 6 },
  heroSub: { fontSize: 13, fontWeight: "500", color: colors.onAccentMuted, marginTop: 2 },
  heroBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: -spacing.sm },
  heroDay: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: colors.onAccentFaint },
  heroChartSkeleton: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 120,
    gap: 6,
  },
  heroBarSkeleton: {
    flex: 1,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    opacity: 0.5,
  },

  activeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.card,
  },
  activeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  activeSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  sectionTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  viewAll: { fontSize: 15, fontWeight: "700", color: colors.accent },

  cardStack: { gap: spacing.md },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.card,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  activityTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  activitySub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  pressed: { opacity: 0.7 },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: "center",
    gap: spacing.md,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  emptyHint: { color: colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
