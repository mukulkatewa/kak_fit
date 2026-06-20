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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../src/lib/auth-context";
import { BrandMark, Button, HevyButton, Input } from "../src/components/ui";
import { colors, spacing } from "../src/lib/theme";

const DEMO_EMAIL = "demo@kakfit.app";
const DEMO_PASSWORD = "password123";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logoSection}>
            <BrandMark large />
          </View>

          <Text style={styles.heading}>{mode === "signin" ? "Sign in" : "Create account"}</Text>

          <View style={styles.form}>
            {mode === "signup" ? (
              <Input placeholder="Name" value={name} onChangeText={setName} autoCapitalize="words" />
            ) : null}
            <Input
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Input
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <HevyButton
              label={mode === "signin" ? "Sign In" : "Create Account"}
              onPress={() => submit(false)}
              loading={loading}
            />
            <HevyButton
              label="Try Demo Account"
              variant="secondary"
              onPress={() => submit(true)}
              loading={loading}
            />
          </View>

          <Button
            label={mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            variant="ghost"
            fullWidth
            onPress={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.xl,
  },
  logoSection: { alignItems: "center", marginBottom: spacing.md },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  form: { gap: spacing.md },
  error: {
    color: colors.danger,
    fontSize: 14,
    textAlign: "center",
  },
});
