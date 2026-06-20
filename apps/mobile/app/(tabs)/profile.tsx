import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import {
  Avatar,
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
import { useAuth } from "../../src/lib/auth-context";
import { trpc } from "../../src/lib/trpc";
import { colors, radius, spacing } from "../../src/lib/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
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
        <Avatar name={user?.name} size={68} />
        <View style={styles.headerInfo}>
          <Title>{user?.name ?? "Athlete"}</Title>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.tierBadge}>
            <Text style={styles.tierText}>{user?.subscriptionTier ?? "FREE"} PLAN</Text>
          </View>
        </View>
      </View>

      {stats ? (
        <View style={styles.statsRow}>
          <StatPill value={stats.workoutCount} label="SESSIONS" accent />
          <StatPill value={stats.prCount} label="PRS" gold />
          <StatPill value={stats.customExerciseCount} label="CUSTOM" />
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
              <Text style={styles.prName} numberOfLines={1}>
                {pr.exercise.name}
              </Text>
              <Text style={styles.prVal}>
                {pr.type === "MAX_REPS" ? `${pr.value} reps` : `${pr.value.toFixed(1)} kg`}
              </Text>
            </View>
          ))
        )}
      </View>

      <SectionHeader title="History" />
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
              subtitle={`${item.exerciseCount} exercises · ${Math.round(item.volume)} kg · ${item.finishedAt ? new Date(item.finishedAt).toLocaleDateString() : ""}`}
              icon="checkmark-done-outline"
            />
          )}
        />
      )}

      <Card>
        <Text style={styles.settingsTitle}>ACCOUNT</Text>
        <Button label="Sign Out" variant="danger" icon="log-out-outline" fullWidth onPress={handleSignOut} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", gap: spacing.lg, alignItems: "center" },
  headerInfo: { flex: 1, gap: 4 },
  email: { color: colors.textMuted, fontSize: 13 },
  tierBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  tierText: { fontSize: 9, fontWeight: "800", color: colors.accentBright, letterSpacing: 1 },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  prGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  prCard: {
    width: "48%",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.goldMuted,
    padding: spacing.md,
    gap: 8,
  },
  prName: { color: colors.text, fontWeight: "600", fontSize: 13 },
  prVal: { color: colors.gold, fontWeight: "800", fontSize: 17 },
  list: { gap: spacing.sm },
  settingsTitle: { color: colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
});
