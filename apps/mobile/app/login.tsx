import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { signIn, signUp } from "../src/lib/auth";
import { BrandMark, Button, Card, Input, Subtitle, Title } from "../src/components/ui";
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
    <View style={styles.container}>
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
            <Button
              label={mode === "signin" ? "Sign In" : "Create Account"}
              icon={mode === "signin" ? "log-in-outline" : "person-add-outline"}
              onPress={submit}
              loading={loading}
            />
            <Button
              label={mode === "signin" ? "New here? Create account" : "Already have an account?"}
              variant="ghost"
              onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
            />
          </Card>

          <Text style={styles.demoHint}>
            Demo: demo@kakfit.app / password123
          </Text>
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
  hero: { gap: spacing.sm, alignItems: "center" },
  demoHint: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
