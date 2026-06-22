import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HevyStackHeader } from "../../src/components/hevy-ui";
import { EmptyState } from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import {
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Palette,
} from "../../src/lib/theme";

function formatDuration(startedAt: string | Date, finishedAt: string | Date | null) {
  if (!finishedAt) return "—";
  const mins = Math.max(
    1,
    Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 60_000),
  );
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const utils = trpc.useUtils();
  const { data: workout, isLoading, isError } = trpc.workout.getById.useQuery(
    { id: id! },
    { enabled: Boolean(id) },
  );

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  useEffect(() => {
    if (workout?.name) setNameDraft(workout.name);
  }, [workout?.name]);

  const update = trpc.workout.update.useMutation({
    onSuccess: () => {
      if (id) utils.workout.getById.invalidate({ id });
      utils.workout.history.invalidate();
      setEditing(false);
    },
    onError: (e) => Alert.alert("Couldn't rename", e.message),
  });

  const remove = trpc.workout.delete.useMutation({
    onSuccess: () => {
      utils.workout.history.invalidate();
      utils.progress.volumeHistory.invalidate();
      router.back();
    },
    onError: (e) => Alert.alert("Couldn't delete", e.message),
  });

  const confirmDelete = () => {
    if (!id) return;
    Alert.alert("Delete workout?", "This permanently removes it from your history.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate({ id }) },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (isError || !workout) {
    return (
      <View style={styles.pad}>
        <HevyStackHeader title="Workout" onBack={() => router.back()} />
        <EmptyState icon="alert-circle-outline" title="Workout not found" message="It may have been deleted." />
      </View>
    );
  }

  const totalVolume = workout.exercises.reduce(
    (sum, ex) =>
      sum +
      ex.sets.reduce((s, set) => s + (set.isCompleted ? (set.weight ?? 0) * (set.reps ?? 0) : 0), 0),
    0,
  );
  const totalSets = workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.isCompleted).length,
    0,
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
      <HevyStackHeader
        title="Workout"
        onBack={() => router.back()}
        right={
          <View style={styles.headerActions}>
            <Pressable hitSlop={8} onPress={() => setEditing((v) => !v)}>
              <Ionicons name="create-outline" size={22} color={colors.text} />
            </Pressable>
            <Pressable hitSlop={8} onPress={confirmDelete}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
        }
      />

      {editing ? (
        <View style={styles.editRow}>
          <TextInput
            value={nameDraft}
            onChangeText={setNameDraft}
            style={styles.editInput}
            placeholder="Workout name"
            placeholderTextColor={colors.textDim}
            autoFocus
          />
          <Pressable
            style={styles.saveChip}
            onPress={() => id && update.mutate({ id, name: nameDraft.trim() || "Workout" })}
          >
            <Text style={styles.saveChipText}>{update.isPending ? "…" : "Save"}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.title}>{workout.name ?? "Workout"}</Text>
      )}
      <Text style={styles.date}>
        {workout.finishedAt
          ? new Date(workout.finishedAt).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })
          : "In progress"}
      </Text>

      <View style={styles.statsRow}>
        <Stat label="Duration" value={formatDuration(workout.startedAt, workout.finishedAt)} />
        <Stat label="Volume" value={`${Math.round(totalVolume).toLocaleString()} kg`} />
        <Stat label="Sets" value={String(totalSets)} />
      </View>

      {workout.exercises.map((ex) => (
        <View key={ex.id} style={styles.exerciseCard}>
          <Text style={styles.exerciseName}>{ex.exercise.name}</Text>
          <View style={styles.setHeader}>
            <Text style={[styles.colSet, styles.headerText]}>SET</Text>
            <Text style={[styles.colVal, styles.headerText]}>WEIGHT</Text>
            <Text style={[styles.colVal, styles.headerText]}>REPS</Text>
          </View>
          {ex.sets.map((set) => (
            <View key={set.id} style={styles.setRow}>
              <Text style={styles.colSet}>{set.setNumber}</Text>
              <Text style={styles.colVal}>{set.weight != null ? `${set.weight} kg` : "—"}</Text>
              <Text style={styles.colVal}>{set.reps ?? "—"}</Text>
            </View>
          ))}
        </View>
      ))}

      <View style={{ height: spacing.xxxl }} />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
    pad: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, gap: spacing.md },
    title: { fontSize: 26, fontWeight: "800", color: colors.text },
    headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
    editRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    editInput: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 20,
      fontWeight: "700",
    },
    saveChip: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
    },
    saveChipText: { color: colors.onAccent, fontWeight: "700", fontSize: 15 },
    date: { fontSize: 14, color: colors.textMuted, marginTop: -spacing.xs },
    statsRow: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      marginTop: spacing.sm,
    },
    stat: { flex: 1, alignItems: "center", gap: 2 },
    statValue: { fontSize: 17, fontWeight: "800", color: colors.text },
    statLabel: { fontSize: 12, color: colors.textMuted },
    exerciseCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    exerciseName: { fontSize: 17, fontWeight: "700", color: colors.text },
    setHeader: {
      flexDirection: "row",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
      paddingBottom: spacing.xs,
    },
    headerText: { fontSize: 11, fontWeight: "700", color: colors.textDim },
    setRow: { flexDirection: "row", paddingVertical: spacing.xs },
    colSet: { width: 48, fontSize: 15, color: colors.textMuted },
    colVal: { flex: 1, fontSize: 15, color: colors.text },
  });
