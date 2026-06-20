import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { EmptyState, Header, ListGroup, ListRow, Screen, SearchBar, Button } from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors } from "../../src/lib/theme";

export default function ExercisesTab() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data: exercises, isLoading, isError, error, refetch } = trpc.exercise.list.useQuery({
    search: search || undefined,
    limit: 50,
  });
  const { data: count } = trpc.exerciseCount.useQuery();

  return (
    <Screen scroll>
      <Header title="Exercises" subtitle={`${count?.count ?? 0} exercises`} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search exercises" />

      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : isError ? (
        <View style={{ marginTop: 24, gap: 12, alignItems: "center" }}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Could not load exercises"
            message={error.message}
          />
          <Button label="Retry" variant="secondary" onPress={() => refetch()} />
        </View>
      ) : (exercises ?? []).length === 0 ? (
        <EmptyState icon="search-outline" title="No exercises found" message="Try a different search." />
      ) : (
        <ListGroup>
          {exercises?.map((item, index) => {
            const primary = item.muscles.find((m) => m.isPrimary)?.muscle.name;
            return (
              <ListRow
                key={item.id}
                title={item.name}
                subtitle={[primary, item.category?.name].filter(Boolean).join(" · ")}
                onPress={() => router.push(`/exercise/${item.id}`)}
                last={index === (exercises?.length ?? 0) - 1}
              />
            );
          })}
        </ListGroup>
      )}
    </Screen>
  );
}
