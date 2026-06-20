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
import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  Card,
  Input,
  Screen,
  SearchBar,
  SectionHeader,
  Title,
} from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors, radius, spacing } from "../../src/lib/theme";

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

  const updateSet = trpc.workout.updateSet.useMutation({ onSuccess: () => refetch() });
  const addSet = trpc.workout.addSet.useMutation({ onSuccess: () => refetch() });
  const deleteSet = trpc.workout.deleteSet.useMutation({ onSuccess: () => refetch() });
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
        <ActivityIndicator color={colors.accent} size="large" />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.accentNeon} />
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <View style={styles.volumePill}>
          <Text style={styles.volumeLabel}>VOLUME</Text>
          <Text style={styles.volume}>{Math.round(volume)} kg</Text>
        </View>
      </View>

      <Title>{workout.name ?? "Workout"}</Title>
      <Text style={styles.meta}>{workout.exercises.length} exercises · tap ✓ to log sets</Text>

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
          <Card glow>
            <SectionHeader title="Add Exercise" />
            <SearchBar placeholder="Search exercise" value={search} onChangeText={setSearch} />
            <FlatList
              data={exercises ?? []}
              keyExtractor={(item) => item.id}
              style={styles.pickerList}
              scrollEnabled={false}
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
                  <Ionicons name="add-circle" size={20} color={colors.successNeon} />
                </Pressable>
              )}
            />
            <Button label="Close" variant="ghost" fullWidth onPress={() => setPickerOpen(false)} />
          </Card>
        ) : (
          <Button label="Add Exercise" icon="add" fullWidth onPress={() => setPickerOpen(true)} variant="secondary" />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Finish Workout"
          icon="checkmark-circle"
          fullWidth
          onPress={() => finish.mutate({ workoutId: workout.id })}
          loading={finish.isPending}
        />
        <Button
          label="Discard"
          variant="danger"
          fullWidth
          onPress={() =>
            Alert.alert("Discard workout?", "This cannot be undone.", [
              { text: "Cancel", style: "cancel" },
              { text: "Discard", style: "destructive", onPress: () => cancel.mutate({ workoutId: workout.id }) },
            ])
          }
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
    <Card>
      <Text style={styles.exerciseName}>{name}</Text>
      <View style={styles.setHeader}>
        <Text style={[styles.setCol, styles.setColNarrow]}>SET</Text>
        <Text style={styles.setCol}>KG</Text>
        <Text style={styles.setCol}>REPS</Text>
        <Text style={[styles.setCol, styles.setColNarrow]}>✓</Text>
      </View>
      {sets.map((set) => (
        <SetRow key={set.id} set={set} onUpdateSet={onUpdateSet} onDeleteSet={onDeleteSet} />
      ))}
      <Pressable onPress={onAddSet} style={styles.addSetBtn}>
        <Ionicons name="add" size={16} color={colors.accentNeon} />
        <Text style={styles.addSet}>Add Set</Text>
      </Pressable>
    </Card>
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
        style={[styles.setInput, set.isCompleted && styles.setInputDone]}
        value={weight}
        onChangeText={setWeight}
        onBlur={commit}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={colors.textDim}
      />
      <TextInput
        style={[styles.setInput, set.isCompleted && styles.setInputDone]}
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
        {set.isCompleted ? (
          <Ionicons name="checkmark" size={18} color={colors.successNeon} />
        ) : null}
      </Pressable>
      <Pressable onPress={() => onDeleteSet(set.id)} hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.danger} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  back: { color: colors.accentNeon, fontSize: 16, fontWeight: "600" },
  volumePill: {
    backgroundColor: colors.accentMuted,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: "flex-end",
  },
  volumeLabel: { fontSize: 9, fontWeight: "800", color: colors.accentNeon, letterSpacing: 1 },
  volume: { color: colors.text, fontSize: 15, fontWeight: "800" },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: -8 },
  scroll: { flex: 1 },
  scrollContent: { gap: spacing.md, paddingBottom: spacing.xl },
  exerciseName: { color: colors.text, fontSize: 18, fontWeight: "700" },
  setHeader: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: 4 },
  setCol: { flex: 1, color: colors.textDim, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  setColNarrow: { flex: 0, width: 36, textAlign: "center" },
  setRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  setRowDone: { opacity: 0.85 },
  setNumber: { width: 28, color: colors.textMuted, fontSize: 14, fontWeight: "700", textAlign: "center" },
  setInput: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  setInputDone: {
    borderColor: colors.success,
    backgroundColor: colors.successMuted,
  },
  check: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
  },
  checkDone: {
    backgroundColor: colors.successMuted,
    borderColor: colors.successNeon,
  },
  addSetBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  addSet: { color: colors.accentNeon, fontSize: 14, fontWeight: "700" },
  pickerList: { maxHeight: 220 },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  pickerText: { color: colors.text, fontSize: 15, fontWeight: "600", flex: 1 },
  footer: { gap: spacing.sm, paddingTop: spacing.sm },
});
