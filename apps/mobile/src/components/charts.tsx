import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../lib/theme";

type ChartPoint = { label: string; value: number };

export function BarChart({
  data,
  color = colors.accent,
  height = 140,
  unit = "",
}: {
  data: ChartPoint[];
  color?: string;
  height?: number;
  unit?: string;
}) {
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
              <View style={[styles.bar, { height: barH, backgroundColor: color }]} />
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

export function MuscleBars({
  data,
}: {
  data: Array<{ muscle: string; volume: number; pct: number }>;
}) {
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

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barValue: { fontSize: 10, color: colors.textMuted, fontWeight: "600" },
  bar: { width: "80%", borderRadius: 4, minHeight: 4 },
  barLabel: { fontSize: 9, color: colors.textDim, textAlign: "center" },
  empty: { fontSize: 14, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.xl },
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
