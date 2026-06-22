import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { HevyStackHeader } from "../../../src/components/hevy-ui";
import { Button, EmptyState, ListGroup, ListRow, Screen } from "../../../src/components/ui";
import { trpc } from "../../../src/lib/trpc";
import { spacing, useTheme, useThemedStyles, type Palette } from "../../../src/lib/theme";

export default function RoutineShareScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { token } = useLocalSearchParams<{ token: string }>();
  const utils = trpc.useUtils();

  const { data, isLoading, isError } = trpc.routine.previewShare.useQuery(
    { token: token! },
    { enabled: Boolean(token) },
  );

  const importShare = trpc.routine.importShare.useMutation({
    onSuccess: () => {
      utils.routine.list.invalidate();
      Alert.alert("Imported", "Routine added to My Routines.", [
        { text: "OK", onPress: () => router.replace("/workout/my-routines") },
      ]);
    },
    onError: (e) => Alert.alert("Import failed", e.message),
  });

  if (!token) {
    return (
      <Screen>
        <HevyStackHeader title="Shared Routine" onBack={() => router.back()} />
        <EmptyState icon="link-outline" title="Invalid link" message="This share link is missing a token." />
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <Screen>
        <HevyStackHeader title="Shared Routine" onBack={() => router.back()} />
        <EmptyState icon="alert-circle-outline" title="Routine not found" message="The link may have expired or been removed." />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <HevyStackHeader title="Shared Routine" onBack={() => router.back()} />

      <Text style={styles.title}>{data.name}</Text>
      <Text style={styles.sub}>
        {data.exerciseCount} exercises · shared by {data.authorName}
      </Text>

      <ListGroup>
        {data.exercises.map((ex, i) => (
          <ListRow
            key={`${ex.name}-${i}`}
            title={ex.name}
            subtitle={`${ex.setCount} sets`}
            last={i === data.exercises.length - 1}
          />
        ))}
      </ListGroup>

      {data.isOwn ? (
        <Text style={styles.note}>This is your routine — import creates a copy.</Text>
      ) : null}

      <Button
        label={importShare.isPending ? "Importing…" : "Add to My Routines"}
        fullWidth
        onPress={() => importShare.mutate({ token })}
        disabled={importShare.isPending}
      />
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    title: { fontSize: 26, fontWeight: "800", color: colors.text },
    sub: { fontSize: 14, color: colors.textMuted, marginBottom: spacing.lg },
    note: { fontSize: 13, color: colors.textDim, textAlign: "center", marginVertical: spacing.md },
  });
