import { useRouter } from "expo-router";
import { useEffect, useMemo, useState, type FC } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  ArrowRightStartOnRectangleIcon,
  BeakerIcon,
  CalendarDaysIcon,
  CameraIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  FolderIcon,
  UserIcon,
} from "react-native-heroicons/outline";
import Animated, {
  FadeIn,
  FadeInRight,
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { BarChart } from "../../src/components/charts";
import { CardSkeleton } from "../../src/components/skeleton";
import {
  Avatar,
  Button,
  ListGroup,
  ListRow,
  Screen,
  SectionHeader,
} from "../../src/components/ui";
import { QueryErrorState } from "../../src/components/query-error-state";
import {
  flattenFinishedWorkouts,
  useWorkoutHistoryInfinite,
} from "../../src/lib/workout-history-query";
import {
  HevyBanner,
  HevyIconButton,
  HevyStatsRow,
  HevyTopBar,
} from "../../src/components/hevy-ui";
import { entranceDown, SPRING_CONFIG, useSpringPress } from "../../src/lib/animations";
import { useAuth } from "../../src/lib/auth-context";
import { trpc, authMeQueryOptions, queryStaleTime } from "../../src/lib/trpc";
import { tonnageFromKg, weightLabel } from "../../src/lib/units";
import { useUserPreferences } from "../../src/lib/use-preferences";
import { TOUCH_TARGET_MIN } from "../../src/lib/layout-constants";
import { radius, spacing, typography, useTheme, useThemedStyles, type Palette } from "../../src/lib/theme";

type ChartMode = "duration" | "volume" | "reps";
type GridIcon = FC<{ color?: string; size?: number }>;

type DashboardItem = {
  label: string;
  onPress: () => void;
  Icon?: GridIcon;
  ionIcon?: keyof typeof Ionicons.glyphMap;
};

function AnimatedSegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (key: T) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const [segmentWidth, setSegmentWidth] = useState(0);
  const translateX = useSharedValue(0);
  const activeIndex = options.findIndex((opt) => opt.key === value);

  useEffect(() => {
    if (segmentWidth <= 0) return;
    translateX.value = withSpring(activeIndex * segmentWidth, SPRING_CONFIG.gentle);
  }, [activeIndex, segmentWidth, translateX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={styles.segmented}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        const nextWidth = width / options.length;
        setSegmentWidth(nextWidth);
        translateX.value = withSpring(activeIndex * nextWidth, SPRING_CONFIG.gentle);
      }}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          style={[styles.segmentIndicator, indicatorStyle, { width: segmentWidth - 8 }]}
        />
      ) : null}
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={styles.segment}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DashboardGridItem({
  index,
  item,
}: {
  index: number;
  item: DashboardItem;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { scale, onPressIn, onPressOut } = useSpringPress();

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 50).springify().damping(16)}
      style={[styles.gridItemWrap, scale]}
    >
      <Pressable
        style={styles.gridItem}
        onPress={item.onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        {item.Icon ? (
          <item.Icon color={colors.text} size={22} />
        ) : item.ionIcon ? (
          <Ionicons name={item.ionIcon} size={22} color={colors.text} />
        ) : null}
        <Text style={styles.gridLabel}>{item.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function SignOutButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { scale, onPressIn, onPressOut } = useSpringPress();

  return (
    <Animated.View style={scale}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.signOutBtn}
      >
        <ArrowRightStartOnRectangleIcon color={colors.textMuted} size={20} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { signOut } = useAuth();
  const { weightUnit } = useUserPreferences();
  const [chartMode, setChartMode] = useState<ChartMode>("volume");
  const { data: user } = trpc.auth.me.useQuery(undefined, authMeQueryOptions);
  const { data: stats } = trpc.auth.stats.useQuery(undefined, { staleTime: queryStaleTime.authStats });
  const {
    data: volumeHistory,
    isLoading: chartLoading,
    isError: chartError,
    refetch: refetchChart,
  } = trpc.progress.volumeHistory.useQuery(
    { limit: 8 },
    { staleTime: queryStaleTime.authStats },
  );
  const {
    data: historyPages,
    isLoading,
    isError: workoutsError,
    refetch: refetchWorkouts,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useWorkoutHistoryInfinite();
  const workouts = flattenFinishedWorkouts(historyPages?.pages);
  const utils = trpc.useUtils();

  useEffect(() => {
    void utils.exercise.list.prefetch({ limit: 50 });
    void utils.exercise.muscles.prefetch();
    void utils.progress.calendar.prefetch();
  }, [utils]);

  const username = user?.name?.trim() || user?.email?.split("@")[0] || "athlete";
  const showBanner = Boolean(user) && !user?.bio?.trim();

  const chartData = useMemo(() => {
    if (!volumeHistory?.length) return [];
    return volumeHistory.map((v) => ({
      label: v.label,
      value:
        chartMode === "volume"
          ? tonnageFromKg(v.volume, weightUnit)
          : chartMode === "duration"
            ? v.durationMinutes
            : v.totalReps,
    }));
  }, [volumeHistory, chartMode, weightUnit]);

  const dashboardItems: DashboardItem[] = [
    { Icon: ChartBarIcon, label: "Statistics", onPress: () => router.push("/(tabs)/progress") },
    { Icon: CalendarDaysIcon, label: "Calendar", onPress: () => router.push("/calendar") },
    { Icon: CameraIcon, label: "Photos", onPress: () => router.push("/photos") },
    { Icon: FolderIcon, label: "Routines", onPress: () => router.push("/workout/my-routines") },
    { ionIcon: "barbell-outline", label: "Exercises", onPress: () => router.push("/(tabs)/exercises") },
    { Icon: UserIcon, label: "Measures", onPress: () => router.push("/measurements") },
    { Icon: BeakerIcon, label: "Meals", onPress: () => router.push("/(tabs)/nutrition") },
    { Icon: CommandLineIcon, label: "API", onPress: () => router.push("/developer-api") },
    { Icon: Cog6ToothIcon, label: "Settings", onPress: () => router.push("/settings") },
  ];

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <Screen scroll padded={false} variant="tab">
      <View style={styles.pad}>
        <Animated.View entering={entranceDown(100)}>
          <HevyTopBar
            title={username}
            right={
              <>
                <HevyIconButton icon="create-outline" onPress={() => router.push("/profile-edit")} />
                <HevyIconButton icon="settings-outline" onPress={() => router.push("/settings")} />
              </>
            }
          />
        </Animated.View>

        <View style={styles.profileRow}>
          <Animated.View entering={ZoomIn.springify().damping(14)}>
            <Avatar name={user?.name} size={80} />
          </Animated.View>
          <Animated.View entering={FadeInRight.delay(200).springify().damping(16)} style={styles.statsWrap}>
            <HevyStatsRow
              items={[
                { value: stats?.workoutCount ?? 0, label: "Workouts" },
                { value: stats?.routineCount ?? 0, label: "Routines" },
                { value: stats?.prCount ?? 0, label: "PRs" },
              ]}
            />
          </Animated.View>
        </View>

        {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

        {showBanner ? (
          <HevyBanner
            text="Add a bio to complete your profile"
            onPress={() => router.push("/profile-edit")}
          />
        ) : null}

        <AnimatedSegmentedControl
          options={[
            { key: "duration" as const, label: "Duration" },
            { key: "volume" as const, label: "Volume" },
            { key: "reps" as const, label: "Reps" },
          ]}
          value={chartMode}
          onChange={setChartMode}
        />

        {chartLoading ? (
          <CardSkeleton />
        ) : chartError ? (
          <View style={styles.noDataCard}>
            <Ionicons name="alert-circle-outline" size={36} color={colors.textDim} />
            <Text style={styles.noDataText}>Couldn't load chart</Text>
            <Button label="Retry" variant="secondary" onPress={() => void refetchChart()} />
          </View>
        ) : chartData.length === 0 ? (
          <View style={styles.noDataCard}>
            <Ionicons name="bar-chart-outline" size={40} color={colors.textDim} />
            <Text style={styles.noDataText}>No data yet</Text>
          </View>
        ) : (
          <Animated.View entering={FadeIn.delay(300).duration(500)}>
            <BarChart
              data={chartData}
              color={colors.accent}
              unit={
                chartMode === "volume"
                  ? weightLabel(weightUnit)
                  : chartMode === "duration"
                    ? "m"
                    : ""
              }
            />
          </Animated.View>
        )}

        <Text style={styles.sectionLabel}>Dashboard</Text>
        <View style={styles.grid}>
          {dashboardItems.map((item, index) => (
            <DashboardGridItem key={item.label} index={index} item={item} />
          ))}
        </View>

        <SectionHeader title="Workouts" />
        {workoutsError ? (
          <QueryErrorState
            message="Couldn't load workouts. Check your connection."
            onRetry={() => void refetchWorkouts()}
          />
        ) : isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : workouts.length === 0 ? (
          <View style={styles.noDataCard}>
            <Ionicons name="barbell-outline" size={36} color={colors.textDim} />
            <Text style={styles.noDataText}>No workouts</Text>
          </View>
        ) : (
          <>
            <ListGroup>
              {workouts.map((item, index) => (
                <Animated.View
                  key={item.id}
                  entering={entranceDown(index * 60)}
                >
                  <ListRow
                    title={item.name ?? "Workout"}
                    subtitle={`${Math.round(tonnageFromKg(item.volume, weightUnit)).toLocaleString()} ${weightLabel(weightUnit)} · ${item.finishedAt ? new Date(item.finishedAt).toLocaleDateString() : ""}`}
                    onPress={() => router.push(`/workout/${item.id}`)}
                    last={index === workouts.length - 1 && !hasNextPage}
                  />
                </Animated.View>
              ))}
            </ListGroup>
            {hasNextPage ? (
              <Button
                label={isFetchingNextPage ? "Loading…" : "Load more workouts"}
                variant="secondary"
                fullWidth
                disabled={isFetchingNextPage}
                onPress={() => void fetchNextPage()}
              />
            ) : null}
            <Button
              label="View full history"
              variant="ghost"
              fullWidth
              onPress={() => router.push("/workout/history")}
            />
          </>
        )}

        <SignOutButton onPress={handleSignOut} />
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    pad: { paddingHorizontal: spacing.lg, gap: spacing.lg },
    profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.xl },
    statsWrap: { flex: 1 },
    bio: { ...typography.bodySmall, color: colors.textMuted },
    segmented: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: radius.full,
      padding: spacing.xs,
      position: "relative",
    },
    segmentIndicator: {
      position: "absolute",
      top: spacing.xs,
      left: spacing.xs,
      bottom: spacing.xs,
      backgroundColor: colors.accent,
      borderRadius: radius.full,
    },
    segment: {
      flex: 1,
      paddingVertical: spacing.md,
      minHeight: TOUCH_TARGET_MIN,
      borderRadius: radius.full,
      alignItems: "center",
      zIndex: 1,
    },
    segmentText: { ...typography.bodySmall, fontWeight: "600", color: colors.textMuted },
    segmentTextActive: { color: "#fff" },
    noDataCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: spacing.xxxl,
      alignItems: "center",
      gap: spacing.sm,
    },
    noDataText: { ...typography.body, color: colors.textMuted },
    sectionLabel: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    gridItemWrap: { width: "48%" },
    gridItem: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: 56,
    },
    gridLabel: { ...typography.body, color: colors.text },
    signOutBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.lg,
    },
    signOutText: { ...typography.button, color: colors.textMuted },
  });
