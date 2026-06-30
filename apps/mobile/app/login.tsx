import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState, type FC } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BeakerIcon } from "react-native-heroicons/outline";
import { ArrowTrendingUpIcon } from "react-native-heroicons/outline";
import { FireIcon } from "react-native-heroicons/outline";
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
import { useTheme } from "../src/lib/theme";

const PARTICLES = [
  { left: "12%", top: "18%", size: 10, drift: 2800 },
  { left: "78%", top: "12%", size: 8, drift: 3400 },
  { left: "65%", top: "38%", size: 12, drift: 4200 },
  { left: "22%", top: "52%", size: 9, drift: 3600 },
  { left: "88%", top: "58%", size: 11, drift: 3000 },
  { left: "40%", top: "72%", size: 8, drift: 3800 },
] as const;

const GRADIENT_DARK = ["#0A0E21", "#1A1040", "#0D1B2A"] as const;
const GRADIENT_LIGHT = ["#E8F5E9", "#C8E6C9", "#A5D6A7"] as const;

type FeatureIcon = FC<{ color?: string; size?: number }>;

function FloatingParticle({
  left,
  top,
  size,
  accentColor,
  drift,
}: {
  left: `${number}%`;
  top: `${number}%`;
  size: number;
  accentColor: string;
  drift: number;
}) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-18, { duration: drift }),
        withTiming(18, { duration: drift }),
      ),
      -1,
      true,
    );
  }, [drift, translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left,
          top,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: accentColor,
          opacity: 0.15,
        },
        style,
      ]}
    />
  );
}

function GlassFeatureCard({
  Icon,
  title,
  description,
  index,
  isDark,
  textColor,
  mutedColor,
  accentColor,
}: {
  Icon: FeatureIcon;
  title: string;
  description: string;
  index: number;
  isDark: boolean;
  textColor: string;
  mutedColor: string;
  accentColor: string;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(600 + index * 120)
        .springify()
        .damping(16)}
      style={[
        styles.featureCard,
        {
          backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.6)",
          borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.85)",
        },
      ]}
    >
      <View
        style={[
          styles.featureIconContainer,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.85)",
          },
        ]}
      >
        <Icon color={accentColor} size={22} />
      </View>
      <View style={styles.featureTextContainer}>
        <Text style={[styles.featureTitle, { color: textColor }]}>{title}</Text>
        <Text style={[styles.featureDescription, { color: mutedColor }]}>{description}</Text>
      </View>
    </Animated.View>
  );
}

function GoogleSignInButton({
  onPress,
  loading,
  isDark,
  accentColor,
  textColor,
}: {
  onPress: () => void;
  loading: boolean;
  isDark: boolean;
  accentColor: string;
  textColor: string;
}) {
  const { scale, onPressIn, onPressOut } = useSpringPress();

  return (
    <Animated.View
      entering={FadeInUp.delay(1000).springify()}
      style={[
        scale,
        styles.googleButtonShadow,
        Platform.select({
          ios: {
            shadowColor: accentColor,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 14,
          },
          android: { elevation: 6 },
          default: {},
        }),
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={loading}
        style={[
          styles.googleButton,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "#FFFFFF",
            borderColor: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.06)",
          },
          loading && styles.googleButtonDisabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : (
          <>
            <View style={styles.googleIconContainer}>
              <Ionicons name="logo-google" size={22} color="#4285F4" />
            </View>
            <Text style={[styles.googleButtonText, { color: textColor }]}>
              Continue with Google
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithGoogle } = useAuth();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // On native, signInWithGoogle resolves after session completion
      if (Platform.OS !== "web") {
        router.replace("/(tabs)");
      }
      // On web, the page redirects to Google — no further action needed
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed";
      setError(message);
    } finally {
      // Always clear loading state on both platforms
      setLoading(false);
    }
  };

  const gradientColors = isDark ? GRADIENT_DARK : GRADIENT_LIGHT;
  const headlineColor = isDark ? "#FFFFFF" : "#1A2E1A";
  const mutedColor = isDark ? "rgba(255,255,255,0.72)" : "rgba(26,46,26,0.72)";
  const subduedColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(26,46,26,0.55)";

  const features: Array<{
    Icon: FeatureIcon;
    title: string;
    description: string;
  }> = [
    {
      Icon: FireIcon,
      title: "Track Workouts",
      description: "Log every set, rep, and weight with precision",
    },
    {
      Icon: ArrowTrendingUpIcon,
      title: "See Progress",
      description: "Charts and PRs that show your growth",
    },
    {
      Icon: BeakerIcon,
      title: "Nutrition",
      description: "Track macros and meals to fuel your gains",
    },
  ];

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(700)} style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[...gradientColors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {PARTICLES.map((particle, index) => (
          <FloatingParticle
            key={index}
            left={particle.left}
            top={particle.top}
            size={particle.size}
            accentColor={colors.accent}
            drift={particle.drift}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.delay(200).springify().damping(16)}
          style={styles.logoSection}
        >
          <View
            style={[
              styles.logoContainer,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(255,255,255,0.55)",
                borderColor: isDark
                  ? "rgba(255,255,255,0.2)"
                  : "rgba(255,255,255,0.9)",
              },
            ]}
          >
            <BoltIcon color={colors.accent} size={44} />
          </View>
        </Animated.View>

        <Animated.Text
          entering={FadeInDown.delay(400).springify().damping(16)}
          style={[styles.appName, { color: headlineColor }]}
        >
          Kak Fit
        </Animated.Text>

        <Animated.Text
          entering={FadeInDown.delay(480).springify().damping(16)}
          style={[styles.tagline, { color: mutedColor }]}
        >
          Your personal fitness companion
        </Animated.Text>

        <View style={styles.featuresSection}>
          {features.map((feature, index) => (
            <GlassFeatureCard
              key={feature.title}
              Icon={feature.Icon}
              title={feature.title}
              description={feature.description}
              index={index}
              isDark={isDark}
              textColor={headlineColor}
              mutedColor={mutedColor}
              accentColor={colors.accent}
            />
          ))}
        </View>

        <View style={styles.signInSection}>
          <Animated.View entering={FadeInUp.delay(900).springify()} style={styles.dividerRow}>
            <View
              style={[
                styles.dividerLine,
                { backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)" },
              ]}
            />
            <Text style={[styles.dividerText, { color: mutedColor }]}>Get started</Text>
            <View
              style={[
                styles.dividerLine,
                { backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)" },
              ]}
            />
          </Animated.View>

          <GoogleSignInButton
            onPress={handleGoogleSignIn}
            loading={loading}
            isDark={isDark}
            accentColor={colors.accent}
            textColor={headlineColor}
          />

          {error ? (
            <Animated.View
              entering={FadeIn.duration(300)}
              style={[
                styles.errorContainer,
                {
                  backgroundColor: isDark
                    ? "rgba(255,80,80,0.15)"
                    : colors.dangerMuted,
                },
              ]}
            >
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            </Animated.View>
          ) : null}

          <Animated.Text
            entering={FadeIn.delay(1200).duration(500)}
            style={[styles.legal, { color: subduedColor }]}
          >
            By continuing, you agree to our Terms of Service and Privacy Policy. Your Google
            account will be used to securely sign you in.
          </Animated.Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 28,
  },
  logoSection: {
    alignItems: "center",
    marginTop: 12,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: -0.8,
    textAlign: "center",
  },
  tagline: {
    fontSize: 16,
    fontWeight: "400",
    letterSpacing: 0.6,
    textAlign: "center",
    marginTop: -16,
  },
  featuresSection: {
    gap: 12,
    marginTop: 4,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTextContainer: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  featureDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  signInSection: {
    gap: 18,
    marginTop: 4,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  googleButtonShadow: {
    borderRadius: 16,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    height: 60,
    paddingHorizontal: 20,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  googleButtonText: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  legal: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    paddingHorizontal: 12,
    letterSpacing: 0.2,
  },
});
