import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Avatar, HevyButton, Screen } from "../../src/components/ui";
import { LineChart } from "../../src/components/charts";
import { FeedSkeleton } from "../../src/components/skeleton";
import { trpc } from "../../src/lib/trpc";
import { alertWorkoutConflict } from "../../src/lib/workout-errors";
import { colors, radius, shadows, spacing } from "../../src/lib/theme";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DashboardScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: me } = trpc.auth.me.useQuery();
  const { data: stats } = trpc.auth.stats.useQuery();
  const { data: active, isPending: activePending } = trpc.workout.active.useQuery();
  const { data: recent, isPending: recentPending } = trpc.workout.history.useQuery({ limit: 8 });
  const { data: routines, isPending: routinesPending } = trpc.routine.list.useQuery();

  const initialLoading =
    (activePending && active === undefined) || (recentPending && recent === undefined);

  const startEmpty = trpc.workout.startEmpty.useMutation({
    onSuccess: () => {
      utils.workout.active.invalidate();
      router.push("/workout/active");
    },
    onError: (e) => alertWorkoutConflict(e, () => router.push("/workout/active")),
  });

  const startRoutine = trpc.workout.startFromRoutine.useMutation({
    onSuccess: () => {
      utils.workout.active.invalidate();
      router.push("/workout/active");
    },
    onError: (e) => alertWorkoutConflict(e, () => router.push("/workout/active")),
  });

  // Weekly progress chart — last completed workouts (oldest → newest)
  const finished = (recent ?? []).filter((w) => w.finishedAt);
  const chartSource = [...finished].reverse().slice(-7);
  const chartData =
    chartSource.length > 0
      ? chartSource.map((w) => ({
          label: w.finishedAt ? WEEKDAYS[new Date(w.finishedAt).getDay()] : "",
          value: Math.round(w.volume),
        }))
      : [0, 0, 0, 0, 0, 0, 0].map((v, i) => ({ label: WEEKDAYS[i], value: v }));
  const totalVolume = chartSource.reduce((sum, w) => sum + w.volume, 0);

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
            <Stat value={0} label="Followers" />
            <Stat value={0} label="Following" />
          </View>
          <Pressable
            hitSlop={8}
            style={styles.gear}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Weekly progress green hero card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Weekly Progress</Text>
          <LineChart data={chartData} height={150} />
          <View style={styles.heroFooter}>
            <View style={styles.heroFooterLeft}>
              <Text style={styles.heroFooterText}>Last 7 Days</Text>
              <Ionicons name="chevron-down" size={15} color={colors.onAccentMuted} />
            </View>
            <Text style={styles.heroFooterText}>
              {totalVolume > 0 ? `${Math.round(totalVolume).toLocaleString()} kg lifted` : "No data yet"}
            </Text>
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
                    onPress={() => router.push("/(tabs)/progress")}
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

const styles = StyleSheet.create({
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
    gap: spacing.md,
    ...shadows.glow,
  },
  heroTitle: { fontSize: 19, fontWeight: "800", color: colors.onAccent },
  heroFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroFooterLeft: { flexDirection: "row", alignItems: "center", gap: 4 },
  heroFooterText: { fontSize: 14, fontWeight: "600", color: colors.onAccentMuted },

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
