import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
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
import {
  HevyBanner,
  HevyDashboardGrid,
  HevyIconButton,
  HevySegmentedControl,
  HevyStatsRow,
  HevyTopBar,
} from "../../src/components/hevy-ui";
import { useAuth } from "../../src/lib/auth-context";
import { trpc } from "../../src/lib/trpc";
import { spacing, useTheme, useThemedStyles, type Palette } from "../../src/lib/theme";

type ChartMode = "duration" | "volume" | "reps";

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { signOut } = useAuth();
  const [chartMode, setChartMode] = useState<ChartMode>("volume");
  const { data: user } = trpc.auth.me.useQuery();
  const { data: stats } = trpc.auth.stats.useQuery();
  const { data: volumeHistory, isLoading: chartLoading } = trpc.progress.volumeHistory.useQuery({ limit: 8 });
  const { data: workouts, isLoading } = trpc.workout.history.useQuery({ limit: 6 });

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
          <BarChart data={chartData} color={colors.accent} />
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
            { icon: "settings-outline", label: "Settings", onPress: () => router.push("/settings") },
          ]}
        />

        <SectionHeader title="Workouts" />
        {isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (workouts ?? []).length === 0 ? (
          <View style={styles.noDataCard}>
            <Ionicons name="barbell-outline" size={36} color={colors.textDim} />
            <Text style={styles.noDataText}>No workouts</Text>
          </View>
        ) : (
          <ListGroup>
            {workouts?.map((item, index) => (
              <ListRow
                key={item.id}
                title={item.name ?? "Workout"}
                subtitle={`${Math.round(item.volume)} kg · ${item.finishedAt ? new Date(item.finishedAt).toLocaleDateString() : ""}`}
                onPress={() => router.push(`/workout/${item.id}`)}
                last={index === (workouts?.length ?? 0) - 1}
              />
            ))}
          </ListGroup>
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
