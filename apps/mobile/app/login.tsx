import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { BoltIcon } from "react-native-heroicons/solid";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSpringPress } from "../src/lib/animations";
import { useAuth } from "../src/lib/auth-context";
import { radius, spacing, useTheme, type Palette } from "../src/lib/theme";

const DARK_BG = ["#04070D", "#07111F", "#020304"] as const;
const LIGHT_BG = ["#F7FBF4", "#EAF6EA", "#F6F8F1"] as const;
const DARK_PANEL = "rgba(255,255,255,0.08)";
const LIGHT_PANEL = "rgba(255,255,255,0.78)";

function BrandMark({ colors, isDark }: { colors: Palette; isDark: boolean }) {
  return (
    <View style={styles.brandRow}>
      <View
        style={[
          styles.brandIcon,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(61,181,74,0.12)",
            borderColor: isDark ? "rgba(255,255,255,0.16)" : "rgba(61,181,74,0.18)",
          },
        ]}
      >
        <BoltIcon color={colors.accent} size={24} />
      </View>
      <Text style={[styles.brandText, { color: colors.text }]}>Kak Fit</Text>
    </View>
  );
}

function AnimatedGrid({ isDark }: { isDark: boolean }) {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4200 }),
        withTiming(0, { duration: 4200 }),
      ),
      -1,
      true,
    );
  }, [drift]);

  const gridStyle = useAnimatedStyle(() => ({
    opacity: isDark ? 0.22 + drift.value * 0.1 : 0.28 + drift.value * 0.08,
    transform: [{ translateY: drift.value * 10 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.gridBackdrop, gridStyle]}>
      {Array.from({ length: 9 }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.gridLine,
            {
              top: `${12 + index * 10}%`,
              backgroundColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(12,26,14,0.1)",
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

function MetricStrip({ colors, isDark }: { colors: Palette; isDark: boolean }) {
  const metrics = useMemo(
    () => [
      { value: "18.4k", label: "kg" },
      { value: "42", label: "sets" },
      { value: "7", label: "PRs" },
    ],
    [],
  );

  return (
    <View
      style={[
        styles.metricStrip,
        {
          backgroundColor: isDark ? "rgba(0,0,0,0.32)" : "rgba(255,255,255,0.72)",
          borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
        },
      ]}
    >
      {metrics.map((metric, index) => (
        <View key={metric.label} style={styles.metricItem}>
          <Text style={[styles.metricValue, { color: colors.text }]}>{metric.value}</Text>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{metric.label}</Text>
          {index < metrics.length - 1 ? <View style={[styles.metricDivider, { backgroundColor: colors.border }]} /> : null}
        </View>
      ))}
    </View>
  );
}

function WorkoutPreview({ colors, isDark }: { colors: Palette; isDark: boolean }) {
  const lift = useSharedValue(0);
  const glow = useSharedValue(0.35);

  useEffect(() => {
    lift.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 2400 }),
          withTiming(0, { duration: 2400 }),
        ),
        -1,
        true,
      ),
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(0.72, { duration: 1800 }),
        withTiming(0.35, { duration: 1800 }),
      ),
      -1,
      true,
    );
  }, [glow, lift]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <Animated.View entering={FadeInDown.delay(180).springify().damping(18)} style={styles.previewWrap}>
      <Animated.View style={[styles.previewGlow, { backgroundColor: colors.accent }, glowStyle]} />
      <Animated.View
        style={[
          styles.previewPanel,
          {
            backgroundColor: isDark ? "rgba(12,16,24,0.88)" : "rgba(255,255,255,0.9)",
            borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)",
          },
          floatStyle,
        ]}
      >
        <View style={styles.previewHeader}>
          <View>
            <Text style={[styles.previewKicker, { color: colors.textMuted }]}>ACTIVE WORKOUT</Text>
            <Text style={[styles.previewTitle, { color: colors.text }]}>Push Strength</Text>
          </View>
          <View style={[styles.liveBadge, { backgroundColor: colors.accentMuted }]}> 
            <View style={[styles.liveDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.liveText, { color: colors.accent }]}>Live</Text>
          </View>
        </View>

        <MetricStrip colors={colors} isDark={isDark} />

        {[
          { name: "Incline Press", value: "32 kg x 10", done: true },
          { name: "Cable Fly", value: "18 kg x 14", done: true },
          { name: "Triceps Press", value: "22 kg x 12", done: false },
        ].map((row, index) => (
          <View key={row.name} style={[styles.previewRow, { borderColor: colors.borderSubtle }]}>
            <View style={[styles.setNumber, { backgroundColor: row.done ? colors.accent : colors.surface }]}> 
              <Text style={[styles.setNumberText, { color: row.done ? colors.onAccent : colors.textMuted }]}>
                {index + 1}
              </Text>
            </View>
            <View style={styles.previewRowBody}>
              <Text style={[styles.previewRowTitle, { color: colors.text }]} numberOfLines={1}>
                {row.name}
              </Text>
              <Text style={[styles.previewRowSub, { color: colors.textMuted }]}>{row.value}</Text>
            </View>
            <Ionicons
              name={row.done ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={row.done ? colors.success : colors.textDim}
            />
          </View>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

function GoogleSignInButton({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  const { colors, isDark } = useTheme();
  const { scale, onPressIn, onPressOut } = useSpringPress();

  return (
    <Animated.View entering={FadeInUp.delay(620).springify().damping(18)} style={[scale, styles.buttonWrap]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={loading}
        style={[
          styles.googleButton,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.96)" : "#111511",
            borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.08)",
          },
          loading && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isDark ? "#0A0A0A" : "#FFFFFF"} size="small" />
        ) : (
          <>
            <View style={styles.googleIconBox}>
              <Ionicons name="logo-google" size={21} color="#4285F4" />
            </View>
            <Text style={[styles.googleButtonText, { color: isDark ? "#0A0A0A" : "#FFFFFF" }]}>Continue with Google</Text>
          </>
        )}
      </Pressable>
      <Text style={[styles.securityText, { color: colors.textMuted }]}>Secure sign in. No paywall in the demo build.</Text>
    </Animated.View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { signInWithGoogle } = useAuth();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compact = height < 720;
  const horizontalPad = width < 380 ? spacing.lg : 24;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      if (Platform.OS !== "web") {
        router.replace("/(tabs)");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(500)} style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[...(isDark ? DARK_BG : LIGHT_BG)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <AnimatedGrid isDark={isDark} />
      <View
        pointerEvents="none"
        style={[
          styles.diagonalPlate,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(61,181,74,0.1)",
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(61,181,74,0.12)",
          },
        ]}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + (compact ? spacing.lg : 34),
            paddingBottom: insets.bottom + spacing.xl,
            paddingHorizontal: horizontalPad,
            gap: compact ? spacing.md : spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(80).springify().damping(18)}>
          <BrandMark colors={colors} isDark={isDark} />
        </Animated.View>

        <View style={styles.heroBlock}>
          <Animated.Text entering={FadeInDown.delay(220).springify().damping(18)} style={[styles.headline, { color: colors.text }]}>
            Train with a logbook that keeps up.
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(320).springify().damping(18)} style={[styles.subhead, { color: colors.textMuted }]}>
            Start faster, finish cleaner, and see the numbers that matter every session.
          </Animated.Text>
        </View>

        <WorkoutPreview colors={colors} isDark={isDark} />

        <Animated.View
          entering={FadeInUp.delay(520).springify().damping(18)}
          style={[
            styles.authPanel,
            {
              backgroundColor: isDark ? DARK_PANEL : LIGHT_PANEL,
              borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
            },
          ]}
        >
          <View style={styles.authHeader}>
            <Text style={[styles.authTitle, { color: colors.text }]}>Welcome back</Text>
            <Text style={[styles.authSubtitle, { color: colors.textMuted }]}>Use your Google account to continue.</Text>
          </View>

          <GoogleSignInButton onPress={handleGoogleSignIn} loading={loading} />

          {error ? (
            <Animated.View
              entering={FadeIn.duration(220)}
              style={[styles.errorBox, { backgroundColor: colors.dangerMuted, borderColor: colors.dangerMuted }]}
            >
              <Ionicons name="alert-circle" size={17} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            </Animated.View>
          ) : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  gridBackdrop: {
    transform: [{ rotate: "-9deg" }, { scale: 1.18 }],
  },
  gridLine: {
    position: "absolute",
    left: "-12%",
    right: "-12%",
    height: 1,
  },
  diagonalPlate: {
    position: "absolute",
    top: "9%",
    right: "-34%",
    width: "82%",
    height: "48%",
    borderWidth: 1,
    borderRadius: 42,
    transform: [{ rotate: "-18deg" }],
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0,
  },
  heroBlock: {
    gap: spacing.sm,
    maxWidth: 560,
  },
  headline: {
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "900",
    letterSpacing: 0,
  },
  subhead: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "500",
  },
  previewWrap: {
    minHeight: 322,
    justifyContent: "center",
  },
  previewGlow: {
    position: "absolute",
    left: 28,
    right: 28,
    top: 38,
    bottom: 30,
    borderRadius: 32,
    opacity: 0.35,
    transform: [{ scale: 0.98 }],
    ...Platform.select({
      web: { boxShadow: "0 24px 70px rgba(61,181,74,0.32)" },
      default: {},
    }),
  },
  previewPanel: {
    borderWidth: 1,
    borderRadius: 30,
    padding: spacing.lg,
    gap: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
      },
      android: { elevation: 10 },
      web: { boxShadow: "0 22px 60px rgba(0,0,0,0.22)" },
      default: {},
    }),
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  previewKicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0,
  },
  previewTitle: {
    marginTop: 3,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontSize: 12, fontWeight: "800" },
  metricStrip: {
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: spacing.md,
    flexDirection: "row",
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: { fontSize: 18, fontWeight: "800" },
  metricLabel: { marginTop: 2, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  metricDivider: { position: "absolute", right: 0, width: StyleSheet.hairlineWidth, top: 8, bottom: 8 },
  previewRow: {
    minHeight: 58,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  setNumber: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  setNumberText: { fontSize: 14, fontWeight: "800" },
  previewRowBody: { flex: 1, minWidth: 0 },
  previewRowTitle: { fontSize: 15, fontWeight: "800" },
  previewRowSub: { marginTop: 2, fontSize: 13, fontWeight: "600" },
  authPanel: {
    borderWidth: 1,
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.lg,
    marginTop: "auto",
  },
  authHeader: { gap: 4 },
  authTitle: { fontSize: 22, fontWeight: "800" },
  authSubtitle: { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  buttonWrap: { gap: spacing.md },
  googleButton: {
    minHeight: 58,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  disabled: { opacity: 0.65 },
  googleIconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonText: { fontSize: 16, fontWeight: "800" },
  securityText: { textAlign: "center", fontSize: 12, lineHeight: 17, fontWeight: "500" },
  errorBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "600" },
});
