import "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/lib/auth-context";
import { createQueryClient, createTRPCClient, trpc } from "../src/lib/trpc";
import { colors } from "../src/lib/theme";

const queryClient = createQueryClient();
const trpcClient = createTRPCClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading } = useAuth();

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

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <AuthGate>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
                <Stack.Screen name="login" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="workout" />
                <Stack.Screen name="routine/create" options={{ presentation: "modal" }} />
                <Stack.Screen name="exercise/[id]" />
                <Stack.Screen name="measurements" />
              </Stack>
            </AuthGate>
          </QueryClientProvider>
        </trpc.Provider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
