import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  exerciseSummary,
  formatRoutineExerciseDetail,
  type RoutineListItem,
} from "../lib/routine-display";
import { spacing, shadows, useTheme, useThemedStyles, type Palette } from "../lib/theme";
import { ExerciseAvatar } from "./exercise-avatar";

type RoutineExpandableRowProps = {
  routine: RoutineListItem;
  expanded: boolean;
  onToggleExpand: () => void;
  onStart: () => void;
  disabled?: boolean;
  loading?: boolean;
  last?: boolean;
};

export function RoutineExpandableRow({
  routine,
  expanded,
  onToggleExpand,
  onStart,
  disabled,
  loading,
  last,
}: RoutineExpandableRowProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={!last ? styles.itemBorder : undefined}>
      <View style={styles.row}>
        <Pressable
          disabled={disabled}
          onPress={onStart}
          style={({ pressed }) => [
            styles.mainTap,
            pressed && !disabled && styles.mainTapPressed,
            disabled && styles.disabled,
          ]}
        >
          <View style={styles.icon}>
            <Ionicons name="barbell-outline" size={18} color={colors.textMuted} />
          </View>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>
              {routine.name}
            </Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {exerciseSummary(routine.exercises)}
            </Text>
          </View>
        </Pressable>
        <Pressable
          hitSlop={8}
          disabled={loading}
          onPress={(event) => {
            event.stopPropagation();
            onToggleExpand();
          }}
          style={styles.chevronBtn}
          accessibilityLabel={expanded ? "Collapse exercises" : "Expand exercises"}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons
              name={expanded ? "chevron-down" : "chevron-forward"}
              size={16}
              color={colors.textDim}
            />
          )}
        </Pressable>
      </View>
      {expanded ? (
        <View style={styles.expanded}>
          {routine.exercises.map((exercise) => (
            <View key={exercise.id} style={styles.expandedExRow}>
              <ExerciseAvatar
                name={exercise.exercise.name}
                imageUrl={exercise.exercise.imageUrl ?? null}
                size={28}
              />
              <Text style={styles.expandedLine} numberOfLines={2}>
                {formatRoutineExerciseDetail(exercise)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    itemBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 56,
      paddingLeft: spacing.md,
    },
    mainTap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingRight: spacing.sm,
    },
    mainTapPressed: { opacity: 0.7 },
    disabled: { opacity: 0.6 },
    icon: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.surfaceHover,
      alignItems: "center",
      justifyContent: "center",
    },
    body: { flex: 1, gap: 2 },
    title: { fontSize: 17, color: colors.text, fontWeight: "400" },
    subtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    chevronBtn: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    expanded: {
      paddingLeft: spacing.md,
      paddingRight: spacing.md,
      paddingBottom: spacing.md,
      gap: 6,
    },
    expandedExRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    expandedLine: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  });

type RoutineExpandableCardProps = {
  routine: RoutineListItem;
  expanded: boolean;
  onToggleExpand: () => void;
  onStart: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function RoutineExpandableCard({
  routine,
  expanded,
  onToggleExpand,
  onStart,
  disabled,
  loading,
}: RoutineExpandableCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeCardStyles);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Pressable
          disabled={disabled}
          onPress={onStart}
          style={({ pressed }) => [
            styles.mainTap,
            pressed && !disabled && styles.pressed,
            disabled && styles.disabled,
          ]}
        >
          <View style={styles.icon}>
            <Ionicons name="barbell" size={20} color={colors.textMuted} />
          </View>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>
              {routine.name}
            </Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {exerciseSummary(routine.exercises)}
            </Text>
          </View>
        </Pressable>
        <Pressable
          hitSlop={8}
          disabled={loading}
          onPress={(event) => {
            event.stopPropagation();
            onToggleExpand();
          }}
          style={styles.chevronBtn}
          accessibilityLabel={expanded ? "Collapse exercises" : "Expand exercises"}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons
              name={expanded ? "chevron-down" : "chevron-forward"}
              size={18}
              color={colors.textDim}
            />
          )}
        </Pressable>
      </View>
      {expanded ? (
        <View style={styles.expanded}>
          {routine.exercises.map((exercise) => (
            <View key={exercise.id} style={styles.expandedExRow}>
              <ExerciseAvatar
                name={exercise.exercise.name}
                imageUrl={exercise.exercise.imageUrl ?? null}
                size={28}
              />
              <Text style={styles.expandedLine} numberOfLines={2}>
                {formatRoutineExerciseDetail(exercise)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const makeCardStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      overflow: "hidden",
      ...shadows.card,
    },
    row: { flexDirection: "row", alignItems: "center" },
    mainTap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
    },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.6 },
    icon: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: colors.surfaceHover,
      alignItems: "center",
      justifyContent: "center",
    },
    body: { flex: 1, gap: 2 },
    title: { fontSize: 16, fontWeight: "700", color: colors.text },
    subtitle: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    chevronBtn: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    expanded: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      paddingTop: spacing.sm,
      gap: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.separator,
    },
    expandedExRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    expandedLine: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  });
