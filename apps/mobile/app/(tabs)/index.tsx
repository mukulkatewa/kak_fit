import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BoltIcon } from "react-native-heroicons/solid";
import { ClockIcon } from "react-native-heroicons/outline";
import { PlusCircleIcon } from "react-native-heroicons/outline";
import Animated, {
  FadeInLeft,
  SlideInRight,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LineChart } from "../../src/components/charts";
import { QueryErrorBoundary } from "../../src/components/query-error-boundary";
import { QueryErrorState } from "../../src/components/query-error-state";
import { RoutineExpandableCard } from "../../src/components/routine-expandable-row";
import { SkeletonCards } from "../../src/components/skeleton";
import {
  Avatar,
  HevyButton,
  Screen,
  ThemedDialog,
  useToast,
} from "../../src/components/ui";
import { entranceDown, usePulse, useSpringPress } from "../../src/lib/animations";
import { useAuth } from "../../src/lib/auth-context";
import {
  radius,
  spacing,
  typography,
  useTheme,
  useThemedStyles,
  type Palette,
} from "../../src/lib/theme";
import { authMeQueryOptions, queryStaleTime, trpc } from "../../src/lib/trpc";
import { tonnageFromKg, weightLabel } from "../../src/lib/units";
import { useUserPreferences } from "../../src/lib/use-preferences";
import { alertWorkoutConflict } from "../../src/lib/workout-errors";
import {
  WORKOUT_HISTORY_PAGE_SIZE,
  flattenFinishedWorkouts,
  useWorkoutHistoryInfinite,
  workoutHistoryInfiniteOptions,
} from "../../src/lib/workout-history-query";
import { navigateToActiveWorkout } from "../../src/lib/workout-navigation";

function formatDashboardDate(date = new Date()) {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function SectionHeader({
  title,
  action,
  delay = 200,
}: {
  title: string;
  action?: ReactNode;
  delay?: number;
}) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionTitleWrap}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Animated.View
          entering={FadeInLeft.delay(delay).springify().damping(16)}
          style={styles.sectionUnderline}
        />
      </View>
      {action}
    </View>
  );
}

function AnimatedCounter({
  value,
  loading,
  style,
}: {
  value: number;
  loading: boolean;
  style: object;
}) {
  const animatedValue = useSharedValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (loading) return;
    animatedValue.value = 0;
    animatedValue.value = withTiming(value, { duration: 800 });
  }, [animatedValue, loading, value]);

  useAnimatedReaction(
    () => animatedValue.value,
    (current) => {
      runOnJS(setDisplay)(Math.round(current));
    },
  );

  if (loading) {
    return <Text style={style}>–</Text>;
  }

  return <Text style={style}>{display.toLocaleString()}</Text>;
}

function WeeklyProgressHeroCard({
  weeklyLoading,
  totalVolume,
  volumeUnit,
  chartData,
  onPress,
}: {
  weeklyLoading: boolean;
  totalVolume: number;
  volumeUnit: string;
  chartData: Array<{ label: string; value: number }>;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { scale, onPressIn, onPressOut } = useSpringPress();
  const glowOpacity = useSharedValue(0.35);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.75, { duration: 1600 }),
        withTiming(0.35, { duration: 1600 }),
      ),
      -1,
      true,
    );
  }, [glowOpacity]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <Animated.View
      entering={entranceDown(100)}
      style={[scale, styles.heroCardOuter]}
    >
      <Animated.View style={[styles.heroCardGlow, glowStyle]} pointerEvents="none" />
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.heroCard}
      >
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Weekly Progress</Text>
            <View style={styles.heroBigRow}>
              <AnimatedCounter
                value={Math.round(totalVolume)}
                loading={weeklyLoading}
                style={styles.heroBig}
              />
              {!weeklyLoading ? (
                <Text style={styles.heroUnit}>{volumeUnit}</Text>
              ) : null}
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
              <View
                key={i}
                style={[styles.heroBarSkeleton, { height: 120 * h }]}
              />
            ))}
          </View>
        ) : (
          <LineChart data={chartData} height={120} />
        )}

        <View style={styles.heroLabels}>
          {(weeklyLoading
            ? ["M", "T", "W", "T", "F", "S", "S"]
            : chartData.map((d) => d.label)
          ).map((label, i) => (
            <Text key={`${label}-${i}`} style={styles.heroDay}>
              {label}
            </Text>
          ))}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function ActiveWorkoutCard({
  name,
  exerciseCount,
  onPress,
}: {
  name: string;
  exerciseCount: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const pulseStyle = usePulse();

  return (
    <Animated.View entering={SlideInRight.delay(200).springify().damping(16)}>
      <Pressable style={styles.activeCard} onPress={onPress}>
        <LinearGradient
          colors={[colors.accent, "rgba(61,181,74,0.2)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.activeAccentBorder}
        />
        <View style={styles.activeIcon}>
          <BoltIcon color={colors.onAccent} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.activeTitleRow}>
            <Animated.View style={[styles.activePulseDot, pulseStyle]} />
            <Text style={styles.activeTitle} numberOfLines={1}>
              {name}
            </Text>
          </View>
          <Text style={styles.activeSub}>
            {exerciseCount} exercises · tap to continue
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
      </Pressable>
    </Animated.View>
  );
}

function StartEmptyWorkoutButton({
  onPress,
  loading,
}: {
  onPress: () => void;
  loading: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const { scale, onPressIn, onPressOut } = useSpringPress();

  return (
    <Animated.View entering={entranceDown(200)} style={scale}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={loading}
        style={[styles.startEmptyButton, loading && styles.buttonDisabled]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <PlusCircleIcon color="#fff" size={22} />
            <Text style={styles.startEmptyLabel}>Start Empty Workout</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

function DashboardScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const utils = trpc.useUtils();
  const { showToast } = useToast();

  useEffect(() => {
    void utils.workout.history.prefetchInfinite(
      { limit: WORKOUT_HISTORY_PAGE_SIZE },
      workoutHistoryInfiniteOptions,
    );
    void utils.exercise.list.prefetch({ limit: 50 });
  }, [utils]);

  const { isAuthenticated } = useAuth();
  const { weightUnit } = useUserPreferences();
  const { data: me } = trpc.auth.me.useQuery(undefined, {
    ...authMeQueryOptions,
    enabled: isAuthenticated,
  });
  const {
    data: stats,
    isPending: statsPending,
    isError: statsError,
  } = trpc.auth.stats.useQuery(undefined, {
    staleTime: queryStaleTime.authStats,
    enabled: isAuthenticated,
  });
  const {
    data: active,
    isPending: activePending,
    isError: activeError,
    refetch: refetchActive,
  } = trpc.workout.active.useQuery(undefined, {
    staleTime: queryStaleTime.workoutActive,
  });
  const {
    data: historyPages,
    isPending: recentPending,
    isError: recentError,
    refetch: refetchRecent,
  } = useWorkoutHistoryInfinite();
  const finished = flattenFinishedWorkouts(historyPages?.pages);
  const { data: weeklyChart, isPending: weeklyPending } =
    trpc.progress.weeklyVolume.useQuery(undefined, {
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

  const statsLoading = isAuthenticated && statsPending && stats === undefined;
  const statsValue = (n: number | undefined) => {
    if (!isAuthenticated) return "–";
    if (statsLoading) return "–";
    if (statsError) return "–";
    return n ?? 0;
  };
  const weeklyLoading = weeklyPending && weeklyChart === undefined;
  const recentLoading = recentPending && historyPages === undefined;
  const routinesLoading = routinesPending && routines === undefined;
  const activeLoading = activePending && active === undefined;

  const [startingRoutineId, setStartingRoutineId] = useState<string | null>(
    null,
  );
  const [expandedRoutineIds, setExpandedRoutineIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [deleteWorkoutDialog, setDeleteWorkoutDialog] = useState<{
    visible: boolean;
    workoutId?: string;
    name?: string;
  }>({ visible: false });
  const [startConfirm, setStartConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);

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

  const deleteWorkout = trpc.workout.delete.useMutation({
    onSuccess: () => {
      setDeleteWorkoutDialog({ visible: false });
      void Promise.all([
        utils.workout.history.invalidate(),
        utils.auth.stats.invalidate(),
        utils.progress.weeklyVolume.invalidate(),
        utils.progress.dashboard.invalidate(),
        utils.progress.volumeHistory.invalidate(),
        utils.progress.muscleDistribution.invalidate(),
        utils.personalRecord.list.invalidate(),
      ]);
    },
    onError: (e) => showToast(e.message, "error"),
  });

  // Weekly progress — all workouts in the last 7 calendar days
  const chartData = weeklyChart ?? [];
  const totalVolumeKg = chartData.reduce((sum, d) => sum + d.value, 0);
  const totalVolume = tonnageFromKg(totalVolumeKg, weightUnit);
  const volumeUnit = weightLabel(weightUnit);

  const statItems = [
    {
      value: statsValue(stats?.workoutCount),
      label: "Workouts",
      onPress: () => router.push("/(tabs)/progress"),
    },
    {
      value: statsValue(stats?.routineCount),
      label: "Routines",
      onPress: () => router.push("/(tabs)/routines"),
    },
    {
      value: statsValue(stats?.prCount),
      label: "PRs",
      onPress: () =>
        router.push({
          pathname: "/(tabs)/progress",
          params: { tab: "prs" },
        }),
    },
  ];

  return (
    <Screen scroll padded={false} variant="tab">
      <View style={styles.pad}>
        {/* Greeting header + stats */}
        <View style={styles.headerBlock}>
          <Animated.View
            entering={entranceDown()}
            style={styles.greetingRow}
          >
            <View style={styles.greetingText}>
              <Text style={styles.greetingTitle}>Ready to train?</Text>
              <Text style={styles.greetingDate}>{formatDashboardDate()}</Text>
            </View>
            <View style={styles.headerRight}>
              <Pressable
                hitSlop={8}
                style={styles.gear}
                onPress={() => router.push("/settings")}
              >
                <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
              </Pressable>
              <Pressable onPress={() => router.push("/(tabs)/profile")}>
                <View style={[styles.avatarRing, { borderColor: colors.accent }]}>
                  <Avatar name={me?.name} size={48} />
                </View>
              </Pressable>
            </View>
          </Animated.View>

          <View style={styles.statsRow}>
            {statItems.map((stat, index) => (
              <Animated.View
                key={stat.label}
                entering={entranceDown(index * 80)}
                style={styles.statWrap}
              >
                <Stat
                  value={stat.value}
                  label={stat.label}
                  onPress={stat.onPress}
                />
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Weekly progress hero card */}
        <WeeklyProgressHeroCard
          weeklyLoading={weeklyLoading}
          totalVolume={totalVolume}
          volumeUnit={volumeUnit}
          chartData={chartData}
          onPress={() => router.push("/(tabs)/progress")}
        />

        {/* Primary CTA / continue active workout */}
        {activeError ? (
          <QueryErrorState
            message="Couldn't check active workout. Check your connection."
            onRetry={() => void refetchActive()}
          />
        ) : active ? (
          <ActiveWorkoutCard
            name={active.name ?? "Workout in progress"}
            exerciseCount={active.exercises.length}
            onPress={() => router.push("/workout/active")}
          />
        ) : !activeLoading ? (
          <StartEmptyWorkoutButton
            onPress={() => startEmpty.mutate({})}
            loading={startEmpty.isPending}
          />
        ) : null}

        {/* Recent Activity */}
        <SectionHeader
          title="Recent Activity"
          delay={300}
          action={
            finished.length > 0 ? (
              <Pressable
                hitSlop={8}
                onPress={() => router.push("/workout/history")}
              >
                <Text style={styles.viewAll}>View all</Text>
              </Pressable>
            ) : undefined
          }
        />
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
            {finished.slice(0, 3).map((w, index) => (
              <ActivityCard
                key={w.id}
                index={index}
                title={w.name ?? "Workout"}
                subtitle={`${w.exerciseCount} exercises · ${Math.round(tonnageFromKg(w.volume, weightUnit)).toLocaleString()} ${weightLabel(weightUnit)}`}
                onPress={() => router.push(`/workout/${w.id}`)}
                onLongPress={() =>
                  setDeleteWorkoutDialog({
                    visible: true,
                    workoutId: w.id,
                    name: w.name ?? "Workout",
                  })
                }
              />
            ))}
          </View>
        )}

        {/* My Routines */}
        <SectionHeader
          title="My Routines"
          delay={400}
          action={
            !routinesLoading && (routines?.length ?? 0) > 0 ? (
              <Pressable
                hitSlop={8}
                onPress={() => router.push("/workout/my-routines")}
              >
                <Text style={styles.viewAll}>View all</Text>
              </Pressable>
            ) : undefined
          }
        />

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
            {routines?.slice(0, 4).map((item, index) => (
              <Animated.View
                key={item.id}
                entering={entranceDown(400 + index * 80)}
              >
                <RoutineExpandableCard
                  routine={item}
                  expanded={expandedRoutineIds.has(item.id)}
                  onToggleExpand={() => toggleRoutineExpanded(item.id)}
                  disabled={startingRoutineId === item.id}
                  loading={startingRoutineId === item.id}
                  onStart={() =>
                    setStartConfirm({ id: item.id, name: item.name })
                  }
                />
              </Animated.View>
            ))}
          </View>
        )}
      </View>

      <ThemedDialog
        visible={startConfirm !== null}
        title="Start workout?"
        message={startConfirm ? `Begin "${startConfirm.name}" now?` : undefined}
        onDismiss={() => setStartConfirm(null)}
        buttons={[
          { label: "Cancel" },
          {
            label: "Start",
            variant: "primary",
            onPress: () => {
              if (!startConfirm) return;
              setStartingRoutineId(startConfirm.id);
              startRoutine.mutate({ routineId: startConfirm.id });
              setStartConfirm(null);
            },
          },
        ]}
      />

      <ThemedDialog
        visible={deleteWorkoutDialog.visible}
        title="Delete workout?"
        message={
          deleteWorkoutDialog.name
            ? `Remove "${deleteWorkoutDialog.name}" from your history? This cannot be undone.`
            : "Remove this workout from your history? This cannot be undone."
        }
        onDismiss={() => setDeleteWorkoutDialog({ visible: false })}
        buttons={[
          { label: "Cancel" },
          {
            label: deleteWorkout.isPending ? "Deleting…" : "Delete",
            variant: "destructive",
            onPress: () => {
              if (deleteWorkoutDialog.workoutId) {
                deleteWorkout.mutate({ id: deleteWorkoutDialog.workoutId });
              }
            },
          },
        ]}
      />
    </Screen>
  );
}

export default function DashboardScreenWithErrorBoundary() {
  const utils = trpc.useUtils();

  return (
    <QueryErrorBoundary
      onRetry={() => {
        void utils.workout.history.invalidate();
        void utils.workout.active.invalidate();
        void utils.auth.stats.invalidate();
      }}
    >
      <DashboardScreen />
    </QueryErrorBoundary>
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
  index,
  title,
  subtitle,
  onPress,
  onLongPress,
  disabled,
}: {
  index: number;
  title: string;
  subtitle: string;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { scale, onPressIn, onPressOut } = useSpringPress();

  return (
    <Animated.View
      entering={entranceDown(300 + index * 60)}
      style={scale}
    >
      <Pressable
        disabled={disabled}
        style={[
          styles.activityCard,
          disabled && { opacity: 0.5 },
        ]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onLongPress={onLongPress}
      >
        <View style={[styles.activityAccentBorder, { backgroundColor: colors.accent }]} />
        <View style={styles.activityIcon}>
          <ClockIcon color={colors.onAccent} size={20} />
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
    </Animated.View>
  );
}

const makeStyles = (colors: Palette) => {
  const cardShadow = Platform.select({
    ios: {
      shadowColor: "#000000",
      shadowOpacity: colors.bg === "#000000" ? 0.42 : 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: colors.bg === "#000000" ? 4 : 2 },
    web: {
      boxShadow:
        colors.bg === "#000000"
          ? "0 10px 28px rgba(0,0,0,0.42)"
          : "0 6px 18px rgba(0,0,0,0.08)",
    },
    default: {},
  });
  const glowShadow = Platform.select({
    ios: {
      shadowColor: colors.accent,
      shadowOpacity: 0.28,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 5 },
    web: { boxShadow: `0 12px 30px ${colors.accentMuted}` },
    default: {},
  });

  return StyleSheet.create({
    pad: {
      paddingHorizontal: spacing.lg,
      gap: spacing.lg,
    },

    headerBlock: { gap: spacing.lg },
    greetingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    greetingText: { flex: 1, gap: spacing.xs },
    greetingTitle: {
      ...typography.h1,
      color: colors.text,
    },
    greetingDate: {
      ...typography.bodySmall,
      color: colors.textMuted,
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    avatarRing: {
      borderWidth: 2,
      borderRadius: 999,
      padding: spacing.xs,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    statWrap: { flex: 1 },
    statCol: { alignItems: "center", gap: spacing.xs },
    statValueRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    statValue: { fontSize: 18, fontWeight: "800", color: colors.text }, // custom: dashboard stat emphasis
    statLabel: { ...typography.label, color: colors.textMuted },
    gear: { padding: spacing.xs },

    heroCardOuter: {
      borderRadius: radius.xl,
      position: "relative",
    },
    heroCardGlow: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radius.xl,
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.55)",
    },
    heroCard: {
      backgroundColor: colors.accent,
      borderRadius: radius.xl,
      padding: spacing.xl,
      gap: spacing.lg,
      ...glowShadow,
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    heroTitle: {
      ...typography.bodySmall,
      fontWeight: "700",
      color: colors.onAccentMuted,
      letterSpacing: 0.3,
    },
    heroBigRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    heroBig: {
      // custom: hero metric display number
      fontSize: 40,
      fontWeight: "800",
      color: colors.onAccent,
      lineHeight: 44,
    },
    heroUnit: {
      ...typography.h3,
      color: colors.onAccentMuted,
      marginBottom: spacing.sm,
    },
    heroSub: {
      ...typography.caption,
      color: colors.onAccentMuted,
      marginTop: spacing.xs,
    },
    heroBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent: "center",
    },
    heroLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    heroDay: {
      flex: 1,
      textAlign: "center",
      ...typography.label,
      color: colors.onAccentFaint,
    },
    heroChartSkeleton: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      height: 120,
      gap: spacing.sm,
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
      overflow: "hidden",
      ...cardShadow,
    },
    activeAccentBorder: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
    },
    activeIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    activeTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    activePulseDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
    activeTitle: {
      flex: 1,
      ...typography.h3,
      color: colors.text,
    },
    activeSub: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },

    startEmptyButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: colors.accent,
      borderRadius: radius.lg,
      minHeight: 52,
      paddingHorizontal: spacing.xl,
      ...glowShadow,
    },
    startEmptyLabel: {
      ...typography.button,
      color: "#fff",
    },
    buttonDisabled: { opacity: 0.6 },

    sectionTitle: { ...typography.h2, color: colors.text },
    sectionTitleWrap: { gap: spacing.sm },
    sectionUnderline: {
      width: 32,
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.accent,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    viewAll: { ...typography.body, fontWeight: "700", color: colors.accent },

    cardStack: { gap: spacing.md },
    activityCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      overflow: "hidden",
      ...cardShadow,
    },
    activityAccentBorder: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 2,
    },
    activityIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    activityTitle: { ...typography.h3, color: colors.text },
    activitySub: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
    pressed: { opacity: 0.7 },

    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: "center",
      gap: spacing.md,
    },
    emptyTitle: { ...typography.h3, color: colors.text },
    emptyHint: {
      ...typography.bodySmall,
      color: colors.textMuted,
      textAlign: "center",
    },
  });
};
