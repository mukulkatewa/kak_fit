import { StyleSheet, Text, View } from "react-native";
import { MUSCLE_ZONES, zoneIntensity, type BodyView } from "../lib/muscle-map";
import { radius, spacing, useThemedStyles, type Palette } from "../lib/theme";

type HeatmapPoint = { muscle: string; volume: number; intensity: number };

function BodySilhouette({
  view,
  heatmap,
}: {
  view: BodyView;
  heatmap: HeatmapPoint[];
}) {
  const styles = useThemedStyles(makeStyles);
  const zones = MUSCLE_ZONES.filter((z) => z.view === view);

  return (
    <View style={styles.bodyWrap}>
      <View style={styles.silhouette}>
        <View style={styles.head} />
        <View style={styles.torso} />
        <View style={styles.legL} />
        <View style={styles.legR} />
        <View style={styles.armL} />
        <View style={styles.armR} />

        {zones.map((zone) => {
          const intensity = zoneIntensity(zone, heatmap);
          if (intensity <= 0) return null;
          return (
            <View
              key={zone.id}
              style={[
                styles.zone,
                {
                  top: `${zone.top}%`,
                  left: `${zone.left}%`,
                  width: `${zone.width}%`,
                  height: `${zone.height}%`,
                  opacity: 0.35 + intensity * 0.55,
                },
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.viewLabel}>{view === "front" ? "Front" : "Back"}</Text>
    </View>
  );
}

export function MuscleHeatmap({ data }: { data: HeatmapPoint[] }) {
  const styles = useThemedStyles(makeStyles);
  if (data.length === 0) {
    return <Text style={styles.empty}>Train more to see your muscle heatmap.</Text>;
  }

  return (
    <View style={styles.card}>
      <View style={styles.bodies}>
        <BodySilhouette view="front" heatmap={data} />
        <BodySilhouette view="back" heatmap={data} />
      </View>

      <View style={styles.legend}>
        <View style={styles.legendBar}>
          <View style={[styles.legendSwatch, { opacity: 0.2 }]} />
          <View style={[styles.legendSwatch, { opacity: 0.5 }]} />
          <View style={[styles.legendSwatch, { opacity: 0.85 }]} />
        </View>
        <Text style={styles.legendText}>Low → High volume</Text>
      </View>

      <View style={styles.topMuscles}>
        {data.slice(0, 4).map((m) => (
          <View key={m.muscle} style={styles.topRow}>
            <Text style={styles.topName} numberOfLines={1}>
              {m.muscle}
            </Text>
            <Text style={styles.topVol}>{m.volume} kg</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  bodies: { flexDirection: "row", justifyContent: "space-around", gap: spacing.md },
  bodyWrap: { alignItems: "center", gap: spacing.sm },
  silhouette: {
    width: 120,
    height: 200,
    position: "relative",
    backgroundColor: colors.surfaceHover,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  head: {
    position: "absolute",
    top: "4%",
    left: "35%",
    width: "30%",
    height: "10%",
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  torso: {
    position: "absolute",
    top: "14%",
    left: "28%",
    width: "44%",
    height: "34%",
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  armL: {
    position: "absolute",
    top: "16%",
    left: "10%",
    width: "14%",
    height: "28%",
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  armR: {
    position: "absolute",
    top: "16%",
    left: "76%",
    width: "14%",
    height: "28%",
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  legL: {
    position: "absolute",
    top: "48%",
    left: "30%",
    width: "16%",
    height: "46%",
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  legR: {
    position: "absolute",
    top: "48%",
    left: "54%",
    width: "16%",
    height: "46%",
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  zone: {
    position: "absolute",
    backgroundColor: colors.accent,
    borderRadius: 6,
  },
  viewLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  legend: { alignItems: "center", gap: 6 },
  legendBar: { flexDirection: "row", gap: 4 },
  legendSwatch: {
    width: 40,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  legendText: { fontSize: 11, color: colors.textDim },
  topMuscles: { gap: spacing.sm },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topName: { flex: 1, color: colors.text, fontSize: 14 },
  topVol: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  empty: { fontSize: 14, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.xl },
});
