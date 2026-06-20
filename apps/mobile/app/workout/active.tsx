import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button, Input, Screen, Title } from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors, spacing } from "../../src/lib/theme";

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: workout, isLoading, refetch } = trpc.workout.active.useQuery();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: exercises } = trpc.exercise.list.useQuery(
    { search: search || undefined, limit: 30 },
    { enabled: pickerOpen },
  );

  const updateSet = trpc.workout.updateSet.useMutation({
    onSuccess: () => refetch(),
  });

  const addSet = trpc.workout.addSet.useMutation({
    onSuccess: () => refetch(),
  });

  const deleteSet = trpc.workout.deleteSet.useMutation({
    onSuccess: () => refetch(),
  });

  const addExercise = trpc.workout.addExercise.useMutation({
    onSuccess: () => {
      setPickerOpen(false);
      setSearch("");
      refetch();
    },
    onError: (e) => Alert.alert("Error", e.message),
  });

  const finish = trpc.workout.finish.useMutation({
    onSuccess: (result) => {
      utils.workout.active.invalidate();
      utils.workout.history.invalidate();
      utils.personalRecord.list.invalidate();
      utils.auth.stats.invalidate();

      const prCount = result.newRecords.length;
      Alert.alert(
        "Workout saved!",
        prCount > 0 ? `You hit ${prCount} new personal record${prCount > 1 ? "s" : ""}!` : "Great session.",
        [{ text: "Done", onPress: () => router.back() }],
      );
    },
    onError: (e) => Alert.alert("Error", e.message),
  });

  const cancel = trpc.workout.cancel.useMutation({
    onSuccess: () => {
      utils.workout.active.invalidate();
      router.back();
    },
  });

  const volume = useMemo(() => {
    if (!workout) return 0;
    return workout.exercises.reduce(
      (sum, ex) =>
        sum +
        ex.sets.reduce(
          (s, set) => s + (set.isCompleted ? (set.weight ?? 0) * (set.reps ?? 0) : 0),
          0,
        ),
      0,
    );
  }, [workout]);

  if (isLoading || !workout) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.volume}>{Math.round(volume)} kg</Text>
      </View>

      <Title>{workout.name ?? "Workout"}</Title>
      <Text style={styles.meta}>{workout.exercises.length} exercises</Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {workout.exercises.map((exercise) => (
          <ExerciseBlock
            key={exercise.id}
            name={exercise.exercise.name}
            sets={exercise.sets}
            onUpdateSet={(setId, data) => updateSet.mutate({ setId, ...data })}
            onAddSet={() => addSet.mutate({ workoutExerciseId: exercise.id })}
            onDeleteSet={(setId) => deleteSet.mutate({ setId })}
          />
        ))}

        {pickerOpen ? (
          <View style={styles.picker}>
            <Input placeholder="Search exercise" value={search} onChangeText={setSearch} />
            <FlatList
              data={exercises ?? []}
              keyExtractor={(item) => item.id}
              style={styles.pickerList}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickerItem}
                  onPress={() =>
                    addExercise.mutate({
                      workoutId: workout.id,
                      exerciseId: item.id,
                      sets: [{ setNumber: 1, isCompleted: false }],
                    })
                  }
                >
                  <Text style={styles.pickerText}>{item.name}</Text>
                </Pressable>
              )}
            />
          </View>
        ) : (
          <Button label="Add Exercise" onPress={() => setPickerOpen(true)} variant="secondary" />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Finish Workout"
          onPress={() => finish.mutate({ workoutId: workout.id })}
          loading={finish.isPending}
        />
        <Button
          label="Discard"
          onPress={() =>
            Alert.alert("Discard workout?", "This cannot be undone.", [
              { text: "Cancel", style: "cancel" },
              { text: "Discard", style: "destructive", onPress: () => cancel.mutate({ workoutId: workout.id }) },
            ])
          }
          variant="danger"
        />
      </View>
    </Screen>
  );
}

function ExerciseBlock({
  name,
  sets,
  onUpdateSet,
  onAddSet,
  onDeleteSet,
}: {
  name: string;
  sets: Array<{
    id: string;
    setNumber: number;
    weight: number | null;
    reps: number | null;
    isCompleted: boolean;
  }>;
  onUpdateSet: (
    setId: string,
    data: { weight?: number; reps?: number; isCompleted?: boolean },
  ) => void;
  onAddSet: () => void;
  onDeleteSet: (setId: string) => void;
}) {
  return (
    <View style={styles.exerciseBlock}>
      <Text style={styles.exerciseName}>{name}</Text>
      <View style={styles.setHeader}>
        <Text style={styles.setCol}>SET</Text>
        <Text style={styles.setCol}>KG</Text>
        <Text style={styles.setCol}>REPS</Text>
        <Text style={styles.setCol}>✓</Text>
      </View>
      {sets.map((set) => (
        <SetRow key={set.id} set={set} onUpdateSet={onUpdateSet} onDeleteSet={onDeleteSet} />
      ))}
      <Pressable onPress={onAddSet}>
        <Text style={styles.addSet}>+ Add Set</Text>
      </Pressable>
    </View>
  );
}

function SetRow({
  set,
  onUpdateSet,
  onDeleteSet,
}: {
  set: {
    id: string;
    setNumber: number;
    weight: number | null;
    reps: number | null;
    isCompleted: boolean;
  };
  onUpdateSet: (
    setId: string,
    data: { weight?: number; reps?: number; isCompleted?: boolean },
  ) => void;
  onDeleteSet: (setId: string) => void;
}) {
  const [weight, setWeight] = useState(set.weight?.toString() ?? "");
  const [reps, setReps] = useState(set.reps?.toString() ?? "");

  const commit = () => {
    onUpdateSet(set.id, {
      weight: weight ? Number(weight) : undefined,
      reps: reps ? Number(reps) : undefined,
    });
  };

  return (
    <View style={[styles.setRow, set.isCompleted && styles.setRowDone]}>
      <Text style={styles.setNumber}>{set.setNumber}</Text>
      <TextInput
        style={styles.setInput}
        value={weight}
        onChangeText={setWeight}
        onBlur={commit}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={colors.textDim}
      />
      <TextInput
        style={styles.setInput}
        value={reps}
        onChangeText={setReps}
        onBlur={commit}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor={colors.textDim}
      />
      <Pressable
        style={[styles.check, set.isCompleted && styles.checkDone]}
        onPress={() => onUpdateSet(set.id, { isCompleted: !set.isCompleted })}
      >
        <Text style={styles.checkText}>{set.isCompleted ? "✓" : ""}</Text>
      </Pressable>
      <Pressable onPress={() => onDeleteSet(set.id)}>
        <Text style={styles.deleteSet}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  back: { color: colors.primary, fontSize: 16, fontWeight: "600" },
  volume: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  meta: { color: colors.textMuted, fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { gap: spacing.md, paddingBottom: spacing.xl },
  exerciseBlock: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
    padding: spacing.md,
    gap: spacing.sm,
  },
  exerciseName: { color: colors.text, fontSize: 18, fontWeight: "700" },
  setHeader: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: 4 },
  setCol: { flex: 1, color: colors.textDim, fontSize: 11, fontWeight: "700" },
  setRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  setRowDone: { opacity: 0.7 },
  setNumber: { width: 28, color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  setInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
    color: colors.text,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 16,
    textAlign: "center",
  },
  check: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  checkText: { color: colors.primary, fontSize: 16, fontWeight: "700" },
  deleteSet: { color: colors.danger, fontSize: 22, paddingHorizontal: 4 },
  addSet: { color: colors.primary, fontSize: 14, fontWeight: "600", marginTop: 4 },
  picker: { gap: spacing.sm },
  pickerList: { maxHeight: 220 },
  pickerItem: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 10,
    marginBottom: 6,
  },
  pickerText: { color: colors.text, fontSize: 15 },
  footer: { gap: spacing.sm, paddingTop: spacing.sm },
});
