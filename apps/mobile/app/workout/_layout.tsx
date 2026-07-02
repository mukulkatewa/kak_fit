import { Stack } from "expo-router";
import { Platform } from "react-native";
import { useTheme } from "../../src/lib/theme";

export default function WorkoutLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.bg,
          flex: 1,
          ...(Platform.OS === "web" ? { minHeight: 0, height: "100%" as const } : null),
        },
      }}
    >
      <Stack.Screen name="active" options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="history" />
      <Stack.Screen name="my-routines" />
      <Stack.Screen name="programs" />
      <Stack.Screen name="program/[id]" />
      <Stack.Screen name="category/[id]" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="edit/[id]" />
    </Stack>
  );
}
