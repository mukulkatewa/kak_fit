import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRightIcon } from "react-native-heroicons/outline";
import { TrophyIcon } from "react-native-heroicons/solid";
import Animated, {
  FadeIn,
  FadeInRight,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { MuscleHeatmap } from "../../src/components/muscle-heatmap";
import {
  Header,
  ListGroup,
  ListRow,
  Screen,
  SectionHeader,
  StatBlock,
} from "../../src/components/ui";
import { entranceDown } from "../../src/lib/animations";
import { trpc, queryStaleTime } from "../../src/lib/trpc";
import { formatWeight, tonnageFromKg, weightLabel } from "../../src/lib/units";
import { useUserPreferences } from "../../src/lib/use-preferences";
import { radius, spacing, typography, useTheme, useThemedStyles, type Palette, type ShadowSet } from "../../src/lib/theme";

function AnimatedStatBlock({
  index,
  value,
  label,
}: {
  index: number;
  value: string | number;
  label: string;
}) {
  return (
    <Animated.View
      entering={FadeInUp.delay(index * 100).springify().damping(16)}
      style={{ flex: 1 }}
    >
      <StatBlock value={value} label={label} />
    </Animated.View>
  );
}

function AnimatedBar({
  label,
  value,
  max,
  color,
  unit,
  height,
  index,
  mutedColor,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  unit: string;
  height: number;
  index: number;
  mutedColor: string;
}) {
  const targetHeight = Math.max(4, (value / max) * (height - 24));
  const barHeight = useSharedValue(0);

  useEffect(() => {
    barHeight.value = 0;
    barHeight.value = withTiming(targetHeight, { duration: 600 + index * 80 });
  }, [barHeight, index, targetHeight]);

  const barStyle = useAnimatedStyle(() => ({
    height: barHeight.value,
  }));

  return (
    <View style={{ flex: 1, alignItems: "center", gap: spacing.xs }}>
      <Text style={{ ...typography.label, fontSize: 10, color: mutedColor }} numberOfLines={1}>
        {value}
        {unit}
      </Text>
      <Animated.View
        style={[
          {
            width: "70%",
            borderRadius: 4,
            backgroundColor: color,
          },
          barStyle,
        ]}
      />
      <Text style={{ ...typography.label, fontSize: 11, fontWeight: "500", color: mutedColor }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function AnimatedVolumeChart({
  data,
  color,
  unit,
  height = 140,
  mutedColor,
}: {
  data: Array<{ label: string; value: number }>;
  color: string;
  unit: string;
  height?: number;
  mutedColor: string;
}) {
  if (data.length === 0) {
    return <Text style={{ color: mutedColor, textAlign: "center" }}>No data yet</Text>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View
      style={{
        backgroundColor: "transparent",
        borderRadius: 12,
        padding: spacing.lg,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-end", height, gap: spacing.sm }}>
        {data.map((point, index) => (
          <AnimatedBar
            key={`${point.label}-${index}`}
            label={point.label}
            value={point.value}
            max={max}
            color={color}
            unit={unit}
            height={height}
            index={index}
            mutedColor={mutedColor}
          />
        ))}
      </View>
    </View>
  );
}

function ShimmerPRBadge({ label }: { label: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const shimmer = useSharedValue(0.5);

  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200 }),
        withTiming(0.45, { duration: 1200 }),
      ),
      -1,
      true,
    );
  }, [shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmer.value,
  }));

  return (
    <View style={styles.prBadgeWrap}>
      <Animated.View style={[styles.prBadgeGlow, shimmerStyle]} pointerEvents="none" />
      <View style={styles.prBadge}>
        <TrophyIcon color={colors.gold} size={12} />
        <Text style={styles.prBadgeText}>{label}</Text>
      </View>
    </View>
  );
}

export default function ProgressScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { weightUnit } = useUserPreferences();
  const [refreshing, setRefreshing] = useState(false);
  const params = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);
  const [prsSectionY, setPrsSectionY] = useState(0);

  const {
    data: volume,
    isLoading: volLoading,
    isError: volError,
    refetch: refetchVolume,
  } = trpc.progress.volumeHistory.useQuery(
    { limit: 10 },
    { staleTime: queryStaleTime.progress },
  );
  const {
    data: muscleData,
    isLoading: muscleLoading,
    isError: muscleError,
    refetch: refetchMuscle,
  } = trpc.progress.muscleDistribution.useQuery(
    { days: 30 },
    { staleTime: queryStaleTime.progress },
  );
  const {
    data: topExercises,
    isError: topExError,
    refetch: refetchTopExercises,
  } = trpc.progress.topExercises.useQuery(
    { limit: 6 },
    { staleTime: queryStaleTime.progress },
  );
  const {
    data: prs,
    isError: prsError,
    refetch: refetchPrs,
  } = trpc.personalRecord.list.useQuery(
    { limit: 8 },
    { staleTime: queryStaleTime.progress },
  );
  const {
    data: dashboard,
    isError: dashError,
    refetch: refetchDashboard,
  } = trpc.progress.dashboard.useQuery(undefined, {
    staleTime: queryStaleTime.progressStreak,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchVolume(),
        refetchMuscle(),
        refetchTopExercises(),
        refetchPrs(),
        refetchDashboard(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetchVolume, refetchMuscle, refetchTopExercises, refetchPrs, refetchDashboard]);

  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;

  const scrollToPrs = useCallback(() => {
    if (!scrollViewRef.current || prsSectionY <= 0) return;
    scrollViewRef.current.scrollTo({
      y: Math.max(0, prsSectionY - 20),
      animated: true,
    });
  }, [prsSectionY]);

  useEffect(() => {
    if (tabParam !== "prs") return;
    const timer = setTimeout(scrollToPrs, 100);
    return () => clearTimeout(timer);
  }, [tabParam, prsSectionY, prs, scrollToPrs]);

  const weekVolumeDisplay = dashboard
    ? tonnageFromKg(dashboard.weekVolume, weightUnit) / 1000
    : 0;

  const statItems = dashboard
    ? [
        { value: dashboard.streakWeeks, label: "Week streak" },
        { value: `${weekVolumeDisplay.toFixed(1)}k`, label: `Week vol (${weightLabel(weightUnit)})` },
        { value: dashboard.monthPrs, label: "PRs (month)" },
      ]
    : [];

  return (
    <Screen
      scroll
      variant="tab"
      scrollViewRef={scrollViewRef}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void handleRefresh()}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      }
    >
      <Header title="Progress" subtitle="Charts, PRs, and muscle volume" />

      {dashboard ? (
        <LinearGradient
          colors={[colors.surface, `${colors.accent}22`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statsRow}
        >
          {statItems.map((stat, index) => (
            <AnimatedStatBlock
              key={stat.label}
              index={index}
              value={stat.value}
              label={stat.label}
            />
          ))}
        </LinearGradient>
      ) : dashError ? (
        <Text style={styles.empty}>Couldn't load stats. Pull to refresh.</Text>
      ) : null}

      <SectionHeader title="Volume" />
      {volLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : volError ? (
        <Text style={styles.empty}>Couldn't load volume chart.</Text>
      ) : (
        <Animated.View entering={FadeIn.delay(200).duration(500)}>
          <AnimatedVolumeChart
            data={(volume ?? []).map((v) => ({
              label: v.label,
              value: tonnageFromKg(v.volume, weightUnit),
            }))}
            color={colors.accent}
            unit={weightLabel(weightUnit)}
            mutedColor={colors.textMuted}
          />
        </Animated.View>
      )}

      <SectionHeader title="Muscle Heatmap" />
      <Text style={styles.sectionSub}>
        Last 30 days
        {muscleData?.totalVolume
          ? ` · ${Math.round(tonnageFromKg(muscleData.totalVolume, weightUnit)).toLocaleString()} ${weightLabel(weightUnit)} total`
          : ""}
      </Text>
      {muscleLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : muscleError || !muscleData?.heatmap ? (
        <View style={styles.retryBlock}>
          <Text style={styles.empty}>Couldn't load muscle data.</Text>
          <Pressable onPress={() => void refetchMuscle()} hitSlop={8}>
            <Text style={styles.retry}>Tap to retry</Text>
          </Pressable>
        </View>
      ) : (
        <Animated.View entering={FadeIn.delay(300).duration(500)}>
          <MuscleHeatmap data={muscleData.heatmap} />
        </Animated.View>
      )}

      <SectionHeader title="Top Exercises" />
      {topExError ? (
        <View style={styles.retryBlock}>
          <Text style={styles.empty}>Couldn't load top exercises.</Text>
          <Pressable onPress={() => void refetchTopExercises()} hitSlop={8}>
            <Text style={styles.retry}>Tap to retry</Text>
          </Pressable>
        </View>
      ) : (topExercises ?? []).length === 0 ? (
        <Text style={styles.empty}>No exercises logged yet</Text>
      ) : (
        <ListGroup>
          {topExercises?.map((ex, i) => (
            <Animated.View
              key={ex.id}
              entering={entranceDown(i * 60)}
            >
              <ListRow
                title={ex.name}
                subtitle={`${ex.count} sessions`}
                onPress={() => router.push(`/exercise/${ex.id}`)}
                last={i === (topExercises?.length ?? 0) - 1}
              />
            </Animated.View>
          ))}
        </ListGroup>
      )}

      <View
        onLayout={(e) => {
          setPrsSectionY(e.nativeEvent.layout.y);
        }}
      >
        <SectionHeader title="Recent PRs" />
        <View style={styles.prList}>
          {prsError ? (
            <View style={styles.retryBlock}>
              <Text style={styles.empty}>Couldn't load personal records.</Text>
              <Pressable onPress={() => void refetchPrs()} hitSlop={8}>
                <Text style={styles.retry}>Tap to retry</Text>
              </Pressable>
            </View>
          ) : (prs ?? []).length === 0 ? (
            <Text style={styles.empty}>Hit new PRs by completing workouts.</Text>
          ) : (
            prs?.map((pr, index) => (
              <Animated.View
                key={pr.id}
                entering={FadeInRight.delay(index * 80).springify().damping(16)}
              >
                <Pressable
                  style={styles.prRow}
                  onPress={() => router.push(`/exercise/${pr.exercise.id}`)}
                >
                  <ShimmerPRBadge label={pr.type.replace(/_/g, " ")} />
                  <Text style={styles.prName} numberOfLines={1}>
                    {pr.exercise.name}
                  </Text>
                  <Text style={styles.prVal}>
                    {pr.type === "MAX_REPS"
                      ? `${pr.value} reps`
                      : `${formatWeight(pr.value, weightUnit)} ${weightLabel(weightUnit)}`}
                  </Text>
                </Pressable>
              </Animated.View>
            ))
          )}
        </View>
      </View>

      <Pressable style={styles.measureLink} onPress={() => router.push("/measurements")}>
        <Text style={styles.measureLinkText}>Body Measurements</Text>
        <ArrowRightIcon color={colors.accent} size={18} />
      </Pressable>
    </Screen>
  );
}

const makeStyles = (colors: Palette, shadows: ShadowSet) =>
  StyleSheet.create({
    statsRow: {
      flexDirection: "row",
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      overflow: "hidden",
    },
    prList: { gap: spacing.sm },
    prRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    prBadgeWrap: { position: "relative" },
    prBadgeGlow: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 999,
      backgroundColor: colors.gold,
    },
    prBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      backgroundColor: colors.goldMuted,
      borderRadius: 999,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    prBadgeText: {
      ...typography.label,
      fontSize: 10, // custom: compact PR badge
      fontWeight: "800",
      color: colors.gold,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    prName: { flex: 1, color: colors.text, ...typography.body },
    prVal: { color: colors.gold, ...typography.body, fontWeight: "700" },
    empty: { ...typography.bodySmall, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.lg },
    retryBlock: { alignItems: "center", gap: spacing.xs },
    retry: { ...typography.bodySmall, color: colors.accent, fontWeight: "600" },
    measureLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.lg,
    },
    measureLinkText: { ...typography.button, color: colors.accent },
    sectionSub: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  });
