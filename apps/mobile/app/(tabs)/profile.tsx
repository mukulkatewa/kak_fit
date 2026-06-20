import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import {
  Button,
  Card,
  EmptyState,
  ListRow,
  PRBadge,
  Screen,
  SectionHeader,
  StatPill,
  Title,
} from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors, spacing } from "../../src/lib/theme";
import { signOut } from "../../src/lib/auth";

export default function ProfileScreen() {
  const router = useRouter();
  const { data: user } = trpc.auth.me.useQuery();
  const { data: stats } = trpc.auth.stats.useQuery();
  const { data: workouts, isLoading } = trpc.workout.history.useQuery({ limit: 10 });
  const { data: prs } = trpc.personalRecord.list.useQuery({ limit: 8 });

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() ?? "K"}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Title>{user?.name ?? "Athlete"}</Title>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.tierBadge}>
            <Text style={styles.tierText}>{user?.subscriptionTier ?? "FREE"}</Text>
          </View>
        </View>
      </View>

      {stats ? (
        <View style={styles.statsRow}>
          <StatPill value={stats.workoutCount} label="Sessions" accent />
          <StatPill value={stats.prCount} label="PRs" gold />
          <StatPill value={stats.customExerciseCount} label="Custom" />
        </View>
      ) : null}

      <SectionHeader title="Personal Records" />
      <View style={styles.prGrid}>
        {(prs ?? []).length === 0 ? (
          <EmptyState icon="trophy-outline" title="No PRs yet" message="Finish workouts to unlock records." />
        ) : (
          prs?.map((pr) => (
            <View key={pr.id} style={styles.prCard}>
              <PRBadge label={pr.type.replace(/_/g, " ")} />
              <Text style={styles.prName}>{pr.exercise.name}</Text>
              <Text style={styles.prVal}>
                {pr.type === "MAX_REPS" ? `${pr.value} reps` : `${pr.value.toFixed(1)} kg`}
              </Text>
            </View>
          ))
        )}
      </View>

      <SectionHeader title="Workout History" />
      {isLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <FlatList
          data={workouts ?? []}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState icon="calendar-outline" title="No workouts yet" message="Your sessions will appear here." />
          }
          renderItem={({ item }) => (
            <ListRow
              title={item.name ?? "Workout"}
              subtitle={`${item.exerciseCount} exercises · ${Math.round(item.volume)} kg vol · ${item.finishedAt ? new Date(item.finishedAt).toLocaleDateString() : ""}`}
              icon="barbell-outline"
            />
          )}
        />
      )}

      <Card>
        <Text style={styles.settingsTitle}>Account</Text>
        <Button label="Sign Out" variant="ghost" icon="log-out-outline" onPress={handleSignOut} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", gap: spacing.lg, alignItems: "center" },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentMuted,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 28, fontWeight: "800", color: colors.accentNeon },
  headerInfo: { flex: 1, gap: 4 },
  email: { color: colors.textMuted, fontSize: 13 },
  tierBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  tierText: { fontSize: 10, fontWeight: "700", color: colors.textMuted, letterSpacing: 1 },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  prGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  prCard: {
    width: "48%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.goldMuted,
    padding: spacing.md,
    gap: 6,
  },
  prName: { color: colors.text, fontWeight: "600", fontSize: 13 },
  prVal: { color: colors.gold, fontWeight: "800", fontSize: 16 },
  list: { gap: spacing.sm },
  settingsTitle: { color: colors.textMuted, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
});
