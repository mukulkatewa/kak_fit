import "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavDefaultTheme,
  ThemeProvider as NavThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/lib/auth-context";
import { createQueryClient, createTRPCClient, trpc } from "../src/lib/trpc";
import { ThemeProvider, useTheme } from "../src/lib/theme";

const queryClient = createQueryClient();
const trpcClient = createTRPCClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading } = useAuth();
  const { colors } = useTheme();

  useEffect(() => {
    if (isLoading) return;

    const inAuth = segments[0] === "login";

    if (!isAuthenticated && !inAuth) {
      router.replace("/login");
    } else if (isAuthenticated && inAuth) {
      router.replace("/(tabs)");
    }
  }, [isLoading, isAuthenticated, segments, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

function ThemedApp() {
  const { colors, isDark } = useTheme();
  const base = isDark ? NavDarkTheme : NavDefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.bg,
      card: colors.bg,
      text: colors.text,
      border: colors.border,
      primary: colors.accent,
      notification: colors.accent,
    },
  };
  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="workout" />
          <Stack.Screen name="routine/create" options={{ presentation: "modal" }} />
          <Stack.Screen name="exercise/create" options={{ presentation: "modal" }} />
          <Stack.Screen name="exercise/[id]" />
          <Stack.Screen name="measurements" />
          <Stack.Screen name="settings" options={{ presentation: "modal" }} />
          <Stack.Screen name="nutrition-goals" options={{ presentation: "modal" }} />
          <Stack.Screen name="nutrition-foods" options={{ presentation: "modal" }} />
          <Stack.Screen name="profile-edit" options={{ presentation: "modal" }} />
          <Stack.Screen name="photos" />
          <Stack.Screen name="photos/compare" />
          <Stack.Screen name="calendar" />
          <Stack.Screen name="tools" options={{ presentation: "modal" }} />
          <Stack.Screen name="routine/share/[token]" />
        </Stack>
      </AuthGate>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
              <ThemedApp />
            </QueryClientProvider>
          </trpc.Provider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
