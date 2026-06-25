import { usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth-context";
import type { ActiveWorkout } from "../lib/active-workout-cache";
import { formatElapsedDuration } from "../lib/format-duration";
import { isMainTabRoot, TAB_BAR_HEIGHT } from "../lib/layout-constants";
import { trpc, queryStaleTime } from "../lib/trpc";
import { useTheme } from "../lib/theme";

function getCurrentExerciseName(workout: ActiveWorkout): string {
  for (const exercise of workout.exercises) {
    if (exercise.sets.some((set) => !set.isCompleted)) {
      return exercise.exercise.name;
    }
  }

  const lastExercise = workout.exercises.at(-1);
  if (lastExercise) return lastExercise.exercise.name;
  return "Active Workout";
}

export function ActiveWorkoutOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const { data: activeWorkout } = trpc.workout.active.useQuery(undefined, {
    staleTime: queryStaleTime.workoutActive,
    refetchInterval: 30_000,
    retry: false,
    enabled: isAuthenticated,
  });

  const discardActive = trpc.workout.discardActive.useMutation({
    onSuccess: () => {
      utils.workout.active.invalidate();
    },
  });

  useEffect(() => {
    if (!activeWorkout) return;

    const startedAt = activeWorkout.startedAt;
    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));

    const id = setInterval(() => {
      const fresh = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      setElapsedSeconds(Math.max(0, fresh));
    }, 1000);

    return () => clearInterval(id);
  }, [activeWorkout?.id, activeWorkout?.startedAt]);

  const exerciseName = useMemo(
    () => (activeWorkout ? getCurrentExerciseName(activeWorkout) : ""),
    [activeWorkout],
  );

  const hiddenRoute =
    !isAuthenticated ||
    !activeWorkout ||
    pathname === "/login" ||
    pathname.startsWith("/workout/active") ||
    !isMainTabRoot(pathname);

  if (hiddenRoute) return null;

  const bottom = insets.bottom + TAB_BAR_HEIGHT + 8;

  const confirmDiscard = () => {
    Alert.alert(
      "Discard Workout?",
      "This will permanently delete your current workout.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => discardActive.mutate(),
        },
      ],
    );
  };

  return (
    <View
      style={[
        styles.pill,
        {
          bottom,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Pressable
        onPress={() => router.push("/workout/active")}
        style={[styles.circleBtn, { backgroundColor: colors.bgElevated }]}
        hitSlop={4}
      >
        <Ionicons name="chevron-up" size={22} color={colors.text} />
      </Pressable>

      <Pressable onPress={() => router.push("/workout/active")} style={styles.centerBlock}>
        <View style={styles.titleRow}>
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
          <Text style={[styles.line1, { color: colors.text }]} numberOfLines={1}>
            Workout {formatElapsedDuration(elapsedSeconds)}
          </Text>
        </View>
        <Text style={[styles.line2, { color: colors.textMuted }]} numberOfLines={1}>
          {exerciseName}
        </Text>
      </Pressable>

      <Pressable
        onPress={confirmDiscard}
        disabled={discardActive.isPending}
        style={[styles.circleBtn, { backgroundColor: colors.bgElevated }]}
        hitSlop={4}
      >
        {discardActive.isPending ? (
          <ActivityIndicator size="small" color={colors.danger} />
        ) : (
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 64,
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 999,
  },
  circleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  centerBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  line1: {
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1,
  },
  line2: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: "100%",
  },
});
