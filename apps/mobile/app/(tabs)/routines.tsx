import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from "react-native";
import {
  Button,
  EmptyState,
  ListRow,
  Screen,
  SectionHeader,
  Title,
} from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors, spacing } from "../../src/lib/theme";

export default function RoutinesTab() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: routines, isLoading } = trpc.routine.list.useQuery();

  const startRoutine = trpc.workout.startFromRoutine.useMutation({
    onSuccess: () => {
      utils.workout.active.invalidate();
      router.push("/workout/active");
    },
    onError: (e) => Alert.alert("Error", e.message),
  });

  const duplicate = trpc.routine.duplicate.useMutation({
    onSuccess: () => utils.routine.list.invalidate(),
    onError: (e) => Alert.alert("Error", e.message),
  });

  const remove = trpc.routine.delete.useMutation({
    onSuccess: () => utils.routine.list.invalidate(),
    onError: (e) => Alert.alert("Error", e.message),
  });

  return (
    <Screen>
      <View style={styles.header}>
        <Title>Train</Title>
        <Button label="New" icon="add" onPress={() => router.push("/routine/create")} />
      </View>
      <Text style={styles.sub}>Build Push / Pull / Legs templates</Text>

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={routines ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="barbell-outline"
              title="No routines yet"
              message="Create your first Push Day, Pull Day, or Leg Day template."
            />
          }
          renderItem={({ item }) => (
            <View style={styles.itemGroup}>
              <ListRow
                title={item.name}
                subtitle={`${item.exercises.length} exercises`}
                icon="fitness-outline"
                onPress={() => startRoutine.mutate({ routineId: item.id })}
              />
              <View style={styles.actions}>
                <Text style={styles.action} onPress={() => duplicate.mutate({ id: item.id })}>
                  Duplicate
                </Text>
                <Text
                  style={[styles.action, styles.danger]}
                  onPress={() =>
                    Alert.alert("Delete?", item.name, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => remove.mutate({ id: item.id }) },
                    ])
                  }
                >
                  Delete
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sub: { color: colors.textMuted, fontSize: 14, marginTop: -8 },
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  itemGroup: { gap: 4 },
  actions: { flexDirection: "row", gap: spacing.lg, paddingHorizontal: spacing.sm },
  action: { color: colors.accentNeon, fontSize: 13, fontWeight: "600" },
  danger: { color: colors.danger },
});
