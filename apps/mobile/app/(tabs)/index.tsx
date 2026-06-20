import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { HevyButton, ListGroup, ListRow, Screen, SectionHeader } from "../../src/components/ui";
import { FeedSkeleton } from "../../src/components/skeleton";
import { HevyIconButton, HevyTopBar } from "../../src/components/hevy-ui";
import { trpc } from "../../src/lib/trpc";
import { colors, spacing } from "../../src/lib/theme";

export default function DashboardScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: nutrition, isLoading: nutritionLoading } = trpc.nutrition.dailySummary.useQuery();
  const { data: active, isLoading: activeLoading } = trpc.workout.active.useQuery();
  const { data: recent, isLoading: recentLoading } = trpc.workout.history.useQuery({ limit: 8 });

  const loading = activeLoading || recentLoading;

  const startEmpty = trpc.workout.startEmpty.useMutation({
    onSuccess: () => {
      utils.workout.active.invalidate();
      router.push("/workout/active");
    },
    onError: (e) => Alert.alert("Error", e.message),
  });

  return (
    <Screen scroll padded={false}>
      <View style={styles.headerPad}>
        <HevyTopBar
          title="Home"
          showChevron
          right={
            <>
              <HevyIconButton icon="search-outline" onPress={() => router.push("/(tabs)/exercises")} />
              <HevyIconButton icon="notifications-outline" />
            </>
          }
        />
      </View>

      {loading ? (
        <View style={styles.headerPad}>
          <FeedSkeleton rows={4} />
        </View>
      ) : (
        <View style={styles.headerPad}>
          {active ? (
            <ListGroup>
              <ListRow
                title={active.name ?? "Workout in progress"}
                subtitle={`${active.exercises.length} exercises · tap to continue`}
                icon="barbell-outline"
                onPress={() => router.push("/workout/active")}
                last
              />
            </ListGroup>
          ) : (
            <View style={styles.cta}>
              <HevyButton
                label="Start Workout"
                onPress={() => startEmpty.mutate({})}
                loading={startEmpty.isPending}
              />
            </View>
          )}

          {!nutritionLoading && nutrition && nutrition.mealCount > 0 ? (
            <Pressable style={styles.macroCard} onPress={() => router.push("/(tabs)/nutrition")}>
              <Text style={styles.macroTitle}>Today</Text>
              <Text style={styles.macroBody}>
                {nutrition.calories} cal · P{nutrition.protein} · C{nutrition.carbs} · F{nutrition.fat}
              </Text>
            </Pressable>
          ) : null}

          <SectionHeader title="Recent workouts" />

          {(recent ?? []).length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No workouts yet</Text>
            </View>
          ) : (
            <ListGroup>
              {recent?.map((item, index) => (
                <ListRow
                  key={item.id}
                  title={item.name ?? "Workout"}
                  subtitle={`${item.exerciseCount} exercises · ${Math.round(item.volume)} kg · ${item.finishedAt ? new Date(item.finishedAt).toLocaleDateString() : ""}`}
                  last={index === (recent?.length ?? 0) - 1}
                />
              ))}
            </ListGroup>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  cta: { gap: spacing.sm },
  macroCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    gap: 4,
  },
  macroTitle: { fontSize: 13, color: colors.textMuted },
  macroBody: { fontSize: 16, fontWeight: "600", color: colors.text },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.xxxl,
    alignItems: "center",
  },
  emptyText: { color: colors.textMuted, fontSize: 15 },
});
