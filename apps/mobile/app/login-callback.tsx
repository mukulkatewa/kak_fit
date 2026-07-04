import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import * as authLib from "../src/lib/auth";
import { useAuth } from "../src/lib/auth-context";
import { useThemedStyles, spacing, type Palette } from "../src/lib/theme";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** OAuth return route — web redirect + native deep link land here. */
export default function LoginCallbackScreen() {
  const router = useRouter();
  const { refresh } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const callbackUrl = Linking.useURL();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    let cancelled = false;

    async function finish() {
      try {
        const url =
          Platform.OS === "web" && typeof window !== "undefined"
            ? window.location.href
            : callbackUrl;

        const maxAttempts = 5;
        let result: Awaited<ReturnType<typeof authLib.completeAuthSession>> = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          if (attempt > 0) {
            await delay(400 * attempt);
          }
          result = await authLib.completeAuthSession(url);
          if (cancelled) return;
          if (result) break;
        }

        if (!result) {
          const hasToken = Boolean(authLib.getTokenSync() ?? (await authLib.getToken()));
          if (hasToken) {
            await refresh();
            router.replace("/(tabs)");
            return;
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
