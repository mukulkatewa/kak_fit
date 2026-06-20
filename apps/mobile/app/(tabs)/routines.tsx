import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { Button, EmptyState, ListItem, Screen, Title } from "../../src/components/ui";
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
        <Title>Routines</Title>
        <Button label="Create" onPress={() => router.push("/routine/create")} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <FlatList
          data={routines ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title="No routines yet"
              message="Create Push/Pull/Legs templates to start workouts faster."
            />
          }
          renderItem={({ item }) => (
            <View style={styles.itemGroup}>
              <ListItem
                title={item.name}
                subtitle={`${item.exercises.length} exercises`}
                onPress={() => startRoutine.mutate({ routineId: item.id })}
              />
              <View style={styles.actions}>
                <Text
                  style={styles.action}
                  onPress={() => duplicate.mutate({ id: item.id })}
                >
                  Duplicate
                </Text>
                <Text
                  style={[styles.action, styles.danger]}
                  onPress={() =>
                    Alert.alert("Delete routine?", item.name, [
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
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  itemGroup: { gap: 4 },
  actions: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.sm },
  action: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  danger: { color: colors.danger },
});
