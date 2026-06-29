import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../src/lib/auth-context";
import { BrandMark } from "../src/components/ui";
import { useThemedStyles, spacing, type Palette } from "../src/lib/theme";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithGoogle } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      // Web: full-page redirect to Google — completion happens on /login-callback.
      if (Platform.OS === "web") {
        await signInWithGoogle();
        return;
      }
      await signInWithGoogle();
      router.replace("/(tabs)");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      setError(message);
    } finally {
      if (Platform.OS !== "web") {
        setLoading(false);
      }
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logoSection}>
          <BrandMark large />
        </View>

        <View style={styles.copy}>
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subheading}>
            Sign in to sync workouts, routines, and progress across devices.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={handleGoogleSignIn}
            disabled={loading}
            style={({ pressed }) => [
              styles.googleButton,
              pressed && styles.googleButtonPressed,
              loading && styles.googleButtonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#1f1f1f" size="small" />
            ) : (
              <>
                <Ionicons name="logo-google" size={22} color="#4285F4" />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <Text style={styles.legal}>
          By continuing, you agree to use Kak Fit with your Google account.
        </Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: {
      flexGrow: 1,
      justifyContent: "center",
      padding: spacing.xl,
      gap: spacing.xl,
    },
    logoSection: { alignItems: "center", marginBottom: spacing.sm },
    copy: { gap: spacing.sm, alignItems: "center" },
    heading: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
    },
    subheading: {
      fontSize: 16,
      lineHeight: 22,
      color: colors.textMuted,
      textAlign: "center",
      maxWidth: 320,
    },
    actions: { gap: spacing.md },
    googleButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: "#fff",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      minHeight: 52,
      paddingHorizontal: spacing.lg,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
        },
        android: { elevation: 2 },
        default: {},
      }),
    },
    googleButtonPressed: { opacity: 0.92 },
    googleButtonDisabled: { opacity: 0.7 },
    googleButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: "#1f1f1f",
    },
    error: {
      color: colors.danger,
      fontSize: 14,
      textAlign: "center",
    },
    legal: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
      textAlign: "center",
      paddingHorizontal: spacing.md,
    },
  });
