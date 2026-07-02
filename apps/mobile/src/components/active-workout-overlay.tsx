import { usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ChevronUpIcon, TrashIcon } from "react-native-heroicons/outline";
import Animated, {
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedDialog } from "./ui";
import { useAuth } from "../lib/auth-context";
import type { ActiveWorkout } from "../lib/active-workout-cache";
import { formatElapsedDuration } from "../lib/format-duration";
import { isMainTabRoot, TAB_BAR_HEIGHT, ACTIVE_WORKOUT_PILL_HEIGHT } from "../lib/layout-constants";
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

function PulsingDot({ color }: { color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.3, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      true,
    );
  }, [opacity, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: color }, style]}
    />
  );
}

function ElapsedTimeText({
  elapsedSeconds,
  color,
}: {
  elapsedSeconds: number;
  color: string;
}) {
  const opacity = useSharedValue(1);
  const label = `Workout ${formatElapsedDuration(elapsedSeconds)}`;

  useEffect(() => {
    opacity.value = 0.45;
    opacity.value = withTiming(1, { duration: 280 });
  }, [elapsedSeconds, opacity]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[styles.line1, { color }, textStyle]} numberOfLines={1}>
      {label}
    </Animated.Text>
  );
}

export function ActiveWorkoutOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);
  const borderGlow = useSharedValue(0.35);

  const { data: activeWorkout } = trpc.workout.active.useQuery(undefined, {
    staleTime: queryStaleTime.workoutActive,
    refetchInterval: 60_000,
    retry: false,
    enabled: isAuthenticated,
  });

  const discardActive = trpc.workout.discardActive.useMutation({
    onSuccess: () => {
      setDiscardOpen(false);
      setDiscardError(null);
      utils.workout.active.invalidate();
    },
    onError: (e) => {
      setDiscardError(e.message);
      setDiscardOpen(true);
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

  useEffect(() => {
    borderGlow.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 1400 }),
        withTiming(0.35, { duration: 1400 }),
      ),
      -1,
      true,
    );
  }, [borderGlow]);

  const exerciseName = useMemo(
    () => (activeWorkout ? getCurrentExerciseName(activeWorkout) : ""),
    [activeWorkout],
  );

  const glowStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(61, 181, 74, ${borderGlow.value})`,
  }));

  const hiddenRoute =
    !isAuthenticated ||
    !activeWorkout ||
    pathname === "/login" ||
    pathname.startsWith("/workout/active") ||
    !isMainTabRoot(pathname);

  if (hiddenRoute) return null;

  const bottom = insets.bottom + TAB_BAR_HEIGHT + 8;

  return (
    <>
      <Animated.View
        entering={SlideInDown.springify().damping(16)}
        style={[
          styles.pill,
          glowStyle,
          {
            bottom,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <Pressable
          onPress={() => router.push("/workout/active")}
          style={[styles.circleBtn, { backgroundColor: colors.bgElevated }]}
          hitSlop={4}
        >
          <ChevronUpIcon color={colors.text} size={22} />
        </Pressable>

        <Pressable onPress={() => router.push("/workout/active")} style={styles.centerBlock}>
          <View style={styles.titleRow}>
            <PulsingDot color={colors.success} />
            <ElapsedTimeText elapsedSeconds={elapsedSeconds} color={colors.text} />
          </View>
          <Text style={[styles.line2, { color: colors.textMuted }]} numberOfLines={1}>
            {exerciseName}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setDiscardError(null);
            setDiscardOpen(true);
          }}
          disabled={discardActive.isPending}
          style={[styles.circleBtn, { backgroundColor: colors.bgElevated }]}
          hitSlop={4}
        >
          {discardActive.isPending ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <TrashIcon color={colors.danger} size={20} />
          )}
        </Pressable>
      </Animated.View>

      <ThemedDialog
        visible={discardOpen}
        title="Discard workout?"
        message={
          discardError
            ? `${discardError}\n\nThis will permanently delete your current workout.`
            : "This will permanently delete your current workout."
        }
        onDismiss={() => {
          setDiscardOpen(false);
          setDiscardError(null);
        }}
        buttons={[
          { label: "Cancel" },
          {
            label: discardActive.isPending ? "Discarding…" : "Discard",
            variant: "destructive",
            onPress: () => discardActive.mutate(),
          },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    left: 16,
    right: 16,
    height: ACTIVE_WORKOUT_PILL_HEIGHT,
    borderRadius: 28,
    borderWidth: 2,
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
