import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, useThemedStyles, spacing, type Palette } from "../lib/theme";

export type ReorderExercise = {
  exerciseId: string;
  name: string;
};

type Props = {
  items: ReorderExercise[];
  superLinks: boolean[];
  onReorder: (items: ReorderExercise[], superLinks: boolean[]) => void;
  onToggleLink: (index: number) => void;
  onRemove: (index: number) => void;
};

/** Expo Go–compatible reorder (up/down). Drag requires a dev build + Reanimated. */
export function ReorderableExerciseList({
  items,
  superLinks,
  onReorder,
  onToggleLink,
  onRemove,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const nextItems = [...items];
    [nextItems[index], nextItems[target]] = [nextItems[target], nextItems[index]];
    const nextLinks = [...superLinks];
    [nextLinks[index], nextLinks[target]] = [nextLinks[target], nextLinks[index]];
    nextLinks[0] = false;
    onReorder(nextItems, nextLinks);
  };

  return (
    <View>
      {items.map((item, i) => (
        <View key={item.exerciseId}>
          {i > 0 ? (
            <Pressable style={styles.linkRow} onPress={() => onToggleLink(i)} hitSlop={6}>
              <Ionicons
                name={superLinks[i] ? "git-merge" : "link-outline"}
                size={14}
                color={superLinks[i] ? colors.accent : colors.textDim}
              />
              <Text style={[styles.linkText, superLinks[i] && styles.linkTextActive]}>
                {superLinks[i] ? "Superset" : "Make superset"}
              </Text>
            </Pressable>
          ) : null}
          <View style={[styles.row, superLinks[i] && styles.rowLinked]}>
            <Text style={styles.index}>{i + 1}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Pressable onPress={() => move(i, -1)} disabled={i === 0} hitSlop={6} style={i === 0 && styles.dim}>
              <Ionicons name="chevron-up" size={20} color={colors.textMuted} />
            </Pressable>
            <Pressable
              onPress={() => move(i, 1)}
              disabled={i === items.length - 1}
              hitSlop={6}
              style={i === items.length - 1 && styles.dim}
            >
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => onRemove(i)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.textDim} />
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    linkRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 28, paddingVertical: 2 },
    linkText: { fontSize: 12, color: colors.textDim, fontWeight: "600" },
    linkTextActive: { color: colors.accent },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: 10,
      marginBottom: spacing.xs,
    },
    rowLinked: { borderLeftWidth: 3, borderLeftColor: colors.accent },
    dim: { opacity: 0.35 },
    index: { width: 20, fontSize: 14, fontWeight: "700", color: colors.textMuted },
    name: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  });
