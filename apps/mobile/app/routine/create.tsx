import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Input, Screen, Title } from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors, spacing } from "../../src/lib/theme";

export default function CreateRoutineScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<
    Array<{ exerciseId: string; name: string; sets: number }>
  >([]);
  const [search, setSearch] = useState("");

  const { data: exercises, isLoading } = trpc.exercise.list.useQuery({
    search: search || undefined,
    limit: 40,
  });

  const create = trpc.routine.create.useMutation({
    onSuccess: () => {
      utils.routine.list.invalidate();
      router.back();
    },
    onError: (e) => Alert.alert("Error", e.message),
  });

  const toggleExercise = (exerciseId: string, exerciseName: string) => {
    setSelected((prev) => {
      const exists = prev.find((e) => e.exerciseId === exerciseId);
      if (exists) return prev.filter((e) => e.exerciseId !== exerciseId);
      return [...prev, { exerciseId, name: exerciseName, sets: 3 }];
    });
  };

  const save = () => {
    if (!name.trim() || selected.length === 0) {
      Alert.alert("Missing info", "Add a name and at least one exercise.");
      return;
    }

    create.mutate({
      name: name.trim(),
      exercises: selected.map((item, index) => ({
        exerciseId: item.exerciseId,
        order: index,
        sets: Array.from({ length: item.sets }, (_, i) => ({
          setNumber: i + 1,
          targetReps: 10,
        })),
      })),
    });
  };

  return (
    <Screen>
      <Title>New Routine</Title>
      <Input placeholder="Routine name (e.g. Push Day)" value={name} onChangeText={setName} />
      <Input placeholder="Search exercises" value={search} onChangeText={setSearch} />

      <Text style={styles.selectedLabel}>
        Selected: {selected.length} exercise{selected.length === 1 ? "" : "s"}
      </Text>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <FlatList
          data={exercises ?? []}
          keyExtractor={(item) => item.id}
          style={styles.list}
          renderItem={({ item }) => {
            const active = selected.some((s) => s.exerciseId === item.id);
            return (
              <Pressable
                style={[styles.row, active && styles.rowActive]}
                onPress={() => toggleExercise(item.id, item.name)}
              >
                <Text style={styles.rowText}>{item.name}</Text>
                {active ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            );
          }}
        />
      )}

      <Button label="Save Routine" onPress={save} loading={create.isPending} />
      <Button label="Cancel" onPress={() => router.back()} variant="secondary" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  selectedLabel: { color: colors.textMuted, fontSize: 13 },
  list: { flex: 1 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  rowActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  rowText: { color: colors.text, fontSize: 15, flex: 1 },
  check: { color: colors.primary, fontWeight: "700" },
});
