import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import * as authLib from "../src/lib/auth";
import { useAuth } from "../src/lib/auth-context";
import { useThemedStyles, spacing, type Palette } from "../src/lib/theme";

/** OAuth return route — web redirect + Expo Go deep link land here. */
export default function LoginCallbackScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const callbackUrl = Linking.useURL();
  const attemptedRef = useRef(false);

  useEffect(() => {
    // Prevent double-execution in React strict mode
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    let cancelled = false;

    async function finish() {
      try {
        // On web, use the full page URL which contains the OAuth state
        const url =
          Platform.OS === "web" && typeof window !== "undefined"
            ? window.location.href
            : callbackUrl;

        const result = await authLib.completeAuthSession(url);
        if (cancelled) return;

        if (!result) {
          // Small delay before redirecting to login — gives cookie time to settle
          if (Platform.OS === "web") {
            await new Promise((r) => setTimeout(r, 500));
            // Try once more on web
            const retry = await authLib.completeAuthSession(url);
            if (cancelled) return;
            if (retry) {
              await refresh();
              router.replace("/(tabs)");
              return;
            }
          }
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
