import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, ListGroup, ListRow, Screen, ThemedDialog } from "../src/components/ui";
import { HevyStackHeader } from "../src/components/hevy-ui";
import { trpc } from "../src/lib/trpc";
import { getApiUrl } from "../src/lib/api-client";
import { radius, spacing, useTheme, useThemedStyles, type Palette } from "../src/lib/theme";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: Date | null;
  createdAt: Date;
};

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

function formatKeyDate(date: Date | null | undefined, fallback = "Never") {
  if (!date) return fallback;
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DeveloperApiScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const utils = trpc.useUtils();
  const { data: keys, isLoading } = trpc.developer.listKeys.useQuery();

  const [keyName, setKeyName] = useState("My AI Key");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKeyRow | null>(null);
  /** Full secrets only available immediately after creation (never stored server-side). */
  const [fullKeyById, setFullKeyById] = useState<Record<string, string>>({});
  const [pastedFullKey, setPastedFullKey] = useState("");
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [revokeDialog, setRevokeDialog] = useState<{ visible: boolean; id?: string; name?: string }>({
    visible: false,
  });
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const baseUrl = getApiUrl();
  const apiBase = `${baseUrl}/api/v1`;
  const docsUrl = `${apiBase}/docs`;
  const openApiUrl = `${apiBase}/openapi.json`;
  const llmToolsUrl = `${apiBase}/llm-tools`;

  const openKeyDetail = (key: ApiKeyRow) => {
    setSelectedKey(key);
    setPastedFullKey("");
    setSetupError(null);
    setDetailOpen(true);
  };

  const closeKeyDetail = () => {
    setDetailOpen(false);
    setSelectedKey(null);
    setPastedFullKey("");
    setSetupError(null);
  };

  const copy = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    setCopiedLabel(label);
    if (copyTimeout.current) clearTimeout(copyTimeout.current);
    copyTimeout.current = setTimeout(() => setCopiedLabel(null), 2000);
  };

  const createKey = trpc.developer.createKey.useMutation({
    onSuccess: (data) => {
      setCreateError(null);
      setFullKeyById((prev) => ({ ...prev, [data.id]: data.apiKey }));
      const row: ApiKeyRow = {
        id: data.id,
        name: data.name,
        keyPrefix: data.keyPrefix,
        lastUsedAt: null,
        createdAt: data.createdAt,
      };
      utils.developer.listKeys.invalidate();
      openKeyDetail(row);
    },
    onError: (e) => setCreateError(e.message),
  });

  const revokeKey = trpc.developer.revokeKey.useMutation({
    onSuccess: () => {
      setRevokeDialog({ visible: false });
      setRevokeError(null);
      if (revokeDialog.id) {
        setFullKeyById((prev) => {
          const next = { ...prev };
          delete next[revokeDialog.id!];
          return next;
        });
      }
      closeKeyDetail();
      utils.developer.listKeys.invalidate();
    },
    onError: (e) => {
      setRevokeError(e.message);
      setRevokeDialog((prev) => ({ ...prev, visible: true }));
    },
  });

  const resolvedFullKey =
    selectedKey && fullKeyById[selectedKey.id]
      ? fullKeyById[selectedKey.id]
      : pastedFullKey.startsWith("kak_")
        ? pastedFullKey.trim()
        : null;

  const copySetupMessage = async () => {
    if (!resolvedFullKey) return;
    setSetupLoading(true);
    setSetupError(null);
    try {
      const message = await buildSetupMessage(resolvedFullKey, apiBase);
      await copy(message, "setup");
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : "Could not copy setup message.");
    } finally {
      setSetupLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
    };
  }, []);

  return (
    <>
      <Screen scroll>
        <HevyStackHeader title="Developer API" onBack={() => router.back()} />

        <Text style={styles.lead}>
          Connect Claude, ChatGPT, or Gemini to your workouts. Generate a key, tap it to view details,
          and copy the setup message for your AI assistant.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>API base URL</Text>
          <CopyRow
            value={apiBase}
            label="base-url"
            copiedLabel={copiedLabel}
            onCopy={copy}
            textStyle={styles.mono}
          />
          <View style={styles.linkRow}>
            <Pressable onPress={() => void Linking.openURL(docsUrl)} style={styles.linkBtn}>
              <Ionicons name="book-outline" size={18} color={colors.accent} />
              <Text style={styles.linkBtnText}>Open API docs</Text>
            </Pressable>
            <Pressable onPress={() => copy(openApiUrl, "openapi")} style={styles.linkBtn}>
              <Ionicons name="code-outline" size={18} color={colors.accent} />
              <Text style={styles.linkBtnText}>Copy OpenAPI URL</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Create API key</Text>
        <TextInput
          style={styles.input}
          value={keyName}
          onChangeText={setKeyName}
          placeholder="Key name (e.g. Claude Desktop)"
          placeholderTextColor={colors.textDim}
        />
        <Button
          label={createKey.isPending ? "Creating…" : "Generate API key"}
          onPress={() => {
            setCreateError(null);
            createKey.mutate({ name: keyName });
          }}
          disabled={createKey.isPending}
          fullWidth
        />
        {createError ? <Text style={styles.errorText}>{createError}</Text> : null}

        <Text style={styles.sectionLabel}>Active keys</Text>
        {isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.md }} />
        ) : keys?.length ? (
          <ListGroup>
            {keys.map((key, index) => {
              const hasFreshSecret = Boolean(fullKeyById[key.id]);
              return (
                <ListRow
                  key={key.id}
                  title={key.name}
                  subtitle={`${key.keyPrefix}… · created ${formatKeyDate(key.createdAt)}${
                    key.lastUsedAt ? ` · used ${formatKeyDate(key.lastUsedAt)}` : ""
                  }`}
                  icon="key-outline"
                  onPress={() => openKeyDetail(key)}
                  right={
                    hasFreshSecret ? (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>New</Text>
                      </View>
                    ) : undefined
                  }
                  last={index === keys.length - 1}
                />
              );
            })}
          </ListGroup>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="key-outline" size={28} color={colors.textDim} />
            <Text style={styles.emptyTitle}>No API keys yet</Text>
            <Text style={styles.emptyText}>Generate a key above to connect external apps and AI assistants.</Text>
          </View>
        )}

        <Text style={styles.footerHint}>
          Full secrets are shown once when you create a key. Tap any key to view details, copy setup
          instructions, or revoke access.
        </Text>
      </Screen>

      <Modal
        visible={detailOpen && selectedKey != null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeKeyDetail}
      >
        {selectedKey ? (
          <View style={[styles.sheet, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {selectedKey.name}
              </Text>
              <Pressable onPress={closeKeyDetail} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.secretBox}>
              {fullKeyById[selectedKey.id] ? (
                <>
                  <Text style={styles.secretLabel}>Your new API key — copy now</Text>
                  <Text selectable style={styles.secretFull}>
                    {fullKeyById[selectedKey.id]}
                  </Text>
                  <Text style={styles.secretWarn}>This is the only time the full key is shown.</Text>
                  <Button
                    label={copiedLabel === "full-key" ? "Copied!" : "Copy full key"}
                    onPress={() => void copy(fullKeyById[selectedKey.id]!, "full-key")}
                    fullWidth
                  />
                </>
              ) : (
                <>
                  <Text style={styles.secretLabel}>API key</Text>
                  <Text style={styles.secretMasked}>{selectedKey.keyPrefix}••••••••••••</Text>
                  <Text style={styles.secretWarn}>
                    The full secret was only shown at creation. Paste it below to copy the AI setup message.
                  </Text>
                </>
              )}
            </View>

            <View style={styles.metaGrid}>
              <MetaItem label="Created" value={formatKeyDate(selectedKey.createdAt)} />
              <MetaItem label="Last used" value={formatKeyDate(selectedKey.lastUsedAt, "Never")} />
              <MetaItem label="Prefix" value={`${selectedKey.keyPrefix}…`} />
            </View>

            {!fullKeyById[selectedKey.id] ? (
              <>
                <Text style={styles.fieldLabel}>Paste full key (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={pastedFullKey}
                  onChangeText={setPastedFullKey}
                  placeholder="kak_…"
                  placeholderTextColor={colors.textDim}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
              </>
            ) : null}

            <Button
              label={setupLoading ? "Loading…" : copiedLabel === "setup" ? "Setup message copied!" : "Copy AI setup message"}
              onPress={() => void copySetupMessage()}
              disabled={!resolvedFullKey || setupLoading}
              fullWidth
            />
            {setupError ? <Text style={styles.errorText}>{setupError}</Text> : null}

            <View style={styles.sheetActions}>
              <Pressable
                style={styles.sheetActionRow}
                onPress={() => void copy(`${selectedKey.keyPrefix}…`, "prefix")}
              >
                <Ionicons name="copy-outline" size={20} color={colors.text} />
                <Text style={styles.sheetActionText}>
                  {copiedLabel === "prefix" ? "Prefix copied" : "Copy key prefix"}
                </Text>
              </Pressable>
              <Pressable style={styles.sheetActionRow} onPress={() => void copy(apiBase, "base")}>
                <Ionicons name="link-outline" size={20} color={colors.text} />
                <Text style={styles.sheetActionText}>
                  {copiedLabel === "base" ? "Base URL copied" : "Copy base URL"}
                </Text>
              </Pressable>
              <Pressable style={styles.sheetActionRow} onPress={() => void Linking.openURL(docsUrl)}>
                <Ionicons name="book-outline" size={20} color={colors.text} />
                <Text style={styles.sheetActionText}>View API documentation</Text>
              </Pressable>
              <Pressable
                style={styles.sheetActionRow}
                onPress={() => void copy(llmToolsUrl, "llm-tools")}
              >
                <Ionicons name="hardware-chip-outline" size={20} color={colors.text} />
                <Text style={styles.sheetActionText}>Copy LLM tools URL</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.revokeBtn}
              onPress={() => {
                setRevokeError(null);
                setRevokeDialog({ visible: true, id: selectedKey.id, name: selectedKey.name });
              }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={styles.revokeText}>Revoke this key</Text>
            </Pressable>
          </View>
        ) : null}
      </Modal>

      <ThemedDialog
        visible={revokeDialog.visible}
        title="Revoke API key?"
        message={
          revokeError
            ? revokeError
            : revokeDialog.name
              ? `Revoke "${revokeDialog.name}"? Apps using this key will stop working immediately.`
              : "Apps using this key will stop working immediately."
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

function CopyRow({
  value,
  label,
  copiedLabel,
  onCopy,
  textStyle,
}: {
  value: string;
  label: string;
  copiedLabel: string | null;
  onCopy: (value: string, label: string) => void;
  textStyle: object;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={() => void onCopy(value, label)} style={styles.copyRow}>
      <Text style={[textStyle, { flex: 1 }]} numberOfLines={2}>
        {value}
      </Text>
      {copiedLabel === label ? (
        <View style={styles.copiedBadge}>
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          <Text style={styles.copiedText}>Copied</Text>
        </View>
      ) : (
        <Ionicons name="copy-outline" size={18} color={colors.textDim} />
      )}
    </Pressable>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    lead: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: spacing.lg },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    label: { fontSize: 12, fontWeight: "600", color: colors.textMuted, textTransform: "uppercase" },
    mono: { fontFamily: "monospace", fontSize: 14, color: colors.text },
    copyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    copiedBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
    copiedText: { fontSize: 12, fontWeight: "600", color: colors.accent },
    linkRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm },
    linkBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
    linkBtnText: { fontSize: 14, fontWeight: "600", color: colors.accent },
    sectionLabel: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: "600",
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      color: colors.text,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      fontFamily: "monospace",
      fontSize: 14,
    },
    errorText: { color: colors.danger, fontSize: 14, marginBottom: spacing.sm },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: "center",
      gap: spacing.sm,
    },
    emptyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
    emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
    newBadge: {
      backgroundColor: colors.accentMuted,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    newBadgeText: { fontSize: 11, fontWeight: "700", color: colors.accent },
    footerHint: {
      color: colors.textDim,
      fontSize: 13,
      lineHeight: 18,
      marginTop: spacing.lg,
      marginBottom: spacing.xxl,
    },
    sheet: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    sheetTitle: { fontSize: 22, fontWeight: "800", color: colors.text, flex: 1, marginRight: spacing.md },
    secretBox: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secretLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted, textTransform: "uppercase" },
    secretFull: {
      fontFamily: "monospace",
      fontSize: 14,
      color: colors.text,
      lineHeight: 22,
      backgroundColor: colors.bgElevated,
      padding: spacing.md,
      borderRadius: radius.md,
    },
    secretMasked: {
      fontFamily: "monospace",
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      letterSpacing: 1,
    },
    secretWarn: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    metaGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    metaItem: { minWidth: "28%", flexGrow: 1 },
    metaLabel: { fontSize: 11, fontWeight: "600", color: colors.textDim, textTransform: "uppercase" },
    metaValue: { fontSize: 15, fontWeight: "600", color: colors.text, marginTop: 2 },
    fieldLabel: { fontSize: 13, fontWeight: "600", color: colors.textMuted, marginBottom: -spacing.xs },
    sheetActions: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    sheetActionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    sheetActionText: { fontSize: 15, fontWeight: "600", color: colors.text },
    revokeBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      marginTop: "auto",
    },
    revokeText: { fontSize: 15, fontWeight: "700", color: colors.danger },
  });
