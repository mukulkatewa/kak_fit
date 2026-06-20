import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Card, EmptyState, ListItem, Screen, Subtitle, Title } from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors, spacing } from "../../src/lib/theme";
import { signOut } from "../../src/lib/auth";

export default function WorkoutTab() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: user } = trpc.auth.me.useQuery();
  const { data: stats } = trpc.auth.stats.useQuery();
  const { data: active, isLoading } = trpc.workout.active.useQuery();

  const startEmpty = trpc.workout.startEmpty.useMutation({
    onSuccess: () => {
      utils.workout.active.invalidate();
      router.push("/workout/active");
    },
    onError: (e) => Alert.alert("Error", e.message),
  });

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.badge}>KAK FIT</Text>
          <Title>Hey, {user?.name?.split(" ")[0] ?? "Lifter"}</Title>
          <Subtitle>Ready to train?</Subtitle>
        </View>
        <Button label="Sign out" onPress={handleSignOut} variant="secondary" />
      </View>

      {stats ? (
        <View style={styles.statsRow}>
          <Stat label="Workouts" value={stats.workoutCount} />
          <Stat label="Routines" value={stats.routineCount} />
          <Stat label="PRs" value={stats.prCount} />
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : active ? (
        <Card>
          <Text style={styles.activeLabel}>Active workout</Text>
          <Text style={styles.activeTitle}>{active.name ?? "Workout"}</Text>
          <Text style={styles.activeMeta}>
            {active.exercises.length} exercises • started{" "}
            {new Date(active.startedAt).toLocaleTimeString()}
          </Text>
          <Button label="Continue Workout" onPress={() => router.push("/workout/active")} />
        </Card>
      ) : (
        <Card>
          <Text style={styles.activeTitle}>No active workout</Text>
          <Subtitle>Start empty or pick a routine from the Routines tab.</Subtitle>
          <Button
            label="Start Empty Workout"
            onPress={() => startEmpty.mutate({})}
            loading={startEmpty.isPending}
          />
        </Card>
      )}

      <Text style={styles.sectionTitle}>Quick tips</Text>
      <ScrollView>
        <EmptyState
          title="Phase 1 is live"
          message="Log sets with weight and reps, finish workouts to unlock PR tracking and history."
        />
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.md },
  badge: { color: colors.primary, fontSize: 11, fontWeight: "700", letterSpacing: 3 },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
    padding: spacing.md,
    alignItems: "center",
  },
  statValue: { color: colors.text, fontSize: 22, fontWeight: "700" },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  activeLabel: { color: colors.primary, fontSize: 12, fontWeight: "600" },
  activeTitle: { color: colors.text, fontSize: 20, fontWeight: "700" },
  activeMeta: { color: colors.textMuted, fontSize: 13 },
  sectionTitle: { color: colors.textMuted, fontSize: 13, fontWeight: "600", marginTop: spacing.sm },
});
