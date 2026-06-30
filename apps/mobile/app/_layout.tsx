import { QueryClientProvider } from "@tanstack/react-query";
import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavDefaultTheme,
  ThemeProvider as NavThemeProvider,
} from "@react-navigation/native";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ActiveWorkoutOverlay } from "../src/components/active-workout-overlay";
import { StartupErrorBoundary } from "../src/components/startup-error-boundary";
import { DevApiBanner } from "../src/components/dev-api-banner";
import { TrpcPrefetchBootstrap } from "../src/components/trpc-prefetch-bootstrap";
import { TokenRefreshBadge } from "../src/components/token-refresh-badge";
import { ToastContainer, ToastProvider } from "../src/components/ui";
import { AuthSessionValidator } from "../src/lib/auth-session-validator";
import { AuthProvider, useAuth } from "../src/lib/auth-context";
import { queryClient } from "../src/lib/query-client";
import { createTRPCClient, trpc } from "../src/lib/trpc";
import { ThemeProvider, useTheme } from "../src/lib/theme";

const trpcClient = createTRPCClient();

/** Redirect after the root navigator has mounted — never wrap Stack in a gate. */
function AuthRedirect() {
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!navigationState?.key || isLoading) return;

    const id = setTimeout(() => {
      const first = segments[0];
      const inAuth = first === "login" || first === "login-callback";
      const onIndex = !first || first === "index";

      if (!isAuthenticated && !inAuth) {
        router.replace("/login");
      } else if (isAuthenticated && (inAuth || onIndex)) {
        router.replace("/(tabs)");
      }
    }, 0);

    return () => clearTimeout(id);
  }, [navigationState?.key, isLoading, isAuthenticated, segments, router]);

  return null;
}

function AuthLoadingOverlay() {
  const { isLoading } = useAuth();
  const { colors } = useTheme();

  if (!isLoading) return null;

  return (
    <View
      pointerEvents="auto"
      style={[StyleSheet.absoluteFillObject, styles.loadingOverlay, { backgroundColor: colors.bg }]}
    >
      <ActivityIndicator color={colors.accent} size="large" />
    </View>
  );
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
      <View style={styles.root}>
        <ToastProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="login-callback" options={{ animation: "fade" }} />
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
          <Stack.Screen name="developer-api" options={{ presentation: "modal" }} />
          <Stack.Screen name="routine/share/[token]" />
        </Stack>
        <AuthRedirect />
        <AuthLoadingOverlay />
        <DevApiBanner />
        <TokenRefreshBadge />
        <ActiveWorkoutOverlay />
        <ToastContainer />
        </ToastProvider>
      </View>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <StartupErrorBoundary>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <trpc.Provider client={trpcClient} queryClient={queryClient}>
                <QueryClientProvider client={queryClient}>
                  <AuthSessionValidator />
                  <TrpcPrefetchBootstrap />
                  <ThemedApp />
                </QueryClientProvider>
              </trpc.Provider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </StartupErrorBoundary>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  root: { flex: 1 },
  loadingOverlay: { alignItems: "center", justifyContent: "center", zIndex: 100 },
});
