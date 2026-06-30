import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../src/lib/auth-context";
import { useThemedStyles, useTheme, spacing, radius, type Palette } from "../src/lib/theme";


function AnimatedFeatureCard({
  icon,
  title,
  description,
  delay,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  delay: number;
  colors: Palette;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, delay]);

  return (
    <Animated.View
      style={[
        styles.featureCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderSubtle,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.featureIconContainer, { backgroundColor: colors.accentMuted }]}>
        <Ionicons name={icon} size={20} color={colors.accent} />
      </View>
      <View style={styles.featureTextContainer}>
        <Text style={[styles.featureTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.featureDescription, { color: colors.textMuted }]}>{description}</Text>
      </View>
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

  // Animations
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const buttonSlide = useRef(new Animated.Value(30)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(buttonSlide, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [logoScale, logoOpacity, contentOpacity, buttonSlide, buttonOpacity]);

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
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      setError(message);
    } finally {
      if (Platform.OS !== "web") {
        setLoading(false);
      }
    }
  };

  const features = [
    {
      icon: "barbell-outline" as const,
      title: "Track Workouts",
      description: "Log every set, rep, and weight with precision",
    },
    {
      icon: "trending-up-outline" as const,
      title: "See Progress",
      description: "Charts and PRs that show your growth",
    },
    {
      icon: "nutrition-outline" as const,
      title: "Nutrition",
      description: "Track macros and meals to fuel your gains",
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo Section */}
        <Animated.View
          style={[
            styles.logoSection,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <View style={[styles.logoContainer, { backgroundColor: colors.accent }]}>
            <Ionicons name="barbell" size={40} color="#FFFFFF" />
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>Kak Fit</Text>
          <Text style={[styles.tagline, { color: colors.textMuted }]}>
            Your personal fitness companion
          </Text>
        </Animated.View>

        {/* Features */}
        <Animated.View style={[styles.featuresSection, { opacity: contentOpacity }]}>
          {features.map((feature, index) => (
            <AnimatedFeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              delay={800 + index * 150}
              colors={colors}
            />
          ))}
        </Animated.View>

        {/* Sign In Section */}
        <Animated.View
          style={[
            styles.signInSection,
            {
              opacity: buttonOpacity,
              transform: [{ translateY: buttonSlide }],
            },
          ]}
        >
          <View style={[styles.dividerRow]}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textMuted }]}>
              Get started
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <Pressable
            onPress={handleGoogleSignIn}
            disabled={loading}
            style={({ pressed }) => [
              styles.googleButton,
              {
                backgroundColor: isDark ? colors.surface : "#FFFFFF",
                borderColor: colors.border,
              },
              pressed && styles.googleButtonPressed,
              loading && styles.googleButtonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <>
                <View style={styles.googleIconContainer}>
                  {/* Google "G" logo colors */}
                  <Ionicons name="logo-google" size={20} color="#4285F4" />
                </View>
                <Text style={[styles.googleButtonText, { color: isDark ? colors.text : "#1f1f1f" }]}>
                  Continue with Google
                </Text>
              </>
            )}
          </Pressable>

          {error ? (
            <View style={[styles.errorContainer, { backgroundColor: colors.dangerMuted }]}>
              <Ionicons name="alert-circle" size={16} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            </View>
          ) : null}

          <Text style={[styles.legal, { color: colors.textDim }]}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
            Your Google account will be used to securely sign you in.
          </Text>
        </Animated.View>
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
    gap: 32,
  },

  // Logo
  logoSection: {
    alignItems: "center",
    gap: 12,
    marginTop: 20,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#3DB54A",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  appName: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 8,
  },
  tagline: {
    fontSize: 16,
    fontWeight: "400",
    letterSpacing: 0.2,
  },

  // Features
  featuresSection: {
    gap: 12,
    marginTop: 8,
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
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTextContainer: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  featureDescription: {
    fontSize: 13,
    lineHeight: 18,
  },

  // Sign In
  signInSection: {
    gap: 16,
    marginTop: 8,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 56,
    paddingHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  googleButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
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
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.1,
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
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 16,
  },
});
