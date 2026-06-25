import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HevyStackHeader } from "../../../src/components/hevy-ui";
import { EmptyState, ThemedDialog } from "../../../src/components/ui";
import { trpc } from "../../../src/lib/trpc";
import { parseOptionalNumber } from "../../../src/lib/workout-errors";
import { useUserPreferences } from "../../../src/lib/use-preferences";
import { fromKg, toKg, weightLabel } from "../../../src/lib/units";
import { radius, spacing, useTheme, useThemedStyles, type Palette } from "../../../src/lib/theme";

const SET_TYPES = ["NORMAL", "WARMUP", "DROP", "FAILURE"] as const;
type SetType = (typeof SET_TYPES)[number];

const SET_TYPE_LABEL: Record<SetType, string> = {
  NORMAL: "",
  WARMUP: "W",
  DROP: "D",
  FAILURE: "F",
};

export default function EditWorkoutScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const utils = trpc.useUtils();
  const { weightUnit } = useUserPreferences();

  const { data: workout, isLoading, isError, refetch } = trpc.workout.getById.useQuery(
    { id: id! },
    { enabled: Boolean(id) },
  );
  const [deleteSetDialog, setDeleteSetDialog] = useState<{ visible: boolean; setId?: string }>({
    visible: false,
  });

  const updateSet = trpc.workout.updateFinishedSet.useMutation({
    onSuccess: () => {
      refetch();
      utils.personalRecord.invalidate();
      utils.progress.volumeHistory.invalidate();
    },
    onError: (e) => Alert.alert("Couldn't save set", e.message),
  });
  const addSet = trpc.workout.addFinishedSet.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => Alert.alert("Couldn't add set", e.message),
  });
  const deleteSet = trpc.workout.deleteFinishedSet.useMutation({
    onSuccess: () => {
      refetch();
      utils.personalRecord.invalidate();
    },
    onError: (e) => Alert.alert("Couldn't delete set", e.message),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (isError || !workout || !workout.finishedAt) {
    return (
      <View style={styles.pad}>
        <HevyStackHeader title="Edit Workout" onBack={() => router.back()} />
        <EmptyState icon="alert-circle-outline" title="Workout not found" message="Only finished workouts can be edited." />
      </View>
    );
  }

  const cycleSetType = (type: SetType): SetType => {
    const i = SET_TYPES.indexOf(type);
    return SET_TYPES[(i + 1) % SET_TYPES.length];
  };

  return (
    <>
    <ScrollView style={styles.screen} contentContainerStyle={styles.pad} showsVerticalScrollIndicator={false}>
      <HevyStackHeader title="Edit Workout" onBack={() => router.back()} />
      <Text style={styles.title}>{workout.name ?? "Workout"}</Text>
      <Text style={styles.hint}>Changes update your history and personal records.</Text>

      {workout.exercises.map((ex) => (
        <View key={ex.id} style={styles.exerciseCard}>
          <Text style={styles.exerciseName}>{ex.exercise.name}</Text>
          <View style={styles.setHeader}>
            <Text style={[styles.colSet, styles.headerText]}>SET</Text>
            <Text style={[styles.colVal, styles.headerText]}>{weightLabel(weightUnit).toUpperCase()}</Text>
            <Text style={[styles.colVal, styles.headerText]}>REPS</Text>
            <Text style={[styles.colCheck, styles.headerText]}>✓</Text>
          </View>
          {ex.sets.map((set) => (
            <EditableSetRow
              key={set.id}
              weightUnit={weightUnit}
              set={{
                id: set.id,
                setNumber: set.setNumber,
                weight: set.weight,
                reps: set.reps,
                setType: (set.setType ?? "NORMAL") as SetType,
                isCompleted: set.isCompleted,
              }}
              onUpdate={(data) => updateSet.mutate({ setId: set.id, ...data })}
              onCycleSetType={() =>
                updateSet.mutate({ setId: set.id, setType: cycleSetType((set.setType ?? "NORMAL") as SetType) })
              }
              onDelete={() => setDeleteSetDialog({ visible: true, setId: set.id })}
            />
          ))}
          <Pressable onPress={() => addSet.mutate({ workoutExerciseId: ex.id })} style={styles.addSetBtn}>
            <Ionicons name="add" size={16} color={colors.accent} />
            <Text style={styles.addSetText}>Add Set</Text>
          </Pressable>
        </View>
      ))}

      <View style={{ height: spacing.xxxl }} />
    </ScrollView>

    <ThemedDialog
      visible={deleteSetDialog.visible}
      title="Delete set?"
      message="Remove this set from the workout?"
      onDismiss={() => setDeleteSetDialog({ visible: false })}
      buttons={[
        { label: "Cancel" },
        {
          label: "Delete",
          variant: "destructive",
          onPress: () => {
            if (deleteSetDialog.setId) {
              deleteSet.mutate({ setId: deleteSetDialog.setId });
            }
          },
        },
      ]}
    />
    </>
  );
}

function EditableSetRow({
  set,
  weightUnit,
  onUpdate,
  onCycleSetType,
  onDelete,
}: {
  set: {
    id: string;
    setNumber: number;
    weight: number | null;
    reps: number | null;
    setType: SetType;
    isCompleted: boolean;
  };
  weightUnit: "KG" | "LBS";
  onUpdate: (data: { weight?: number; reps?: number; isCompleted?: boolean }) => void;
  onCycleSetType: () => void;
  onDelete: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [weight, setWeight] = useState(
    set.weight != null ? String(fromKg(set.weight, weightUnit)) : "",
  );
  const [reps, setReps] = useState(set.reps?.toString() ?? "");
  const typeLabel = SET_TYPE_LABEL[set.setType] || String(set.setNumber);

  useEffect(() => {
    setWeight(set.weight != null ? String(fromKg(set.weight, weightUnit)) : "");
    setReps(set.reps?.toString() ?? "");
  }, [set.weight, set.reps, weightUnit]);

  const commit = () => {
    const w = parseOptionalNumber(weight);
    onUpdate({
      weight: w !== undefined ? toKg(w, weightUnit) : undefined,
      reps: parseOptionalNumber(reps),
    });
  };

  return (
    <View style={[styles.setRow, set.isCompleted && styles.setRowDone]}>
      <Pressable onPress={onCycleSetType} style={styles.colSet}>
        <Text style={styles.setNumber}>{typeLabel}</Text>
      </Pressable>
      <TextInput
        style={[styles.setInput, styles.colVal]}
        value={weight}
        onChangeText={setWeight}
        onBlur={commit}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={colors.textDim}
      />
      <TextInput
        style={[styles.setInput, styles.colVal]}
        value={reps}
        onChangeText={setReps}
        onBlur={commit}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor={colors.textDim}
      />
      <Pressable
        style={[styles.check, set.isCompleted && styles.checkDone]}
        onPress={() => onUpdate({ isCompleted: !set.isCompleted })}
      >
        {set.isCompleted ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
      </Pressable>
      <Pressable onPress={onDelete} hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.danger} />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
    pad: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, gap: spacing.md },
    title: { fontSize: 24, fontWeight: "800", color: colors.text },
    hint: { fontSize: 13, color: colors.textMuted, marginTop: -spacing.xs },
    exerciseCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    exerciseName: { fontSize: 17, fontWeight: "700", color: colors.text },
    setHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingBottom: spacing.xs },
    headerText: { fontSize: 11, fontWeight: "700", color: colors.textDim },
    setRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xs },
    setRowDone: { opacity: 0.9 },
    colSet: { width: 36, alignItems: "center" },
    colVal: { flex: 1 },
    colCheck: { width: 36, textAlign: "center" },
    setNumber: { fontSize: 14, fontWeight: "700", color: colors.textMuted },
    setInput: {
      backgroundColor: colors.surfaceHover,
      borderRadius: radius.sm,
      color: colors.text,
      paddingVertical: 8,
      paddingHorizontal: 6,
      fontSize: 15,
      fontWeight: "500",
      textAlign: "center",
    },
    check: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceHover,
    },
    checkDone: { backgroundColor: colors.accentMuted },
    addSetBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.xs },
    addSetText: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  });
