import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Header, Input, Screen, SearchBar } from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors, radius, spacing } from "../../src/lib/theme";

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
      <Header
        eyebrow="NEW ROUTINE"
        title="Build Template"
        action={
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        }
      />

      <Input placeholder="Routine name (e.g. Push Day)" value={name} onChangeText={setName} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search exercises to add..." />

      <View style={styles.selectedBar}>
        <Text style={styles.selectedLabel}>
          {selected.length} exercise{selected.length === 1 ? "" : "s"} selected
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <FlatList
          data={exercises ?? []}
          keyExtractor={(item) => item.id}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const active = selected.some((s) => s.exerciseId === item.id);
            return (
              <Pressable
                style={[styles.row, active && styles.rowActive]}
                onPress={() => toggleExercise(item.id, item.name)}
              >
                <Text style={[styles.rowText, active && styles.rowTextActive]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={[styles.checkbox, active && styles.checkboxActive]}>
                  {active ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <View style={styles.footer}>
        <Button label="Save Routine" icon="checkmark" fullWidth onPress={save} loading={create.isPending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBar: { flexDirection: "row" },
  selectedLabel: { color: colors.accentBright, fontSize: 13, fontWeight: "700" },
  list: { flex: 1 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  rowText: { color: colors.text, fontSize: 15, flex: 1, fontWeight: "500" },
  rowTextActive: { fontWeight: "700" },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  footer: { paddingTop: spacing.sm },
});
