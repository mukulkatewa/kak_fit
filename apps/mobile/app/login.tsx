import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { signIn, signUp } from "../src/lib/auth";
import { Button, Input, Screen, Subtitle, Title } from "../src/components/ui";
import { colors, spacing } from "../src/lib/theme";

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password || (mode === "signup" && !name)) {
      Alert.alert("Missing fields", "Fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp(name.trim(), email.trim().toLowerCase(), password);
      } else {
        await signIn(email.trim().toLowerCase(), password);
      }
      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.badge}>KAK FIT</Text>
          <Title>{mode === "signin" ? "Welcome back" : "Create account"}</Title>
          <Subtitle>Log workouts, build routines, track PRs.</Subtitle>

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
            <Button
              label={mode === "signin" ? "Sign In" : "Sign Up"}
              onPress={submit}
              loading={loading}
            />
            <Button
              label={mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
              onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
              variant="secondary"
            />
          </View>

          <Text style={styles.demoHint}>
            Demo: demo@kakfit.app / password123 (after running pnpm db:seed)
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", gap: spacing.md, paddingVertical: spacing.xl },
  badge: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 4,
  },
  form: { gap: spacing.sm, marginTop: spacing.lg },
  demoHint: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
