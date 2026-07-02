import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BoltIcon } from "react-native-heroicons/solid";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSpringPress } from "../src/lib/animations";
import { useAuth } from "../src/lib/auth-context";
import { useResponsive } from "../src/lib/responsive";
import { spacing, typography, useTheme } from "../src/lib/theme";

const DARK_BG = ["#05070B", "#07111C", "#020304"] as const;
const LIGHT_BG = ["#F8FAF6", "#ECF6EE", "#F8FAF6"] as const;

function AmbientMark() {
  const { ambientRingSize } = useResponsive();
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(0.32);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 22000 }), -1, false);
    opacity.value = withRepeat(
      withSequence(withTiming(0.52, { duration: 1800 }), withTiming(0.26, { duration: 1800 })),
      -1,
      true,
    );
  }, [opacity, rotation]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ambientRing,
        {
          width: ambientRingSize,
          height: ambientRingSize,
          borderRadius: ambientRingSize / 2,
        },
        ringStyle,
      ]}
    >
      <View
        style={[
          styles.ambientCutout,
          {
            left: ambientRingSize * 0.133,
            top: ambientRingSize * 0.133,
            right: ambientRingSize * 0.133,
            bottom: ambientRingSize * 0.133,
            borderRadius: ambientRingSize * 0.367,
          },
        ]}
      />
    </Animated.View>
  );
}

function GoogleButton({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  const { isDark } = useTheme();
  const { scale, onPressIn, onPressOut } = useSpringPress();
  const buttonBg = isDark ? "#FFFFFF" : "#111511";
  const textColor = isDark ? "#0A0A0A" : "#FFFFFF";

  return (
    <Animated.View entering={FadeInUp.delay(280).springify().damping(18)} style={scale}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        disabled={loading}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.googleButton, { backgroundColor: buttonBg }, loading && styles.disabled]}
      >
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : (
          <>
            <View style={styles.googleIcon}>
              <Ionicons name="logo-google" size={21} color="#4285F4" />
            </View>
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
  const {
    horizontalPadding,
    isCompact,
    loginTitleSize,
    loginTitleLineHeight,
    loginOrbSize,
    ambientRingSize,
  } = useResponsive();
  const { signInWithGoogle } = useAuth();
  const { colors, isDark } = useTheme();
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
      <Animated.View entering={FadeIn.duration(320)} style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[...(isDark ? DARK_BG : LIGHT_BG)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <AmbientMark />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + (isCompact ? spacing.lg : spacing.xl),
            paddingBottom: insets.bottom + spacing.xl,
            paddingHorizontal: horizontalPadding,
          },
        ]}
      >
        <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} style={styles.brandRow}>
          <View
            style={[
              styles.brandIcon,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(61,181,74,0.12)",
                borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(61,181,74,0.18)",
              },
            ]}
          >
            <BoltIcon color={colors.accent} size={24} />
          </View>
          <Text style={[styles.brandText, { color: colors.text }]}>Kak Fit</Text>
        </Animated.View>

        <View style={styles.centerBlock}>
          <Animated.View
            entering={FadeInDown.delay(160).springify().damping(18)}
            style={[
              styles.logoOrb,
              {
                width: loginOrbSize,
                height: loginOrbSize,
                borderRadius: loginOrbSize * 0.29,
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#FFFFFF",
                borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.06)",
              },
            ]}
          >
            <BoltIcon color={colors.accent} size={loginOrbSize * 0.47} />
          </Animated.View>
          <Animated.Text
            entering={FadeInDown.delay(210).springify().damping(18)}
            style={[
              styles.title,
              {
                color: colors.text,
                fontSize: loginTitleSize,
                lineHeight: loginTitleLineHeight,
              },
            ]}
          >
            Kak Fit
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(250).springify().damping(18)} style={[styles.subtitle, { color: colors.textMuted }]}>Sign in</Animated.Text>
        </View>

        <View style={styles.bottomBlock}>
          <GoogleButton loading={loading} onPress={handleGoogleSignIn} />
          {error ? (
            <Animated.View entering={FadeIn.duration(180)} style={[styles.errorBox, { backgroundColor: colors.dangerMuted }]}>
              <Ionicons name="alert-circle" size={17} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            </Animated.View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  ambientRing: {
    position: "absolute",
    top: "18%",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "rgba(10,132,255,0.45)",
  },
  ambientCutout: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(48,209,88,0.22)",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: { fontSize: 24, lineHeight: 30, fontWeight: "800", letterSpacing: 0 }, // custom: compact brand lockup
  centerBlock: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  logoOrb: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: { shadowColor: "#0A84FF", shadowOpacity: 0.26, shadowRadius: 28, shadowOffset: { width: 0, height: 14 } },
      android: { elevation: 10 },
      web: { boxShadow: "0 22px 70px rgba(10,132,255,0.24)" },
      default: {},
    }),
  },
  title: { fontWeight: "900", letterSpacing: 0, textAlign: "center" }, // fontSize via useResponsive()
  subtitle: { ...typography.body, fontWeight: "700", textAlign: "center" },
  bottomBlock: { gap: spacing.md },
  googleButton: {
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  disabled: { opacity: 0.65 },
  googleIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  googleText: { ...typography.button },
  errorBox: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", borderRadius: 14, padding: spacing.md },
  errorText: { flex: 1, ...typography.caption, fontWeight: "600" },
});
