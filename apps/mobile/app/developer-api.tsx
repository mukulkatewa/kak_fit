import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, ListGroup, ListRow, Screen, ThemedDialog, useToast } from "../src/components/ui";
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

function buildSetupInstructions(apiKey: string | null, apiBase: string): string {
  const keyValue = apiKey ?? "YOUR_API_KEY";
  const keyLine = apiKey
    ? `API Key: ${apiKey}`
    : "API Key: (use the key you saved when you created this key)";

  return `Kak Fit API Setup

${keyLine}
Base URL: ${apiBase}

Example:
curl -H "api-key: ${keyValue}" \\
  "${apiBase}/workouts"

Documentation: ${apiBase}/docs`;
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
  const { showToast } = useToast();
  const utils = trpc.useUtils();
  const { data: keys, isLoading } = trpc.developer.listKeys.useQuery();

  const [keyName, setKeyName] = useState("My AI Key");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKeyRow | null>(null);
  /** Full secrets only available immediately after creation (never stored server-side). */
  const [fullKeyById, setFullKeyById] = useState<Record<string, string>>({});
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [showCopiedBanner, setShowCopiedBanner] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [revokeDialog, setRevokeDialog] = useState<{ visible: boolean; id?: string; name?: string }>({
    visible: false,
  });
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const baseUrl = getApiUrl();
  const apiBase = `${baseUrl}/api/v1`;
  const docsUrl = `${apiBase}/docs`;

  const openKeyDetail = (key: ApiKeyRow, options?: { showCopiedBanner?: boolean }) => {
    setSelectedKey(key);
    setShowCopiedBanner(options?.showCopiedBanner ?? false);
    setDetailsExpanded(false);
    setDetailOpen(true);
  };

  const closeKeyDetail = () => {
    setDetailOpen(false);
    setSelectedKey(null);
    setShowCopiedBanner(false);
    setDetailsExpanded(false);
  };

  const copy = async (value: string, label: string) => {
    await Clipboard.setStringAsync(value);
    setCopiedLabel(label);
    if (copyTimeout.current) clearTimeout(copyTimeout.current);
    copyTimeout.current = setTimeout(() => setCopiedLabel(null), 2000);
  };

  const createKey = trpc.developer.createKey.useMutation({
    onSuccess: async (data) => {
      setCreateError(null);
      setFullKeyById((prev) => ({ ...prev, [data.id]: data.apiKey }));
      await Clipboard.setStringAsync(data.apiKey);
      showToast("API key copied to clipboard!", "success");

      const row: ApiKeyRow = {
        id: data.id,
        name: data.name,
        keyPrefix: data.keyPrefix,
        lastUsedAt: null,
        createdAt: data.createdAt,
      };
      utils.developer.listKeys.invalidate();
      openKeyDetail(row, { showCopiedBanner: true });
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

  const fullKey = selectedKey ? fullKeyById[selectedKey.id] : null;
  const isNewKey = Boolean(fullKey);

  const copySetupInstructions = async () => {
    const message = buildSetupInstructions(fullKey, apiBase);
    await copy(message, "setup");
    showToast("Setup instructions copied!", "success");
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
          Generate an API key to connect Claude, ChatGPT, or other tools to your workouts.
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

        <Pressable onPress={() => void Linking.openURL(docsUrl)} style={styles.viewDocsLink}>
          <Text style={styles.viewDocsText}>View Docs</Text>
        </Pressable>
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

            <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetScrollContent}>
              {showCopiedBanner && isNewKey ? (
                <View style={styles.copiedBanner}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                  <Text style={styles.copiedBannerText}>Copied to clipboard</Text>
                </View>
              ) : null}

              <View style={styles.secretBox}>
                {isNewKey ? (
                  <>
                    <Text selectable style={styles.secretFull}>
                      {fullKey}
                    </Text>
                    <Text style={styles.secretHint}>This is shown only once</Text>
                    <Pressable
                      style={({ pressed }) => [styles.primaryAction, pressed && styles.primaryActionPressed]}
                      onPress={() => void copy(fullKey!, "full-key")}
                    >
                      <Ionicons name="copy-outline" size={20} color="#fff" />
                      <Text style={styles.primaryActionText}>
                        {copiedLabel === "full-key" ? "Copied!" : "Copy API Key"}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.secretMasked}>{selectedKey.keyPrefix}••••••••</Text>
                    <Text style={styles.secretHint}>Key hidden — full secret was only shown at creation</Text>
                  </>
                )}
              </View>

              <View style={styles.quickActions}>
                <Button
                  label={copiedLabel === "setup" ? "Copied!" : "Copy Setup Instructions"}
                  onPress={() => void copySetupInstructions()}
                  variant="secondary"
                  fullWidth
                />
                <Button
                  label="View API Docs"
                  onPress={() => void Linking.openURL(docsUrl)}
                  variant="secondary"
                  fullWidth
                />
              </View>

              <Pressable
                style={styles.detailsToggle}
                onPress={() => setDetailsExpanded((v) => !v)}
              >
                <Text style={styles.detailsToggleText}>Details</Text>
                <Ionicons
                  name={detailsExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
              {detailsExpanded ? (
                <View style={styles.metaGrid}>
                  <MetaItem label="Created" value={formatKeyDate(selectedKey.createdAt)} />
                  <MetaItem label="Last used" value={formatKeyDate(selectedKey.lastUsedAt, "Never")} />
                  <MetaItem label="Prefix" value={`${selectedKey.keyPrefix}…`} />
                </View>
              ) : null}

              <Pressable
                style={styles.revokeBtn}
                onPress={() => {
                  setRevokeError(null);
                  setRevokeDialog({ visible: true, id: selectedKey.id, name: selectedKey.name });
                }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={styles.revokeText}>Revoke This Key</Text>
              </Pressable>
            </ScrollView>
          </View>
        )
        : null}
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
    viewDocsLink: {
      alignSelf: "center",
      paddingVertical: spacing.lg,
      marginBottom: spacing.xxl,
    },
    viewDocsText: { fontSize: 14, fontWeight: "600", color: colors.accent },
    sheet: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingHorizontal: spacing.lg,
    },
    sheetScroll: { flex: 1 },
    sheetScrollContent: { gap: spacing.md, paddingBottom: spacing.lg },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    sheetTitle: { fontSize: 22, fontWeight: "800", color: colors.text, flex: 1, marginRight: spacing.md },
    copiedBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.accentMuted,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    copiedBannerText: { fontSize: 14, fontWeight: "600", color: colors.accent },
    secretBox: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secretFull: {
      fontFamily: "monospace",
      fontSize: 17,
      color: colors.text,
      lineHeight: 26,
    },
    secretMasked: {
      fontFamily: "monospace",
      fontSize: 20,
      fontWeight: "600",
      color: colors.text,
      letterSpacing: 1,
    },
    secretHint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    primaryAction: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      minHeight: 56,
      paddingHorizontal: spacing.lg,
    },
    primaryActionPressed: { opacity: 0.85 },
    primaryActionText: { fontSize: 17, fontWeight: "700", color: "#fff" },
    quickActions: { gap: spacing.sm },
    detailsToggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.sm,
    },
    detailsToggleText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
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
    revokeBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      marginTop: spacing.md,
    },
    revokeText: { fontSize: 15, fontWeight: "700", color: colors.danger },
  });
