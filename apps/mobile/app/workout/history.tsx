import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HevyStackHeader } from "../../src/components/hevy-ui";
import { ThemedDialog, useToast } from "../../src/components/ui";
import { WorkoutHistoryList } from "../../src/components/workout-history-list";
import {
  flattenFinishedWorkouts,
  useWorkoutHistoryInfinite,
} from "../../src/lib/workout-history-query";
import { trpc } from "../../src/lib/trpc";
import { useUserPreferences } from "../../src/lib/use-preferences";
import { spacing, useTheme, useThemedStyles, type Palette } from "../../src/lib/theme";

export default function WorkoutHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const utils = trpc.useUtils();
  const { showToast } = useToast();
  const { weightUnit } = useUserPreferences();

  const {
    data: historyPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useWorkoutHistoryInfinite();

  const workouts = flattenFinishedWorkouts(historyPages?.pages);

  const [deleteDialog, setDeleteDialog] = useState<{
    visible: boolean;
    workoutId?: string;
    name?: string;
  }>({ visible: false });

  const deleteWorkout = trpc.workout.delete.useMutation({
    onSuccess: () => {
      setDeleteDialog({ visible: false });
      void Promise.all([
        utils.workout.history.invalidate(),
        utils.auth.stats.invalidate(),
        utils.progress.weeklyVolume.invalidate(),
        utils.progress.dashboard.invalidate(),
        utils.progress.volumeHistory.invalidate(),
        utils.progress.muscleDistribution.invalidate(),
      ]);
      showToast("Workout deleted", "success");
    },
    onError: (e) => showToast(e.message, "error"),
  });

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm, backgroundColor: colors.bg }]}>
      <View style={styles.headerPad}>
        <HevyStackHeader title="Workout History" onBack={() => router.back()} />
      </View>

      <WorkoutHistoryList
        workouts={workouts}
        weightUnit={weightUnit}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        onPress={(workout) => router.push(`/workout/${workout.id}`)}
        onLongPress={(workout) =>
          setDeleteDialog({
            visible: true,
            workoutId: workout.id,
            name: workout.name ?? "Workout",
          })
        }
        onEndReached={() => void fetchNextPage()}
        onRefresh={async () => {
          await utils.workout.history.invalidate();
          await refetch();
        }}
      />

      <ThemedDialog
        visible={deleteDialog.visible}
        title="Delete workout?"
        message={
          deleteDialog.name
            ? `Remove "${deleteDialog.name}" from your history? This cannot be undone.`
            : "Remove this workout from your history? This cannot be undone."
        }
        onDismiss={() => setDeleteDialog({ visible: false })}
        buttons={[
          { label: "Cancel" },
          {
            label: deleteWorkout.isPending ? "Deleting…" : "Delete",
            variant: "destructive",
            onPress: () => {
              if (deleteDialog.workoutId) {
                deleteWorkout.mutate({ id: deleteDialog.workoutId });
              }
            },
          },
        ]}
      />
    </View>
  );
}

const makeStyles = (_colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1 },
    headerPad: { paddingHorizontal: spacing.lg },
  });
