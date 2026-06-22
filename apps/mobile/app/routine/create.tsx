import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, SearchBar } from "../../src/components/ui";
import { HevyInfoStrip, HevyModalHeader, HevyUnderlineInput } from "../../src/components/hevy-ui";
import { trpc } from "../../src/lib/trpc";
import { useTheme, useThemedStyles, spacing, radius, type Palette } from "../../src/lib/theme";

export default function CreateRoutineScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(editId);
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [showTip, setShowTip] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<
    Array<{ exerciseId: string; name: string; sets?: Array<{ setNumber: number; targetWeight?: number; targetReps?: number; targetDuration?: number }> }>
  >([]);

  const { data: editing } = trpc.routine.getById.useQuery(
    { id: editId! },
    { enabled: isEdit },
  );

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setSelected(
        editing.exercises.map((ex) => ({
          exerciseId: ex.exercise.id,
          name: ex.exercise.name,
          sets: ex.sets.map((s) => ({
            setNumber: s.setNumber,
            targetWeight: s.targetWeight ?? undefined,
            targetReps: s.targetReps ?? undefined,
            targetDuration: s.targetDuration ?? undefined,
          })),
        })),
      );
    }
  }, [editing]);

  const { data: exercises, isLoading } = trpc.exercise.list.useQuery(
    { search: search || undefined, limit: 40 },
    { enabled: pickerOpen },
  );

  const update = trpc.routine.update.useMutation({
    onSuccess: () => {
      utils.routine.list.invalidate();
      if (editId) utils.routine.getById.invalidate({ id: editId });
      router.back();
    },
    onError: (e) => Alert.alert("Error", e.message),
  });

  const create = trpc.routine.create.useMutation({
    onMutate: async (input) => {
      await utils.routine.list.cancel();
      const previous = utils.routine.list.getData();
      utils.routine.list.setData(undefined, (old) => [
        {
          id: `optimistic-${Date.now()}`,
          userId: "",
          folderId: null,
          name: input.name,
          notes: input.notes ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
          exercises: input.exercises.map((ex, index) => ({
            id: `optimistic-ex-${index}`,
            order: ex.order,
            restSeconds: ex.restSeconds ?? null,
            notes: ex.notes ?? null,
            exercise: { id: ex.exerciseId, name: "Saving…" },
            sets: ex.sets.map((set) => ({
              id: `optimistic-set-${set.setNumber}`,
              setNumber: set.setNumber,
              targetWeight: set.targetWeight ?? null,
              targetReps: set.targetReps ?? null,
              targetDuration: set.targetDuration ?? null,
              setType: "NORMAL" as const,
            })),
          })),
        },
        ...(old ?? []),
      ]);
      return { previous };
    },
    onError: (e, _input, context) => {
      if (context?.previous) {
        utils.routine.list.setData(undefined, context.previous);
      }
      Alert.alert("Error", e.message);
    },
    onSuccess: () => {
      utils.routine.list.invalidate();
      router.back();
    },
  });

  const canSave = name.trim().length > 0 && selected.length > 0;

  const save = () => {
    if (!canSave) return;
    const exercises = selected.map((item, index) => ({
      exerciseId: item.exerciseId,
      order: index,
      sets:
        item.sets && item.sets.length > 0
          ? item.sets
          : Array.from({ length: 3 }, (_, i) => ({ setNumber: i + 1, targetReps: 10 })),
    }));
    if (isEdit && editId) {
      update.mutate({ id: editId, name: name.trim(), exercises });
    } else {
      create.mutate({ name: name.trim(), exercises });
    }
  };

  const addExercise = (exerciseId: string, exerciseName: string) => {
    if (selected.some((s) => s.exerciseId === exerciseId)) return;
    setSelected((prev) => [...prev, { exerciseId, name: exerciseName }]);
    setPickerOpen(false);
    setSearch("");
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.headerPad}>
        <HevyModalHeader
          title={isEdit ? "Edit Routine" : "Create Routine"}
          onCancel={() => router.back()}
          onSave={save}
          saveDisabled={!canSave}
          saveLoading={create.isPending || update.isPending}
        />
      </View>

      {showTip ? (
        <HevyInfoStrip
          text="You're creating a Routine. Add exercises, then tap Save."
          onDismiss={() => setShowTip(false)}
        />
      ) : null}

      <View style={styles.body}>
        <HevyUnderlineInput placeholder="Routine title" value={name} onChangeText={setName} />

        {selected.length > 0 ? (
          <View style={styles.selectedList}>
            {selected.map((ex, i) => (
              <View key={ex.exerciseId} style={styles.selectedRow}>
                <Text style={styles.selectedName}>{ex.name}</Text>
                <Pressable
                  onPress={() => setSelected((prev) => prev.filter((_, idx) => idx !== i))}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={20} color={colors.textDim} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Ionicons name="barbell-outline" size={48} color={colors.textDim} />
            <Text style={styles.emptyText}>Get started by adding an exercise to your routine.</Text>
            <Pressable style={styles.addBtn} onPress={() => setPickerOpen(true)}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Add exercise</Text>
            </Pressable>
          </View>
        )}

        {selected.length > 0 ? (
          <Button label="Add exercise" icon="add" variant="secondary" fullWidth onPress={() => setPickerOpen(true)} />
        ) : null}
      </View>

      {pickerOpen ? (
        <View style={[styles.picker, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom }]}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Add exercise</Text>
            <Pressable onPress={() => setPickerOpen(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search exercises" />
          {isLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={exercises ?? []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
              renderItem={({ item }) => (
                <Pressable style={styles.pickerRow} onPress={() => addExercise(item.id, item.name)}>
                  <Text style={styles.pickerName}>{item.name}</Text>
                  <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
                </Pressable>
              )}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerPad: { paddingHorizontal: spacing.lg },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.lg },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, paddingBottom: 80 },
  emptyText: { color: colors.textMuted, fontSize: 15, textAlign: "center", maxWidth: 260, lineHeight: 22 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  addBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  selectedList: { gap: spacing.sm },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  selectedName: { flex: 1, color: colors.text, fontSize: 16 },
  picker: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  pickerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickerTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
    gap: spacing.md,
  },
  pickerName: { flex: 1, color: colors.text, fontSize: 16 },
});
