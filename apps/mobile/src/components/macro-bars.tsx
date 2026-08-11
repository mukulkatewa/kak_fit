import { StyleSheet, Text, View } from "react-native";
import { ProgressBar } from "./ui";
import { spacing, typography, useTheme, useThemedStyles, type Palette, type ShadowSet } from "../lib/theme";

export function MacroBars({
  protein,
  carbs,
  fat,
  targets,
}: {
  protein: number;
  carbs: number;
  fat: number;
  targets: { protein: number; carbs: number; fat: number };
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.wrap}>
      <MacroBarRow
        label="P"
        current={protein}
        target={targets.protein}
        color={colors.proteinColor}
      />
      <MacroBarRow
        label="C"
        current={carbs}
        target={targets.carbs}
        color={colors.carbsColor}
      />
      <MacroBarRow
        label="F"
        current={fat}
        target={targets.fat}
        color={colors.fatColor}
      />
    </View>
  );
}

function MacroBarRow({
  label,
  current,
  target,
  color,
}: {
  label: string;
  current: number;
  target: number;
  color: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const pct = target > 0 ? (current / target) * 100 : 0;
  const currentLabel = Math.round(current);
  const targetLabel = Math.round(target);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.bar}>
        <ProgressBar pct={pct} color={color} />
      </View>
      <Text style={styles.meta}>
        {target > 0 ? `${currentLabel}/${targetLabel}g` : `${currentLabel}g`}
      </Text>
    </View>
  );
}

const makeStyles = (colors: Palette, _shadows: ShadowSet) =>
  StyleSheet.create({
    wrap: {
      gap: spacing.sm,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    label: {
      ...typography.caption,
      color: colors.textMuted,
      fontWeight: "700",
      width: 14,
    },
    bar: {
      flex: 1,
    },
    meta: {
      ...typography.caption,
      color: colors.textMuted,
      minWidth: 72,
      textAlign: "right",
    },
  });
