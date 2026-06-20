import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, EmptyState, Header, ListGroup, ListRow, Screen } from "../../src/components/ui";
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
      <Header
        title="Workout"
        subtitle="Your routines and templates"
        action={
          <Button label="New" icon="add" size="sm" onPress={() => router.push("/routine/create")} />
        }
      />

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
              message="Create a Push / Pull / Legs template to get started."
            />
          }
          renderItem={({ item }) => (
            <View style={styles.routineWrap}>
              <ListGroup>
                <ListRow
                  title={item.name}
                  subtitle={`${item.exercises.length} exercises`}
                  icon="folder-outline"
                  onPress={() => startRoutine.mutate({ routineId: item.id })}
                  last
                />
              </ListGroup>
              <View style={styles.actions}>
                <Pressable style={styles.actionBtn} onPress={() => duplicate.mutate({ id: item.id })} hitSlop={6}>
                  <Ionicons name="copy-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.actionText}>Duplicate</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  hitSlop={6}
                  onPress={() =>
                    Alert.alert("Delete routine?", item.name, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => remove.mutate({ id: item.id }) },
                    ])
                  }
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={[styles.actionText, styles.danger]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.xs },
  routineWrap: { gap: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.lg, paddingHorizontal: spacing.sm },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionText: { color: colors.textMuted, fontSize: 13 },
  danger: { color: colors.danger },
});
