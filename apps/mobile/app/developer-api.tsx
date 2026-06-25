import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Screen, ThemedDialog } from "../src/components/ui";
import { HevyStackHeader } from "../src/components/hevy-ui";
import { trpc } from "../src/lib/trpc";
import { getApiUrl } from "../src/lib/api-client";
import { radius, spacing, useTheme, useThemedStyles, type Palette } from "../src/lib/theme";

type LlmToolsResponse = {
  claude_system_prompt: string;
};

async function buildSetupMessage(apiKey: string, apiBase: string): Promise<string> {
  const res = await fetch(`${apiBase}/llm-tools`);
  if (!res.ok) {
    throw new Error(`Could not load setup prompt (${res.status})`);
  }
  const data = (await res.json()) as LlmToolsResponse;
  return `${data.claude_system_prompt}

Your Kak Fit API credentials:
- API key: ${apiKey}
- Base URL: ${apiBase}
- Auth header: api-key: ${apiKey}`;
}

export default function DeveloperApiScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const utils = trpc.useUtils();
  const { data: keys, isLoading } = trpc.developer.listKeys.useQuery();
  const [keyName, setKeyName] = useState("My AI Key");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [revokeDialog, setRevokeDialog] = useState<{ visible: boolean; id?: string; name?: string }>({
    visible: false,
  });
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createKey = trpc.developer.createKey.useMutation({
    onSuccess: (data) => {
      setCreateError(null);
      setRevealedKey(data.apiKey);
      utils.developer.listKeys.invalidate();
    },
    onError: (e) => setCreateError(e.message),
  });

  const revokeKey = trpc.developer.revokeKey.useMutation({
    onSuccess: () => {
      setRevokeDialog({ visible: false });
      setRevokeError(null);
      utils.developer.listKeys.invalidate();
    },
    onError: (e) => {
      setRevokeError(e.message);
      setRevokeDialog((prev) => ({ ...prev, visible: true }));
    },
  });

  const baseUrl = getApiUrl();
  const apiBase = `${baseUrl}/api/v1`;
  const docsUrl = `${apiBase}/docs`;
  const openApiUrl = `${apiBase}/openapi.json`;
  const llmToolsUrl = `${apiBase}/llm-tools`;

  const copy = async (value: string) => {
    await Clipboard.setStringAsync(value);
    setCopiedKey(value);
    if (copyTimeout.current) clearTimeout(copyTimeout.current);
    copyTimeout.current = setTimeout(() => setCopiedKey(null), 2000);
  };

  const CopyableValue = ({
    value,
    textStyle,
  }: {
    value: string;
    textStyle: object;
  }) => (
    <Pressable onPress={() => copy(value)} style={styles.copyRow}>
      <Text style={[textStyle, { flex: 1 }]}>{value}</Text>
      {copiedKey === value ? (
        <View style={styles.copiedBadge}>
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          <Text style={styles.copiedText}>Copied</Text>
        </View>
      ) : null}
    </Pressable>
  );

  const setupKey = revealedKey ?? (manualKey.startsWith("kak_") ? manualKey.trim() : null);

  const copySetupMessage = async () => {
    if (!setupKey) return;
    setSetupLoading(true);
    try {
      const message = await buildSetupMessage(setupKey, apiBase);
      await copy(message);
    } catch (e) {
      setRevokeError(e instanceof Error ? e.message : "Try again in a moment.");
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <>
    <Screen scroll>
      <HevyStackHeader title="Developer API" onBack={() => router.back()} />

      <Text style={styles.lead}>
        Give your API key to any AI assistant (Claude, ChatGPT, Gemini) to manage your workouts in
        plain English. Example: &quot;Add incline bench 3×10 to my Push Day routine&quot;.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Base URL</Text>
        <CopyableValue value={apiBase} textStyle={styles.mono} />
        <Text style={[styles.label, styles.mt]}>Documentation</Text>
        <CopyableValue value={docsUrl} textStyle={styles.link} />
        <Text style={[styles.label, styles.mt]}>OpenAPI spec</Text>
        <CopyableValue value={openApiUrl} textStyle={styles.link} />
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
        onPress={() => {
          setCreateError(null);
          createKey.mutate({ name: keyName });
        }}
        disabled={createKey.isPending}
      />
      {createError ? <Text style={styles.errorText}>{createError}</Text> : null}

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
                onPress={() => {
                  setRevokeError(null);
                  setRevokeDialog({ visible: true, id: key.id, name: key.name });
                }}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={20} color={colors.danger} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.muted}>No API keys yet.</Text>
      )}

      <Text style={styles.manualKeyHint}>
        Your full API key was shown once when created. To copy the AI setup message, paste it here.
        Never share this key publicly.
      </Text>
      <Text style={styles.sectionLabel}>Enter your full API key to copy setup message</Text>
      <TextInput
        style={styles.input}
        value={manualKey}
        onChangeText={setManualKey}
        placeholder="kak_…"
        placeholderTextColor={colors.textDim}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />

      <Text style={styles.sectionLabel}>How to use with AI</Text>
      <View style={styles.aiCard}>
        <Text style={styles.aiStep}>1. Generate an API key above.</Text>

        <Text style={styles.aiStep}>
          2. Tap &quot;Copy Setup Message&quot; when your key is revealed, or paste a saved key above
          first — it copies your key, base URL, and a ready-made system prompt.
        </Text>
        <Button
          label={setupLoading ? "Loading setup…" : "Copy Setup Message"}
          onPress={() => void copySetupMessage()}
          disabled={!setupKey || setupLoading}
        />
        {setupLoading ? (
          <ActivityIndicator color={colors.accent} style={styles.setupSpinner} />
        ) : null}
        {!setupKey ? (
          <Text style={styles.aiHint}>
            Create a new key or paste an existing key starting with kak_ to copy the setup message.
          </Text>
        ) : null}

        <Text style={styles.aiStep}>
          3. Open Claude, ChatGPT, or Gemini and paste it. Then say things like &quot;Show my recent
          workouts&quot; or &quot;Add squats 3×10 to Leg Day&quot;.
        </Text>

        <Pressable onPress={() => copy(llmToolsUrl)} hitSlop={8} style={styles.advancedLink}>
          <Text style={styles.link}>Advanced: machine-readable tool definitions</Text>
          <Text style={styles.advancedUrl}>{llmToolsUrl}</Text>
        </Pressable>
      </View>
    </Screen>

      <ThemedDialog
        visible={revokeDialog.visible}
        title="Revoke API key?"
        message={
          revokeError
            ? revokeError
            : revokeDialog.name
              ? `Revoke "${revokeDialog.name}"? Apps using this key will stop working.`
              : "Apps using this key will stop working."
        }
        onDismiss={() => {
          setRevokeDialog({ visible: false });
          setRevokeError(null);
        }}
        buttons={[
          { label: "Cancel" },
          {
            label: revokeKey.isPending ? "Revoking…" : "Revoke",
            variant: "destructive",
            onPress: () => {
              if (revokeDialog.id) {
                revokeKey.mutate({ id: revokeDialog.id });
              }
            },
          },
        ]}
      />
    </>
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
    copyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: 4,
    },
    copiedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
    copiedText: { fontSize: 12, fontWeight: "600", color: colors.accent },
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
    errorText: { color: colors.danger, fontSize: 14, marginBottom: spacing.sm },
    manualKeyHint: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    aiCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    aiStep: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: spacing.xs },
    aiHint: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
    setupSpinner: { alignSelf: "flex-start" },
    advancedLink: { marginTop: spacing.sm, gap: 2 },
    advancedUrl: { fontSize: 12, color: colors.textDim, fontFamily: "monospace" },
  });
