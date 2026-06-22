import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { radius, spacing, useTheme, useThemedStyles, type Palette } from "../lib/theme";

type ChartPoint = { label: string; value: number };

export function BarChart({
  data,
  color,
  height = 140,
  unit = "",
}: {
  data: ChartPoint[];
  color?: string;
  height?: number;
  unit?: string;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const barColor = color ?? colors.accent;

  if (data.length === 0) {
    return <Text style={styles.empty}>No data yet — complete workouts to see charts.</Text>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={styles.wrap}>
      <View style={[styles.bars, { height }]}>
        {data.map((point, i) => {
          const barH = Math.max(4, (point.value / max) * (height - 24));
          return (
            <View key={`${point.label}-${i}`} style={styles.barCol}>
              <Text style={styles.barValue} numberOfLines={1}>
                {point.value}
                {unit}
              </Text>
              <View style={[styles.bar, { height: barH, backgroundColor: barColor }]} />
              <Text style={styles.barLabel} numberOfLines={1}>
                {point.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Pure-View line chart (no SVG). Renders dots connected by rotated segments,
 * with faint vertical gridlines below each point — used on the green hero card.
 */
export function LineChart({
  data,
  height = 150,
  lineColor,
  dotColor,
  gridColor,
}: {
  data: ChartPoint[];
  height?: number;
  lineColor?: string;
  dotColor?: string;
  gridColor?: string;
}) {
  const { colors } = useTheme();
  const resolvedLine = lineColor ?? colors.onAccent;
  const resolvedDot = dotColor ?? colors.onAccent;
  const resolvedGrid = gridColor ?? colors.onAccentFaint;
  const [width, setWidth] = useState(0);

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const padY = 18;
  const innerH = Math.max(height - padY * 2, 1);
  const dot = 9;
  const line = 3;

  const points = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * width : width / 2;
    const y = padY + (1 - (d.value - min) / range) * innerH;
    return { x, y };
  });

  return (
    <View
      style={{ height, width: "100%" }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 &&
        points.map((p, i) => {
          const next = points[i + 1];
          const segment = next
            ? (() => {
                const dx = next.x - p.x;
                const dy = next.y - p.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                return (
                  <View
                    key={`seg-${i}`}
                    style={{
                      position: "absolute",
                      left: (p.x + next.x) / 2 - len / 2,
                      top: (p.y + next.y) / 2 - line / 2,
                      width: len,
                      height: line,
                      borderRadius: line,
                      backgroundColor: resolvedLine,
                      transform: [{ rotate: `${angle}deg` }],
                    }}
                  />
                );
              })()
            : null;

          return (
            <View key={`pt-${i}`}>
              {/* faint vertical gridline under the point */}
              <View
                style={{
                  position: "absolute",
                  left: p.x - 0.5,
                  top: p.y,
                  width: 1,
                  height: Math.max(height - p.y - 4, 0),
                  backgroundColor: resolvedGrid,
                }}
              />
              {segment}
              {/* dot */}
              <View
                style={{
                  position: "absolute",
                  left: p.x - dot / 2,
                  top: p.y - dot / 2,
                  width: dot,
                  height: dot,
                  borderRadius: dot / 2,
                  backgroundColor: resolvedDot,
                }}
              />
            </View>
          );
        })}
    </View>
  );
}

/**
 * Segmented circular progress ring (no SVG). A radial run of ticks, the first
 * `progress` fraction tinted — reads as a smooth arc, robust on iOS/Android/web.
 */
export function ProgressRing({
  size = 120,
  progress,
  color,
  track,
  ticks = 48,
  tickWidth = 3,
  tickLength = 12,
  inset = 3,
  children,
}: {
  size?: number;
  progress: number;
  color?: string;
  track?: string;
  ticks?: number;
  tickWidth?: number;
  tickLength?: number;
  inset?: number;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const fillColor = color ?? colors.accent;
  const trackColor = track ?? colors.surfaceHover;
  const pct = Math.min(Math.max(progress, 0), 1);
  const filled = Math.round(pct * ticks);
  const reach = size / 2 - tickLength / 2 - inset;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {Array.from({ length: ticks }).map((_, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: size / 2 - tickWidth / 2,
            top: size / 2 - tickLength / 2,
            width: tickWidth,
            height: tickLength,
            borderRadius: tickWidth,
            backgroundColor: i < filled ? fillColor : trackColor,
            transform: [{ rotate: `${(i / ticks) * 360}deg` }, { translateY: -reach }],
          }}
        />
      ))}
      <View style={styles.ringCenter}>{children}</View>
    </View>
  );
}

export function MuscleBars({
  data,
}: {
  data: Array<{ muscle: string; volume: number; pct: number }>;
}) {
  const styles = useThemedStyles(makeStyles);
  if (data.length === 0) {
    return <Text style={styles.empty}>Train more to see muscle distribution.</Text>;
  }

  return (
    <View style={styles.muscleList}>
      {data.map((m) => (
        <View key={m.muscle} style={styles.muscleRow}>
          <Text style={styles.muscleName} numberOfLines={1}>
            {m.muscle}
          </Text>
          <View style={styles.muscleTrack}>
            <View style={[styles.muscleFill, { width: `${m.pct}%` }]} />
          </View>
          <Text style={styles.muscleVol}>{m.volume} kg</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barValue: { fontSize: 10, color: colors.textMuted, fontWeight: "600" },
  bar: { width: "80%", borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 9, color: colors.textDim, textAlign: "center" },
  empty: { fontSize: 14, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.xl },
  ringCenter: { alignItems: "center", justifyContent: "center" },
  muscleList: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  muscleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  muscleName: { width: 80, fontSize: 13, color: colors.text },
  muscleTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  muscleFill: { height: "100%", backgroundColor: colors.accent, borderRadius: radius.full },
  muscleVol: { width: 52, fontSize: 12, color: colors.textMuted, textAlign: "right" },
});
