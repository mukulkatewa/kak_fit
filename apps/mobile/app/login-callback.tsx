import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as authLib from "../src/lib/auth";
import { useAuth } from "../src/lib/auth-context";
import { useThemedStyles, spacing, type Palette } from "../src/lib/theme";

/** OAuth return route — web redirect + Expo Go deep link land here. */
export default function LoginCallbackScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const callbackUrl = Linking.useURL();

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      try {
        const url =
          callbackUrl ??
          (typeof window !== "undefined" ? window.location.href : null);

        const result = await authLib.completeAuthSession(url);
        if (cancelled) return;

        if (!result) {
          router.replace("/login");
          return;
        }

        await refresh();
        router.replace("/(tabs)");
      } catch {
        if (cancelled) return;
        router.replace("/login");
      }
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [callbackUrl, refresh, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
      <Text style={styles.label}>Finishing sign-in…</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bg,
      gap: spacing.md,
    },
    label: {
      color: colors.textMuted,
      fontSize: 15,
    },
  });
