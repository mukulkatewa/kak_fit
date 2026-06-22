import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, EmptyState, ListGroup, ListRow, Screen } from "../../src/components/ui";
import { HevyIconButton, HevyStackHeader } from "../../src/components/hevy-ui";
import { trpc } from "../../src/lib/trpc";
import { alertWorkoutConflict } from "../../src/lib/workout-errors";
import { useTheme, useThemedStyles, spacing, type Palette } from "../../src/lib/theme";

export default function MyRoutinesScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const { data: routines, isPending, isFetching } = trpc.routine.list.useQuery();

  const discardActive = trpc.workout.discardActive.useMutation();

  const startRoutine = trpc.workout.startFromRoutine.useMutation({
    onSuccess: () => {
      utils.workout.active.invalidate();
      router.push("/workout/active");
    },
    onError: (e, vars) =>
      alertWorkoutConflict(
        e,
        () => router.push("/workout/active"),
        async () => {
          await discardActive.mutateAsync();
          await utils.workout.active.invalidate();
          startRoutine.mutate(vars);
        },
      ),
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
    <Screen scroll padded={false}>
      <View style={[styles.pad, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <HevyStackHeader
          title="My Routines"
          onBack={() => router.back()}
          right={<HevyIconButton icon="add" onPress={() => router.push("/routine/create")} />}
        />

        {isPending && routines === undefined ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
        ) : (routines ?? []).length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="barbell-outline"
              title="No routines yet"
              message="Create a template or save a program from Explore."
            />
            <Button label="Create Routine" icon="add" onPress={() => router.push("/routine/create")} />
          </View>
        ) : (
          <View style={styles.list}>
            {routines?.map((item) => (
              <View key={item.id} style={styles.routineWrap}>
                <ListGroup>
                  <ListRow
                    title={item.name}
                    subtitle={`${item.exercises.length} exercises`}
                    icon="barbell-outline"
                    onPress={() => startRoutine.mutate({ routineId: item.id })}
                    last
                  />
                </ListGroup>
                <View style={styles.actions}>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => router.push(`/routine/create?id=${item.id}`)}
                    hitSlop={6}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.textMuted} />
                    <Text style={styles.actionText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => duplicate.mutate({ id: item.id })}
                    hitSlop={6}
                  >
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
            ))}
            {isFetching ? <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} /> : null}
          </View>
        )}
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  pad: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
  list: { gap: spacing.lg },
  routineWrap: { gap: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.lg, paddingHorizontal: spacing.sm },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionText: { color: colors.textMuted, fontSize: 13 },
  danger: { color: colors.danger },
  emptyWrap: { gap: spacing.lg, alignItems: "center", marginTop: spacing.xl },
});
