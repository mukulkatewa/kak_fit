import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import { EmptyState } from "./ui";
import { flexFill } from "../lib/layout-constants";
import type { WorkoutHistoryItem } from "../lib/workout-history-query";
import { radius, shadows, spacing, useTheme, useThemedStyles, type Palette } from "../lib/theme";
import { tonnageFromKg, weightLabel } from "../lib/units";

type WorkoutHistoryListProps = {
  workouts: WorkoutHistoryItem[];
  weightUnit: "KG" | "LBS";
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  onPress: (workout: WorkoutHistoryItem) => void;
  onLongPress?: (workout: WorkoutHistoryItem) => void;
  onEndReached?: () => void;
  onRefresh?: () => Promise<void> | void;
  ListHeaderComponent?: React.ReactElement | null;
  contentContainerStyle?: object;
};

export function WorkoutHistoryList({
  workouts,
  weightUnit,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onPress,
  onLongPress,
  onEndReached,
  onRefresh,
  ListHeaderComponent,
  contentContainerStyle,
}: WorkoutHistoryListProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const renderItem: ListRenderItem<WorkoutHistoryItem> = useCallback(
    ({ item }) => (
      <WorkoutHistoryCard
        workout={item}
        weightUnit={weightUnit}
        onPress={() => onPress(item)}
        onLongPress={onLongPress ? () => onLongPress(item) : undefined}
      />
    ),
    [onPress, onLongPress, weightUnit],
  );

  return (
    <FlatList
      style={flexFill}
      data={workouts}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={[styles.listContent, contentContainerStyle]}
      ListHeaderComponent={ListHeaderComponent}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          onEndReached?.();
        }
      }}
      onEndReachedThreshold={0.5}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        ) : undefined
      }
      ListFooterComponent={<LoadingFooter visible={Boolean(isFetchingNextPage)} />}
      ListEmptyComponent={
        isLoading ? (
          <View style={styles.emptyLoading}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <EmptyState
            icon="barbell-outline"
            title="No workouts yet"
            message="Start your first workout to see it here."
          />
        )
      }
    />
  );
}

type WorkoutHistoryCardProps = {
  workout: WorkoutHistoryItem;
  weightUnit: "KG" | "LBS";
  onPress: () => void;
  onLongPress?: () => void;
};

const WorkoutHistoryCard = React.memo(function WorkoutHistoryCard({
  workout,
  weightUnit,
  onPress,
  onLongPress,
}: WorkoutHistoryCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const volume = Math.round(tonnageFromKg(workout.volume, weightUnit)).toLocaleString();
  const unit = weightLabel(weightUnit);
  const dateLabel = workout.finishedAt
    ? new Date(workout.finishedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.cardIcon}>
        <Ionicons name="fitness" size={20} color={colors.onAccent} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {workout.name ?? "Workout"}
        </Text>
        <Text style={styles.cardSub} numberOfLines={1}>
          {workout.exerciseCount} exercises · {volume} {unit}
          {dateLabel ? ` · ${dateLabel}` : ""}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
    </Pressable>
  );
});

function LoadingFooter({ visible }: { visible: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (!visible) return null;

  return (
    <View style={styles.loadingFooter}>
      <ActivityIndicator size="small" color={colors.accent} />
      <Text style={styles.loadingText}>Loading more workouts…</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    listContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
      flexGrow: 1,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadows.card,
    },
    cardIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    cardBody: { flex: 1, gap: 2 },
    cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    cardSub: { fontSize: 13, color: colors.textMuted },
    pressed: { opacity: 0.7 },
    loadingFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.lg,
    },
    loadingText: { fontSize: 14, color: colors.textMuted },
    emptyLoading: { paddingVertical: spacing.xxxl, alignItems: "center" },
  });
