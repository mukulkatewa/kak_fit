import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BoltIcon } from "react-native-heroicons/solid";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BUTTON_HEIGHT_PRIMARY } from "../src/lib/layout-constants";
import { useSpringPress } from "../src/lib/animations";
import { useAuth } from "../src/lib/auth-context";
import { useResponsive } from "../src/lib/responsive";
import { radius, spacing, typography, useTheme } from "../src/lib/theme";

function GoogleButton({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  const { isDark, colors } = useTheme();
  const { scale, onPressIn, onPressOut } = useSpringPress();
  const buttonBg = isDark ? colors.surface : colors.text;
  const textColor = isDark ? colors.text : colors.bg;

  return (
    <Animated.View entering={FadeInUp.delay(120).duration(280)} style={scale}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        disabled={loading}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          styles.googleButton,
          { backgroundColor: buttonBg, borderColor: colors.border },
          loading && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : (
          <>
            <Ionicons name="logo-google" size={20} color="#4285F4" />
            <Text style={[styles.googleText, { color: textColor }]}>Continue with Google</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useResponsive();
  const { signInWithGoogle } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      if (Platform.OS !== "web") router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.inner,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.lg,
            paddingHorizontal: horizontalPadding,
          },
        ]}
      >
        <Animated.View entering={FadeIn.duration(240)} style={styles.hero}>
          <View style={[styles.logoMark, { backgroundColor: colors.accentMuted }]}>
            <BoltIcon color={colors.accent} size={32} />
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>Kak Fit</Text>
          <Text style={[styles.tagline, { color: colors.textMuted }]}>
            Track workouts, nutrition, and progress in one place.
          </Text>
        </Animated.View>

        <View style={styles.footer}>
          <Text style={[styles.heading, { color: colors.text }]}>Get started</Text>
          <Text style={[styles.subheading, { color: colors.textMuted }]}>
            Sign in or create an account with Google.
          </Text>

          <GoogleButton loading={loading} onPress={handleGoogleSignIn} />

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.dangerMuted }]}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            </View>
          ) : null}

          <Text style={[styles.legal, { color: colors.textDim }]}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...Platform.select({
      web: {
        height: "100%",
        overflow: "hidden",
      },
    }),
  },
  inner: {
    flex: 1,
    justifyContent: "space-between",
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
  hero: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
    minHeight: 0,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  appName: {
    ...typography.h1,
    textAlign: "center",
  },
  tagline: {
    ...typography.body,
    textAlign: "center",
    maxWidth: 300,
    lineHeight: 22,
  },
  footer: {
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  heading: {
    ...typography.h2,
  },
  subheading: {
    ...typography.bodySmall,
    marginBottom: spacing.xs,
  },
  googleButton: {
    minHeight: BUTTON_HEIGHT_PRIMARY,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  disabled: { opacity: 0.65 },
  googleText: { ...typography.button },
  errorBox: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { flex: 1, ...typography.caption, fontWeight: "600" },
  legal: {
    ...typography.caption,
    textAlign: "center",
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});
