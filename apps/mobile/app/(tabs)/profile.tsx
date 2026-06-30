import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  HevyDashboardGrid,
  HevyIconButton,
  HevySegmentedControl,
  HevyStatsRow,
  HevyTopBar,
} from "../../src/components/hevy-ui";
import { useAuth } from "../../src/lib/auth-context";
import { trpc, authMeQueryOptions, queryStaleTime } from "../../src/lib/trpc";
import { formatWeight, tonnageFromKg, weightLabel } from "../../src/lib/units";
import { useUserPreferences } from "../../src/lib/use-preferences";
import { spacing, useTheme, useThemedStyles, type Palette } from "../../src/lib/theme";

type ChartMode = "duration" | "volume" | "reps";

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { signOut } = useAuth();
  const { weightUnit } = useUserPreferences();
  const [chartMode, setChartMode] = useState<ChartMode>("volume");
  const { data: user } = trpc.auth.me.useQuery(undefined, authMeQueryOptions);
  const { data: stats } = trpc.auth.stats.useQuery(undefined, { staleTime: queryStaleTime.authStats });
  const { data: volumeHistory, isLoading: chartLoading } = trpc.progress.volumeHistory.useQuery(
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
  // Banner: only show while bio is empty — the one thing we can guide them to add.
  const showBanner = Boolean(user) && !user?.bio?.trim();

  const chartData = useMemo(() => {
    if (!volumeHistory?.length) return [];
    return volumeHistory.map((v) => ({
      label: v.label,
      value:
        chartMode === "volume"
          ? v.volume
          : chartMode === "duration"
            ? v.durationMinutes
            : v.totalReps,
    }));
  }, [volumeHistory, chartMode]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <Screen scroll padded={false}>
      <View style={styles.pad}>
        <HevyTopBar
          title={username}
          right={
            <>
              <HevyIconButton icon="create-outline" onPress={() => router.push("/profile-edit")} />
              <HevyIconButton icon="settings-outline" onPress={() => router.push("/settings")} />
            </>
          }
        />

        <View style={styles.profileRow}>
          <Avatar name={user?.name} size={80} />
          <HevyStatsRow
            items={[
              { value: stats?.workoutCount ?? 0, label: "Workouts" },
              { value: stats?.routineCount ?? 0, label: "Routines" },
              { value: stats?.prCount ?? 0, label: "PRs" },
            ]}
          />
        </View>

        {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}

        {showBanner ? (
          <HevyBanner
            text="Add a bio to complete your profile"
            onPress={() => router.push("/profile-edit")}
          />
        ) : null}

        <HevySegmentedControl
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
        ) : chartData.length === 0 ? (
          <View style={styles.noDataCard}>
            <Ionicons name="bar-chart-outline" size={40} color={colors.textDim} />
            <Text style={styles.noDataText}>No data yet</Text>
          </View>
        ) : (
          <BarChart
            data={chartData}
            color={colors.accent}
            unit={chartMode === "volume" ? "kg" : chartMode === "duration" ? "m" : ""}
          />
        )}

        <Text style={styles.sectionLabel}>Dashboard</Text>
        <HevyDashboardGrid
          items={[
            { icon: "stats-chart-outline", label: "Statistics", onPress: () => router.push("/(tabs)/progress") },
            { icon: "calendar-outline", label: "Calendar", onPress: () => router.push("/calendar") },
            { icon: "camera-outline", label: "Photos", onPress: () => router.push("/photos") },
            { icon: "folder-outline", label: "Routines", onPress: () => router.push("/workout/my-routines") },
            { icon: "barbell-outline", label: "Exercises", onPress: () => router.push("/(tabs)/exercises") },
            { icon: "body-outline", label: "Measures", onPress: () => router.push("/measurements") },
            { icon: "restaurant-outline", label: "Meals", onPress: () => router.push("/(tabs)/nutrition") },
            { icon: "code-slash-outline", label: "API", onPress: () => router.push("/developer-api") },
            { icon: "settings-outline", label: "Settings", onPress: () => router.push("/settings") },
          ]}
        />

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
                <ListRow
                  key={item.id}
                  title={item.name ?? "Workout"}
                  subtitle={`${Math.round(tonnageFromKg(item.volume, weightUnit)).toLocaleString()} ${weightLabel(weightUnit)} · ${item.finishedAt ? new Date(item.finishedAt).toLocaleDateString() : ""}`}
                  onPress={() => router.push(`/workout/${item.id}`)}
                  last={index === workouts.length - 1 && !hasNextPage}
                />
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

        <Button label="Sign Out" variant="ghost" fullWidth onPress={handleSignOut} />
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  pad: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  profileRow: { flexDirection: "row", alignItems: "center", gap: spacing.xl },
  bio: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  noDataCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: spacing.xxxl,
    alignItems: "center",
    gap: spacing.sm,
  },
  noDataText: { color: colors.textMuted, fontSize: 15 },
  sectionLabel: { fontSize: 13, color: colors.textMuted, fontWeight: "500", marginTop: spacing.sm },
});
