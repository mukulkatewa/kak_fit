import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, EmptyState, Header, Screen } from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors, radius, spacing } from "../../src/lib/theme";

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
        eyebrow="ROUTINES"
        title="Train"
        subtitle="Push / Pull / Legs templates"
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
              message="Create your first Push Day, Pull Day, or Leg Day template."
            />
          }
          renderItem={({ item }) => (
            <View style={styles.routineCard}>
              <Pressable
                style={({ pressed }) => [styles.routineMain, pressed && styles.pressed]}
                onPress={() => startRoutine.mutate({ routineId: item.id })}
              >
                <View style={styles.routineIcon}>
                  <Ionicons name="fitness" size={22} color={colors.accentBright} />
                </View>
                <View style={styles.routineBody}>
                  <Text style={styles.routineName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.routineMeta}>{item.exercises.length} exercises</Text>
                </View>
                <View style={styles.startPill}>
                  <Ionicons name="play" size={14} color={colors.accentNeon} />
                  <Text style={styles.startText}>Start</Text>
                </View>
              </Pressable>

              <View style={styles.actions}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => duplicate.mutate({ id: item.id })}
                  hitSlop={6}
                >
                  <Ionicons name="copy-outline" size={15} color={colors.textMuted} />
                  <Text style={styles.action}>Duplicate</Text>
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
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  <Text style={[styles.action, styles.danger]}>Delete</Text>
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
  list: { gap: spacing.md, paddingBottom: spacing.xxl, paddingTop: spacing.xs },
  routineCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  routineMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  pressed: { backgroundColor: colors.surfaceHover },
  routineIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  routineBody: { flex: 1, gap: 3 },
  routineName: { color: colors.text, fontWeight: "700", fontSize: 16 },
  routineMeta: { color: colors.textMuted, fontSize: 13, fontWeight: "500" },
  startPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.successMuted,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.success,
  },
  startText: { color: colors.successNeon, fontWeight: "700", fontSize: 13 },
  actions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.md,
  },
  action: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  danger: { color: colors.danger },
});
