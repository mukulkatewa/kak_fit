import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../src/lib/auth-context";
import { BrandMark, Button, Card, Input, Subtitle, Title } from "../src/components/ui";
import { colors, spacing } from "../src/lib/theme";

const DEMO_EMAIL = "demo@kakfit.app";
const DEMO_PASSWORD = "password123";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (useDemo = false) => {
    const loginEmail = useDemo ? DEMO_EMAIL : email.trim().toLowerCase();
    const loginPassword = useDemo ? DEMO_PASSWORD : password;

    if (!useDemo && (!loginEmail || !loginPassword || (mode === "signup" && !name))) {
      setError("Fill in all required fields.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (mode === "signup" && !useDemo) {
        await signUp(name.trim(), loginEmail, loginPassword);
      } else {
        await signIn(loginEmail, loginPassword);
      }
      router.replace("/(tabs)");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setMode("signin");
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <BrandMark />
            <Title>{mode === "signin" ? "Welcome back" : "Join Kak Fit"}</Title>
            <Subtitle>Train smarter. Track everything. Pay nothing.</Subtitle>
          </View>

          <Card glow>
            {mode === "signup" ? (
              <Input placeholder="Your name" value={name} onChangeText={setName} autoCapitalize="words" />
            ) : null}
            <Input
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Input
              placeholder="Password (min 8 chars)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              label={mode === "signin" ? "Sign In" : "Create Account"}
              icon={mode === "signin" ? "log-in-outline" : "person-add-outline"}
              fullWidth
              onPress={() => submit(false)}
              loading={loading}
            />
            <Button
              label="Try Demo Account"
              icon="flash-outline"
              variant="gold"
              fullWidth
              onPress={() => submit(true)}
              loading={loading}
            />
            <Button
              label={mode === "signin" ? "New here? Create account" : "Already have an account?"}
              variant="ghost"
              fullWidth
              onPress={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
            />
          </Card>

          <Text style={styles.demoHint} onPress={fillDemo}>
            Demo: {DEMO_EMAIL} / {DEMO_PASSWORD}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, overflow: "hidden" },
  glowTop: {
    position: "absolute",
    top: -100,
    left: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.accentMuted,
    opacity: 0.7,
  },
  glowBottom: {
    position: "absolute",
    bottom: -80,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.successMuted,
    opacity: 0.4,
  },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.xl,
  },
  hero: { gap: spacing.sm, alignItems: "center" },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
  demoHint: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
