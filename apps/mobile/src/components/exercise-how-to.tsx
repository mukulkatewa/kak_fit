import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { parseExerciseInstructions } from "../lib/exercise-instructions";
import { radius, spacing, typography, useTheme, useThemedStyles, type Palette } from "../lib/theme";

type ExerciseHowToProps = {
  exerciseName: string;
  instructions: string | null | undefined;
  compact?: boolean;
};

export function ExerciseHowTo({ exerciseName, instructions, compact = false }: ExerciseHowToProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const parsed = parseExerciseInstructions(instructions);

  if (!parsed) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="document-text-outline" size={32} color={colors.textDim} />
        <Text style={styles.emptyTitle}>No instructions yet</Text>
        <Text style={styles.emptyText}>Instructions for this exercise will appear here when available.</Text>
      </View>
    );
  }

  const visibleSteps = compact
    ? [...(parsed.startingPosition ? [parsed.startingPosition] : []), ...parsed.steps].slice(0, 3)
    : [...(parsed.startingPosition ? [parsed.startingPosition] : []), ...parsed.steps];
  const totalSteps = (parsed.startingPosition ? 1 : 0) + parsed.steps.length;

  return (
    <Animated.View entering={FadeInDown.duration(260)} style={styles.wrap}>
      {!compact ? <Text style={styles.pageTitle}>{exerciseName}</Text> : null}

      <View style={styles.stepsList}>
        {visibleSteps.map((step, index) => (
          <View key={`${index}-${step.slice(0, 24)}`} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{index + 1}.</Text>
            <Text style={[styles.stepText, compact && styles.stepTextCompact]}>{step}</Text>
          </View>
        ))}
      </View>

      {compact && totalSteps > 3 ? (
        <Text style={styles.moreHint}>+{totalSteps - 3} more steps</Text>
      ) : null}

      {parsed.tips && !compact ? (
        <View style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Ionicons name="bulb-outline" size={18} color={colors.accent} />
            <Text style={styles.tipsTitle}>Tips</Text>
          </View>
          <Text style={styles.tipsText}>{parsed.tips}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
      gap: spacing.lg,
    },
    pageTitle: {
      ...typography.h1,
      color: colors.text,
      lineHeight: 36,
    },
    stepsList: { gap: spacing.xl },
    stepRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    stepNumber: {
      ...typography.body,
      color: colors.text,
      fontWeight: "800",
      minWidth: 24,
      lineHeight: 24,
    },
    stepText: {
      flex: 1,
      ...typography.body,
      color: colors.text,
      lineHeight: 24,
    },
    stepTextCompact: {
      color: colors.textMuted,
    },
    moreHint: {
      ...typography.caption,
      color: colors.accent,
      fontWeight: "600",
    },
    tipsCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    tipsHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    tipsTitle: { ...typography.h3, color: colors.text },
    tipsText: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 22 },
    emptyWrap: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxxl,
      alignItems: "center",
      gap: spacing.sm,
    },
    emptyTitle: { ...typography.h3, color: colors.text, textAlign: "center" },
    emptyText: { ...typography.bodySmall, color: colors.textMuted, textAlign: "center", lineHeight: 22 },
  });
