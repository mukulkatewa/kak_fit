import { useRouter } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Screen } from "../src/components/ui";
import { HevyStackHeader } from "../src/components/hevy-ui";
import { trpc } from "../src/lib/trpc";
import { getApiUrl } from "../src/lib/api-client";
import { radius, spacing, useTheme, useThemedStyles, type Palette } from "../src/lib/theme";

type LlmId = "gemini" | "claude" | "chatgpt";

const LLM_OPTIONS: { id: LlmId; name: string; destination: string }[] = [
  { id: "gemini", name: "Gemini", destination: "gemini.google.com or the Gemini app" },
  { id: "claude", name: "Claude", destination: "claude.ai" },
  { id: "chatgpt", name: "ChatGPT", destination: "chatgpt.com" },
];

function briefPrompt(id: LlmId) {
  if (id === "gemini") {
    return "You are a fitness assistant with access to my Kak Fit REST API. Use exercise_name when adding to routines. Send the api-key header on every request.";
  }
  return "You are a fitness assistant with access to my Kak Fit REST API. Confirm with me before delete_routine or delete_exercise_from_routine.";
}

function buildSetupMessage(apiKey: string, apiBase: string, id: LlmId) {
  const intro = `You have access to my Kak Fit account via API key: ${apiKey}. Base URL: ${apiBase}. Auth header: api-key: ${apiKey}. ${briefPrompt(id)}`;
  return `${intro}\n\nThen try:\n• "Show me my recent workouts"\n• "Add Romanian deadlifts 3x12 to my Leg Day routine"`;
}

export default function DeveloperApiScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const utils = trpc.useUtils();
  const { data: keys, isLoading } = trpc.developer.listKeys.useQuery();
  const [keyName, setKeyName] = useState("Gemini");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [expandedLlm, setExpandedLlm] = useState<LlmId | null>(null);

  const createKey = trpc.developer.createKey.useMutation({
    onSuccess: (data) => {
      setRevealedKey(data.apiKey);
      utils.developer.listKeys.invalidate();
    },
    onError: (e) => Alert.alert("Could not create key", e.message),
  });

  const revokeKey = trpc.developer.revokeKey.useMutation({
    onSuccess: () => utils.developer.listKeys.invalidate(),
    onError: (e) => Alert.alert("Could not revoke key", e.message),
  });

  const baseUrl = getApiUrl();
  const apiBase = `${baseUrl}/api/v1`;
  const keyForSetup = revealedKey ?? (keys?.[0] ? `${keys[0].keyPrefix}…` : null);

  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    Alert.alert("Copied", "Copied to clipboard");
  };

  const copyApiKey = () => {
    if (revealedKey) {
      void copy(revealedKey);
      return;
    }
    Alert.alert(
      "Full key not available",
      "API keys are only shown once when created. Generate a new key above, or use the key you saved when you first created it.",
    );
  };

  const copySetupMessage = (id: LlmId) => {
    if (!keyForSetup) {
      Alert.alert("No API key", "Generate an API key above first.");
      return;
    }
    void copy(buildSetupMessage(keyForSetup, apiBase, id));
  };

  return (
    <Screen scroll>
      <HevyStackHeader title="Developer API" onBack={() => router.back()} />

      <Text style={styles.lead}>
        Your personal API key — only your workouts and routines. Give it to Gemini to edit programs
        in plain English (e.g. &quot;add incline bench 3x10 to Push Day&quot;).
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Base URL</Text>
        <Pressable onPress={() => copy(`${baseUrl}/api/v1`)}>
          <Text style={styles.mono}>{baseUrl}/api/v1</Text>
        </Pressable>
        <Text style={[styles.label, styles.mt]}>Documentation</Text>
        <Pressable onPress={() => copy(`${baseUrl}/api/v1/docs`)}>
          <Text style={styles.link}>{baseUrl}/api/v1/docs</Text>
        </Pressable>
        <Text style={[styles.label, styles.mt]}>Auth header</Text>
        <Text style={styles.mono}>api-key: kak_…</Text>
      </View>

      {revealedKey ? (
        <View style={styles.revealCard}>
          <Text style={styles.revealTitle}>Save this key now</Text>
          <Text style={styles.revealHint}>It won&apos;t be shown again.</Text>
          <Text selectable style={styles.revealKey}>
            {revealedKey}
          </Text>
          <Button label="Copy key" onPress={() => copy(revealedKey)} />
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Create API key</Text>
      <TextInput
        style={styles.input}
        value={keyName}
        onChangeText={setKeyName}
        placeholder="Key name"
        placeholderTextColor={colors.textDim}
      />
      <Button
        label={createKey.isPending ? "Creating…" : "Generate API key"}
        onPress={() => createKey.mutate({ name: keyName })}
        disabled={createKey.isPending}
      />

      <Text style={styles.sectionLabel}>Active keys</Text>
      {isLoading ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : keys?.length ? (
        <View style={styles.group}>
          {keys.map((key, i) => (
            <View key={key.id} style={[styles.row, i < keys.length - 1 && styles.rowBorder]}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{key.name}</Text>
                <Text style={styles.rowMeta}>
                  {key.keyPrefix}… · created {new Date(key.createdAt).toLocaleDateString()}
                  {key.lastUsedAt ? ` · used ${new Date(key.lastUsedAt).toLocaleDateString()}` : ""}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  Alert.alert("Revoke key?", key.name, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Revoke", style: "destructive", onPress: () => revokeKey.mutate({ id: key.id }) },
                  ])
                }
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>No API keys yet.</Text>
      )}

      <Text style={styles.sectionLabel}>Use with AI</Text>
      <Text style={styles.aiLead}>
        Connect Gemini, Claude, or ChatGPT to manage workouts and routines in plain English.
      </Text>
      <View style={styles.group}>
        {LLM_OPTIONS.map((llm, i) => {
          const open = expandedLlm === llm.id;
          const setupMessage = keyForSetup ? buildSetupMessage(keyForSetup, apiBase, llm.id) : null;

          return (
            <View key={llm.id}>
              <Pressable
                style={[styles.aiRow, i > 0 && styles.rowBorder]}
                onPress={() => setExpandedLlm(open ? null : llm.id)}
              >
                <Text style={styles.rowTitle}>{llm.name}</Text>
                <Ionicons
                  name={open ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
              {open ? (
                <View style={styles.aiCard}>
                  <Text style={styles.aiStep}>1. Copy your API key</Text>
                  <Button label="Copy API key" onPress={copyApiKey} />
                  {!revealedKey && keys?.length ? (
                    <Text style={styles.aiHint}>
                      Only the prefix ({keys[0].keyPrefix}…) is stored. Use a key you saved, or generate a new one.
                    </Text>
                  ) : null}

                  <Text style={styles.aiStep}>2. Open {llm.destination}</Text>

                  <Text style={styles.aiStep}>3. Paste this into the chat or custom instructions:</Text>
                  {setupMessage ? (
                    <Text selectable style={styles.aiPaste}>
                      {setupMessage}
                    </Text>
                  ) : (
                    <Text style={styles.aiHint}>Generate an API key above to see your setup message.</Text>
                  )}
                  <Button
                    label="Copy setup message"
                    onPress={() => copySetupMessage(llm.id)}
                    disabled={!keyForSetup}
                  />

                  <Pressable onPress={() => copy(`${apiBase}/llm-tools`)} hitSlop={8}>
                    <Text style={styles.link}>Tool manifest: {apiBase}/llm-tools</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    lead: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: spacing.md },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    label: { fontSize: 12, fontWeight: "600", color: colors.textMuted, textTransform: "uppercase" },
    mt: { marginTop: spacing.md },
    mono: { fontFamily: "monospace", fontSize: 14, color: colors.text, marginTop: 4 },
    link: { fontSize: 14, color: colors.accent, marginTop: 4 },
    revealCard: {
      backgroundColor: colors.accentMuted,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    revealTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    revealHint: { fontSize: 13, color: colors.textMuted },
    revealKey: { fontFamily: "monospace", fontSize: 13, color: colors.text },
    sectionLabel: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: "600",
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      color: colors.text,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    group: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.lg,
      gap: spacing.md,
    },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
    rowBody: { flex: 1 },
    rowTitle: { fontSize: 16, color: colors.text, fontWeight: "600" },
    rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    muted: { color: colors.textMuted, fontSize: 14 },
    aiLead: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
    aiRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.lg,
    },
    aiCard: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.separator,
    },
    aiStep: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: spacing.xs },
    aiPaste: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.textMuted,
      backgroundColor: colors.bg,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    aiHint: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  });
