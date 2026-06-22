import { Stack } from "expo-router";
import { useTheme } from "../../src/lib/theme";

export default function WorkoutLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="active" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="my-routines" />
      <Stack.Screen name="programs" />
      <Stack.Screen name="program/[id]" />
      <Stack.Screen name="category/[id]" />
    </Stack>
  );
}
