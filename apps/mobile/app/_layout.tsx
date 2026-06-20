import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { getToken } from "../src/lib/auth";
import { createQueryClient, createTRPCClient, trpc } from "../src/lib/trpc";
import { colors } from "../src/lib/theme";

const queryClient = createQueryClient();
const trpcClient = createTRPCClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    getToken().then((token) => {
      setHasToken(!!token);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;

    const inAuth = segments[0] === "login";

    if (!hasToken && !inAuth) {
      router.replace("/login");
    } else if (hasToken && inAuth) {
      router.replace("/(tabs)");
    }
  }, [ready, hasToken, segments, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="workout/active" options={{ presentation: "fullScreenModal" }} />
            <Stack.Screen name="routine/create" options={{ presentation: "modal" }} />
          </Stack>
        </AuthGate>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
