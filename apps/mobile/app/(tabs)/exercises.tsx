import { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { EmptyState, Input, ListItem, Screen, Title } from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors, spacing } from "../../src/lib/theme";

export default function ExercisesTab() {
  const [search, setSearch] = useState("");
  const { data: exercises, isLoading } = trpc.exercise.list.useQuery({
    search: search || undefined,
    limit: 40,
  });
  const { data: count } = trpc.exerciseCount.useQuery();

  return (
    <Screen>
      <Title>Exercise Library</Title>
      <Text style={styles.meta}>
        {count?.count ?? 0} exercises from Wger + your custom moves
      </Text>
      <Input
        placeholder="Search exercises..."
        value={search}
        onChangeText={setSearch}
      />

      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <FlatList
          data={exercises ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState title="No exercises found" message="Try a different search term." />
          }
          renderItem={({ item }) => {
            const primary = item.muscles.find((m) => m.isPrimary)?.muscle.name;
            return (
              <ListItem
                title={item.name}
                subtitle={[
                  primary,
                  item.category?.name,
                  item.isCustom ? "Custom" : null,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              />
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
});
