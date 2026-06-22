import { Animated, Easing, StyleSheet, View, type ViewStyle } from "react-native";
import { useEffect, useRef } from "react";
import { radius, spacing, useThemedStyles, type Palette } from "../lib/theme";

function ShimmerBox({ style }: { style: ViewStyle }) {
  const styles = useThemedStyles(makeStyles);
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.75,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.box, style, { opacity }]} />;
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
