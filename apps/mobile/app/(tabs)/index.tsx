import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HevyButton, ListGroup, ListRow, Screen, SectionHeader } from "../../src/components/ui";
import { FeedSkeleton } from "../../src/components/skeleton";
import { HevyIconButton, HevyTopBar } from "../../src/components/hevy-ui";
import { trpc } from "../../src/lib/trpc";
import { alertWorkoutConflict } from "../../src/lib/workout-errors";
import { colors, spacing } from "../../src/lib/theme";

export default function DashboardScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: nutrition, isLoading: nutritionLoading } = trpc.nutrition.dailySummary.useQuery();
  const { data: active, isPending: activePending } = trpc.workout.active.useQuery();
  const { data: recent, isPending: recentPending } = trpc.workout.history.useQuery({ limit: 8 });
  const { data: routines, isPending: routinesPending } = trpc.routine.list.useQuery();

  const initialLoading = (activePending && active === undefined) || (recentPending && recent === undefined);

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

      {initialLoading ? (
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
                label="Start Empty Workout"
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

          <SectionHeader
            title="My routines"
            action={routines && routines.length > 0 ? "See all" : undefined}
            onAction={routines && routines.length > 0 ? () => router.push("/workout/my-routines") : undefined}
          />

          {routinesPending && routines === undefined ? (
            <FeedSkeleton rows={2} />
          ) : (routines ?? []).length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No routines yet</Text>
              <HevyButton
                label="Create Routine"
                variant="secondary"
                onPress={() => router.push("/routine/create")}
              />
            </View>
          ) : (
            <ListGroup>
              {routines?.slice(0, 4).map((item, index, arr) => (
                <ListRow
                  key={item.id}
                  title={item.name}
                  subtitle={`${item.exercises.length} exercises · tap to start`}
                  icon="folder-outline"
                  onPress={() => startRoutine.mutate({ routineId: item.id })}
                  last={index === arr.length - 1}
                />
              ))}
            </ListGroup>
          )}

          <SectionHeader title="Recent workouts" />

          {(recent ?? []).length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No completed workouts</Text>
              <Text style={styles.emptyHint}>
                Start a routine above or an empty workout, then tap Finish when done.
              </Text>
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
    gap: spacing.md,
  },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
  emptyHint: { color: colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
