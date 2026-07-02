import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { HevySegmentedControl, HevyStackHeader } from "../src/components/hevy-ui";
import { Screen } from "../src/components/ui";
import { calculatePlates, generateWarmupSets } from "../src/lib/calculators";
import { useUserPreferences } from "../src/lib/use-preferences";
import { formatWeight, fromKg, toKg, weightLabel } from "../src/lib/units";
import { radius, spacing, typography, useTheme, useThemedStyles, type Palette } from "../src/lib/theme";

type Tab = "plates" | "warmup";

export default function ToolsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { weightUnit } = useUserPreferences();
  const [tab, setTab] = useState<Tab>("plates");
  const [targetInput, setTargetInput] = useState("100");
  const [barInput, setBarInput] = useState("20");

  const targetKg = useMemo(() => {
    const n = Number(targetInput);
    return Number.isFinite(n) && n > 0 ? toKg(n, weightUnit) : 0;
  }, [targetInput, weightUnit]);

  const barKg = useMemo(() => {
    const n = Number(barInput);
    return Number.isFinite(n) && n > 0 ? toKg(n, weightUnit) : 20;
  }, [barInput, weightUnit]);

  const plates = useMemo(
    () => (targetKg > 0 ? calculatePlates(targetKg, barKg) : null),
    [targetKg, barKg],
  );
  const warmups = useMemo(() => generateWarmupSets(targetKg, barKg), [targetKg, barKg]);
  const unit = weightLabel(weightUnit);

  const nudge = (field: "target" | "bar", delta: number) => {
    const cur = field === "target" ? targetInput : barInput;
    const n = Math.max(0, (Number(cur) || 0) + delta);
    if (field === "target") setTargetInput(String(n));
    else setBarInput(String(n));
  };

  return (
    <Screen scroll>
      <HevyStackHeader title="Gym Tools" onBack={() => router.back()} />

      <HevySegmentedControl
        options={[
          { key: "plates" as const, label: "Plate calc" },
          { key: "warmup" as const, label: "Warm-up" },
        ]}
        value={tab}
        onChange={setTab}
      />

      <View style={styles.inputCard}>
        <NumRow
          label={`Target (${unit})`}
          value={targetInput}
          onDec={() => nudge("target", weightUnit === "LBS" ? -5 : -2.5)}
          onInc={() => nudge("target", weightUnit === "LBS" ? 5 : 2.5)}
        />
        <NumRow
          label={`Bar (${unit})`}
          value={barInput}
          onDec={() => nudge("bar", weightUnit === "LBS" ? -5 : -2.5)}
          onInc={() => nudge("bar", weightUnit === "LBS" ? 5 : 2.5)}
        />
      </View>

      {tab === "plates" ? (
        <View style={styles.resultCard}>
          {!plates ? (
            <Text style={styles.muted}>Enter a target above the bar weight.</Text>
          ) : (
            <>
              <Text style={styles.resultTitle}>
                {formatWeight(plates.totalWeight, weightUnit)} {unit} total
              </Text>
              <Text style={styles.muted}>Per side — load from the rack outward:</Text>
              <View style={styles.plateRow}>
                {plates.perSide.length === 0 ? (
                  <Text style={styles.plateChip}>Bar only</Text>
                ) : (
                  plates.perSide.map((p, i) => (
                    <Text key={`${p}-${i}`} style={styles.plateChip}>
                      {formatWeight(p, weightUnit)} {unit}
                    </Text>
                  ))
                )}
              </View>
              {Math.abs(plates.totalWeight - targetKg) > 0.01 ? (
                <Text style={styles.warn}>
                  Closest load: {formatWeight(plates.totalWeight, weightUnit)} {unit} (target{" "}
                  {formatWeight(targetKg, weightUnit)})
                </Text>
              ) : null}
            </>
          )}
        </View>
      ) : (
        <View style={styles.resultCard}>
          {warmups.length === 0 ? (
            <Text style={styles.muted}>Enter a working weight to generate warm-up sets.</Text>
          ) : (
            warmups.map((s, i) => (
              <View key={i} style={styles.warmupRow}>
                <Text style={styles.warmupLabel}>{s.label}</Text>
                <Text style={styles.warmupVal}>
                  {formatWeight(s.weight, weightUnit)} {unit}
                  {s.reps > 0 ? ` × ${s.reps}` : " (working)"}
                </Text>
              </View>
            ))
          )}
        </View>
      )}
    </Screen>
  );
}

function NumRow({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.numRow}>
      <Text style={styles.numLabel}>{label}</Text>
      <View style={styles.numControls}>
        <Pressable onPress={onDec} style={styles.stepBtn} hitSlop={8}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.numValue}>{value}</Text>
        <Pressable onPress={onInc} style={styles.stepBtn} hitSlop={8}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    inputCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    numRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    numLabel: { ...typography.body, fontWeight: "600", color: colors.text },
    numControls: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    stepBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceHover,
      alignItems: "center",
      justifyContent: "center",
    },
    stepText: { ...typography.h2, color: colors.text },
    numValue: {
      fontSize: 22, // Calculator result emphasis
      fontWeight: "800",
      color: colors.text,
      minWidth: 56,
      textAlign: "center",
    },
    resultCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    resultTitle: { ...typography.h2, color: colors.text },
    muted: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 20 },
    plateRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
    plateChip: {
      backgroundColor: colors.accentMuted,
      color: colors.accent,
      ...typography.bodySmall,
      fontWeight: "700",
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      overflow: "hidden",
    },
    warn: { ...typography.caption, color: colors.gold, marginTop: spacing.sm },
    warmupRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    warmupLabel: { ...typography.body, fontWeight: "600", color: colors.textMuted },
    warmupVal: { ...typography.body, fontWeight: "700", color: colors.text },
  });
