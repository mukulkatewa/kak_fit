import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  QueryClientProvider,
  createQueryClient,
  createTRPCClient,
  trpc,
} from "./src/lib/trpc";

const queryClient = createQueryClient();
const trpcClient = createTRPCClient();

function AppContent() {
  const health = trpc.health.useQuery();
  const version = trpc.version.useQuery();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLoading = !mounted || health.isLoading || version.isLoading;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.badge}>KAK FIT</Text>
        <Text style={styles.title}>Workout Tracker</Text>
        <Text style={styles.subtitle}>
          Hevy-style • Mobile-first • Lower price
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#34d399" />
      ) : (
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>API Status</Text>
            <Text style={styles.statusOk}>{health.data?.status ?? "error"}</Text>
          </View>
          <Text style={styles.detail}>Phase: {version.data?.phase}</Text>
          <Text style={styles.detail}>Version: {version.data?.version}</Text>
          <Text style={styles.hint}>
            Set EXPO_PUBLIC_API_URL to your Next.js server (default:
            localhost:3000)
          </Text>
        </View>
      )}

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090b",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 24,
  },
  header: {
    alignItems: "center",
    gap: 8,
  },
  badge: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 4,
  },
  title: {
    color: "#fafafa",
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    color: "#a1a1aa",
    fontSize: 14,
    textAlign: "center",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#18181b",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 20,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    color: "#a1a1aa",
    fontSize: 14,
  },
  statusOk: {
    color: "#34d399",
    fontSize: 14,
    fontWeight: "600",
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  detail: {
    color: "#d4d4d8",
    fontSize: 14,
  },
  hint: {
    color: "#71717a",
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
});
