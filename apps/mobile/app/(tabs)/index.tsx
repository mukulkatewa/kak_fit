import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, HevyButton, Screen } from "../../src/components/ui";
import { LineChart } from "../../src/components/charts";
import { FeedSkeleton } from "../../src/components/skeleton";
import { trpc } from "../../src/lib/trpc";
import { alertWorkoutConflict } from "../../src/lib/workout-errors";
import { navigateToActiveWorkout } from "../../src/lib/workout-navigation";
import { radius, shadows, spacing, useTheme, useThemedStyles, type Palette } from "../../src/lib/theme";

export default function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const utils = trpc.useUtils();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: stats } = trpc.auth.stats.useQuery();
  const { data: active, isPending: activePending } = trpc.workout.active.useQuery();
  const { data: recent, isPending: recentPending } = trpc.workout.history.useQuery({ limit: 8 });
  const { data: weeklyChart } = trpc.progress.weeklyVolume.useQuery();
  const { data: routines, isPending: routinesPending } = trpc.routine.list.useQuery();

  const initialLoading =
    (activePending && active === undefined) || (recentPending && recent === undefined);

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
      navigateToActiveWorkout(utils, router, workout);
    },
    onError: (e, vars) =>
      alertWorkoutConflict(
        e,
        () => router.push("/workout/active"),
        async () => {
          await discardActive.mutateAsync();
          await utils.workout.active.invalidate();
          startRoutine.mutate(vars);
        },
      ),
  });

  // Weekly progress — all workouts in the last 7 calendar days
  const finished = (recent ?? []).filter((w) => w.finishedAt);
  const chartData = weeklyChart ?? [];
  const totalVolume = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <Screen scroll padded={false}>
      <View style={styles.pad}>
        {/* Profile stat header */}
        <View style={styles.statHeader}>
          <Pressable onPress={() => router.push("/(tabs)/profile")}>
            <Avatar name={me?.name} size={48} />
          </Pressable>
          <View style={styles.statsRow}>
            <Stat value={stats?.workoutCount ?? 0} label="Workouts" />
            <Stat value={stats?.routineCount ?? 0} label="Routines" />
            <Stat value={stats?.prCount ?? 0} label="PRs" />
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
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Weekly Progress</Text>
              <View style={styles.heroBigRow}>
                <Text style={styles.heroBig}>{Math.round(totalVolume).toLocaleString()}</Text>
                <Text style={styles.heroUnit}>kg</Text>
              </View>
              <Text style={styles.heroSub}>
                {totalVolume > 0 ? "lifted in the last 7 days" : "No workouts yet this week"}
              </Text>
            </View>
            <View style={styles.heroBadge}>
              <Ionicons name="trending-up" size={22} color={colors.onAccent} />
            </View>
          </View>

          <LineChart data={chartData} height={120} />

          <View style={styles.heroLabels}>
            {chartData.map((d, i) => (
              <Text key={`${d.label}-${i}`} style={styles.heroDay}>
                {d.label}
              </Text>
            ))}
          </View>
        </View>

        {/* Primary CTA / continue active workout */}
        {active ? (
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
        ) : (
          <HevyButton
            label="Start Empty Workout"
            onPress={() => startEmpty.mutate({})}
            loading={startEmpty.isPending}
          />
        )}

        {initialLoading ? (
          <FeedSkeleton rows={3} />
        ) : (
          <>
            {/* Recent Activity */}
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {finished.length === 0 ? (
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
                    subtitle={`${w.exerciseCount} exercises · ${Math.round(w.volume)} kg`}
                    onPress={() => router.push(`/workout/${w.id}`)}
                  />
                ))}
              </View>
            )}

            {/* My Routines */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>My Routines</Text>
              {(routines?.length ?? 0) > 0 ? (
                <Pressable hitSlop={8} onPress={() => router.push("/workout/my-routines")}>
                  <Text style={styles.viewAll}>View all</Text>
                </Pressable>
              ) : null}
            </View>

            {routinesPending && routines === undefined ? (
              <FeedSkeleton rows={2} />
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
                  <ActivityCard
                    key={item.id}
                    icon="barbell"
                    title={item.name}
                    subtitle={`${item.exercises.length} exercises · tap to start`}
                    onPress={() => startRoutine.mutate({ routineId: item.id })}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.statCol}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActivityCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={({ pressed }) => [styles.activityCard, pressed && styles.pressed]}
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

  activeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.bg,
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
    backgroundColor: colors.bg,
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
