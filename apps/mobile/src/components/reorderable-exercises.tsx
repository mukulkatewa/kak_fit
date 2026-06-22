import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from "react-native-draggable-flatlist";
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

export function ReorderableExerciseList({
  items,
  superLinks,
  onReorder,
  onToggleLink,
  onRemove,
}: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const handleDragEnd = ({ data }: { data: ReorderExercise[] }) => {
    const linkById = new Map(items.map((item, i) => [item.exerciseId, superLinks[i] ?? false]));
    const nextLinks = data.map((item, i) => (i === 0 ? false : linkById.get(item.exerciseId) ?? false));
    onReorder(data, nextLinks);
  };

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<ReorderExercise>) => {
    const i = getIndex() ?? 0;
    return (
      <ScaleDecorator>
        <View>
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
          <View style={[styles.row, superLinks[i] && styles.rowLinked, isActive && styles.rowDragging]}>
            <Pressable onLongPress={drag} delayLongPress={120} hitSlop={8} style={styles.dragHandle}>
              <Ionicons name="reorder-three" size={22} color={colors.textDim} />
            </Pressable>
            <Text style={styles.index}>{i + 1}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Pressable onPress={() => onRemove(i)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.textDim} />
            </Pressable>
          </View>
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <DraggableFlatList
      data={items}
      keyExtractor={(item) => item.exerciseId}
      onDragEnd={handleDragEnd}
      renderItem={renderItem}
      scrollEnabled={false}
    />
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    linkRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 36, paddingVertical: 2 },
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
    rowDragging: { opacity: 0.92, backgroundColor: colors.surfaceHover },
    dragHandle: { padding: 2 },
    index: { width: 20, fontSize: 14, fontWeight: "700", color: colors.textMuted },
    name: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  });
