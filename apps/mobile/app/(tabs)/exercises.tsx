import { useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text } from "react-native";
import { EmptyState, Header, ListRow, Screen, SearchBar } from "../../src/components/ui";
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
      <Header eyebrow="LIBRARY" title="Moves" subtitle={`${count?.count ?? 0} exercises · Wger + custom`} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search exercises..." />

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={exercises ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState icon="search-outline" title="No exercises found" message="Try a different search." />
          }
          renderItem={({ item }) => {
            const primary = item.muscles.find((m) => m.isPrimary)?.muscle.name;
            return (
              <ListRow
                title={item.name}
                subtitle={[primary, item.category?.name, item.isCustom ? "Custom" : null]
                  .filter(Boolean)
                  .join(" · ")}
                icon="barbell-outline"
              />
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.xxl, paddingTop: spacing.xs },
});
