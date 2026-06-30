import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { usePulse } from "../lib/animations";
import { radius, spacing, useTheme, useThemedStyles, type Palette } from "../lib/theme";

function ShimmerBox({ style }: { style: ViewStyle }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const pulseStyle = usePulse();
  const sweep = useSharedValue(-1);

  useEffect(() => {
    sweep.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400 }),
        withTiming(-1, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, [sweep]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value * 120 }],
  }));

  return (
    <Animated.View style={[styles.box, style, pulseStyle, { overflow: "hidden" }]}>
      <Animated.View style={[StyleSheet.absoluteFillObject, sweepStyle]}>
        <LinearGradient
          colors={["transparent", `${colors.textDim}33`, "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </Animated.View>
  );
}

/** Generic shimmer placeholder for avatars, thumbnails, etc. */
export function Skeleton({
  width,
  height,
  style,
}: {
  width: number;
  height: number;
  style?: ViewStyle;
}) {
  return (
    <ShimmerBox
      style={{
        width,
        height,
        borderRadius: radius.sm,
        ...(StyleSheet.flatten(style) ?? {}),
      }}
    />
  );
}

/** Simple placeholder card — gray rounded rectangle, no animation. */
export function SkeletonCards({
  count = 3,
  height = 72,
}: {
  count?: number;
  height?: number;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.skeletonStack}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.skeletonCard, { height }]} />
      ))}
    </View>
  );
}

/** Hevy-style feed row skeleton (avatar + text lines) */
export function FeedSkeleton({ rows = 3 }: { rows?: number }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.feed}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.feedRow}>
          <ShimmerBox style={styles.avatar} />
          <View style={styles.lines}>
            <ShimmerBox style={styles.lineShort} />
            <ShimmerBox style={styles.lineLong} />
            <ShimmerBox style={styles.lineMed} />
            <ShimmerBox style={styles.lineLong} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function CardSkeleton() {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.card}>
      <ShimmerBox style={styles.chartArea} />
    </View>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }).map((_, i) => (
        <ShimmerBox key={i} style={styles.listRow} />
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  box: { backgroundColor: colors.surfaceHover, borderRadius: radius.sm },
  skeletonStack: { gap: spacing.md },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    opacity: 0.5,
  },
  feed: { gap: spacing.xl, paddingVertical: spacing.md },
  feedRow: { flexDirection: "row", gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  lines: { flex: 1, gap: spacing.sm },
  lineShort: { height: 12, width: "35%", borderRadius: 6 },
  lineLong: { height: 12, width: "92%", borderRadius: 6 },
  lineMed: { height: 12, width: "70%", borderRadius: 6 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 160,
  },
  chartArea: { flex: 1, minHeight: 120, borderRadius: radius.md },
  list: { gap: spacing.sm },
  listRow: { height: 56, borderRadius: radius.lg },
});
