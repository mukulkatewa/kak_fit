import { usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth-context";
import {
  patchSetInWorkout,
  type ActiveWorkout,
} from "../lib/active-workout-cache";
import {
  enqueueWorkoutMutation,
  isNetworkError,
} from "../lib/offline-workouts";
import { formatRestTime, useRestTimer } from "../lib/rest-timer";
import { trpc } from "../lib/trpc";
import { useTheme } from "../lib/theme";
import { isMainTabRoot, TAB_BAR_HEIGHT } from "../lib/layout-constants";

function findSet(workout: ActiveWorkout, setId: string) {
  for (const exercise of workout.exercises) {
    const set = exercise.sets.find((candidate) => candidate.id === setId);
    if (set) return set;
  }
  return null;
}

function getSetProgress(workout: ActiveWorkout) {
  for (const ex of workout.exercises) {
    const next = ex.sets.find((set) => !set.isCompleted);
    if (next) {
      const setIndex = ex.sets.findIndex((s) => s.id === next.id) + 1;
      return {
        exerciseName: ex.exercise.name,
        setIndex,
        totalSets: ex.sets.length,
        currentSetId: next.id,
        canComplete: true,
      };
    }
  }

  const lastEx = workout.exercises.at(-1);
  if (!lastEx || lastEx.sets.length === 0) return null;

  const lastSet = lastEx.sets.at(-1)!;
  return {
    exerciseName: lastEx.exercise.name,
    setIndex: lastEx.sets.length,
    totalSets: lastEx.sets.length,
    currentSetId: lastSet.id,
    canComplete: !lastSet.isCompleted,
  };
}

function PulsingDot({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: color, opacity }]}
    />
  );
}

export function ActiveWorkoutOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();

  const isRunning = useRestTimer((s) => s.isRunning);
  const secondsLeft = useRestTimer((s) => s.secondsLeft);
  const tick = useRestTimer((s) => s.tick);
  const startRest = useRestTimer((s) => s.start);

  const { data: activeWorkout } = trpc.workout.active.useQuery(undefined, {
    refetchInterval: (query) => (query.state.data ? 5000 : 30000),
    retry: false,
    enabled: isAuthenticated,
  });

  const updateSet = trpc.workout.updateSet.useMutation({
    onSuccess: (updatedSet) => {
      utils.workout.active.setData(undefined, (current) => {
        if (!current) return current;
        return patchSetInWorkout(current, updatedSet);
      });
    },
    onError: async (e, variables) => {
      if (isNetworkError(e)) {
        await enqueueWorkoutMutation("updateSet", variables);
        return;
      }
    },
  });

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isRunning, tick]);

  const progress = useMemo(
    () => (activeWorkout ? getSetProgress(activeWorkout) : null),
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

  const title = isRunning
    ? "Rest"
    : progress?.exerciseName ?? activeWorkout.name ?? "Active Workout";

  const subtitle = isRunning
    ? formatRestTime(secondsLeft)
    : progress
      ? `Set ${progress.setIndex} of ${progress.totalSets}`
      : `${activeWorkout.exercises.length} exercises`;

  const handleComplete = () => {
    if (!progress?.canComplete || isRunning || updateSet.isPending) return;
    const currentSet = findSet(activeWorkout, progress.currentSetId);
    startRest();
    updateSet.mutate({
      setId: progress.currentSetId,
      isCompleted: true,
      ...(currentSet?.weight != null ? { weight: currentSet.weight } : {}),
      ...(currentSet?.reps != null ? { reps: currentSet.reps } : {}),
    });
  };

  return (
    <View
      style={[
        styles.pill,
        {
          bottom,
          backgroundColor: isDark ? colors.surface : colors.accent,
          borderColor: isDark ? colors.accent : "transparent",
          borderWidth: isDark ? 1 : 0,
        },
      ]}
    >
      <Pressable onPress={() => router.push("/workout/active")} style={styles.mainTap}>
        <PulsingDot color={isDark ? colors.accent : colors.onAccent} />

        <View style={styles.textArea}>
          <Text
            style={[styles.title, { color: isDark ? colors.text : colors.onAccent }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.sub,
              { color: isDark ? colors.textMuted : colors.onAccentMuted },
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>

        {!progress?.canComplete || isRunning ? (
          <Ionicons
            name="chevron-up"
            size={20}
            color={isDark ? colors.textMuted : colors.onAccentMuted}
          />
        ) : (
          <View style={styles.checkSpacer} />
        )}
      </Pressable>

      {progress?.canComplete && !isRunning ? (
        <Pressable
          hitSlop={8}
          onPress={handleComplete}
          disabled={updateSet.isPending}
          style={[
            styles.checkBtn,
            {
              backgroundColor: isDark ? colors.accentMuted : "rgba(255,255,255,0.22)",
            },
          ]}
        >
          <Ionicons
            name="checkmark"
            size={22}
            color={isDark ? colors.accent : colors.onAccent}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 999,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  textArea: { flex: 1, marginHorizontal: 4 },
  mainTap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 4,
  },
  checkSpacer: { width: 20 },
  title: { fontSize: 14, fontWeight: "600" },
  sub: { fontSize: 12, marginTop: 1 },
  checkBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
