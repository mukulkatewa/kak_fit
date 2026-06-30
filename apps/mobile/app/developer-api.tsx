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
  const [fullKeyById, setFullKeyById] = useState<Record<string, string>>({});
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
  const [showCopiedBannerId, setShowCopiedBannerId] = useState<string | null>(null);
  const [revokeDialog, setRevokeDialog] = useState<{ visible: boolean; id?: string; name?: string }>({
    visible: false,
  });
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCreateAttempted = useRef(false);

  const baseUrl = getApiUrl();
  const apiBase = `${baseUrl}/api/v1`;
  const docsUrl = `${apiBase}/docs`;
  const keyCount = keys?.length ?? 0;
  const singleKey = keyCount === 1 ? keys![0]! : null;
  const useModalForDetails = keyCount >= 2;

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
      setShowCopiedBannerId(data.id);

      const row: ApiKeyRow = {
        id: data.id,
        name: data.name,
        keyPrefix: data.keyPrefix,
        lastUsedAt: null,
        createdAt: data.createdAt,
      };

      const addingToExisting = (keys?.length ?? 0) >= 1;
      await utils.developer.listKeys.invalidate();

      if (addingToExisting) {
        openKeyDetail(row, { showCopiedBanner: true });
      }
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

  const openKeyDetail = (key: ApiKeyRow, options?: { showCopiedBanner?: boolean }) => {
    setSelectedKey(key);
    if (options?.showCopiedBanner) {
      setShowCopiedBannerId(key.id);
    }
    setDetailOpen(true);
  };

  const closeKeyDetail = () => {
    setDetailOpen(false);
    setSelectedKey(null);
  };

  const promptRevoke = (key: ApiKeyRow) => {
    setRevokeError(null);
    setRevokeDialog({ visible: true, id: key.id, name: key.name });
  };

  useEffect(() => {
    if (isLoading || autoCreateAttempted.current || createKey.isPending) return;
    if (keys && keys.length === 0) {
      autoCreateAttempted.current = true;
      createKey.mutate({ name: "My AI Key" });
    }
  }, [isLoading, keys, createKey.isPending]);

  useEffect(() => {
    return () => {
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
    };
  }, []);

  const showCreateForm = keyCount > 0 || createError != null;
  const settingUp = !isLoading && keyCount === 0 && (createKey.isPending || !createError);

  return (
    <>
      <Screen scroll>
        <HevyStackHeader title="Developer API" onBack={() => router.back()} />

        <Text style={styles.lead}>
          Connect Claude, ChatGPT, or other tools to your workouts with an API key.
        </Text>

        {isLoading || settingUp ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>
              {settingUp ? "Setting up your API key…" : "Loading…"}
            </Text>
          </View>
        ) : null}

        {!isLoading && singleKey ? (
          <KeySetupCard
            keyRow={singleKey}
            fullKey={fullKeyById[singleKey.id] ?? null}
            apiBase={apiBase}
            docsUrl={docsUrl}
            copiedLabel={copiedLabel}
            showCopiedBanner={showCopiedBannerId === singleKey.id}
            onCopy={copy}
            onRevoke={() => promptRevoke(singleKey)}
            onCopyAll={async () => {
              const message = buildSetupInstructions(fullKeyById[singleKey.id] ?? null, apiBase);
              await copy(message, `setup-${singleKey.id}`);
              showToast("Setup instructions copied!", "success");
            }}
          />
        ) : null}

        {!isLoading && useModalForDetails ? (
          <>
            <Text style={styles.sectionLabel}>Active keys</Text>
            <ListGroup>
              {keys!.map((key, index) => {
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
                    last={index === keys!.length - 1}
                  />
                );
              })}
            </ListGroup>
          </>
        ) : null}

        {showCreateForm ? (
          <>
            <Text style={styles.sectionLabel}>
              {keyCount > 0 ? "Create another key" : "Create API key"}
            </Text>
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
          </>
        ) : null}
      </Screen>

      <Modal
        visible={detailOpen && selectedKey != null && useModalForDetails}
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

            <ScrollView contentContainerStyle={styles.sheetScrollContent}>
              <KeySetupCard
                keyRow={selectedKey}
                fullKey={fullKeyById[selectedKey.id] ?? null}
                apiBase={apiBase}
                docsUrl={docsUrl}
                copiedLabel={copiedLabel}
                showCopiedBanner={showCopiedBannerId === selectedKey.id}
                onCopy={copy}
                onRevoke={() => promptRevoke(selectedKey)}
                onCopyAll={async () => {
                  const message = buildSetupInstructions(fullKeyById[selectedKey.id] ?? null, apiBase);
                  await copy(message, `setup-${selectedKey.id}`);
                  showToast("Setup instructions copied!", "success");
                }}
              />
            </ScrollView>
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

function KeySetupCard({
  keyRow,
  fullKey,
  apiBase,
  docsUrl,
  copiedLabel,
  showCopiedBanner,
  onCopy,
  onRevoke,
  onCopyAll,
}: {
  keyRow: ApiKeyRow;
  fullKey: string | null;
  apiBase: string;
  docsUrl: string;
  copiedLabel: string | null;
  showCopiedBanner: boolean;
  onCopy: (value: string, label: string) => void;
  onRevoke: () => void;
  onCopyAll: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const copyScope = keyRow.id;
  const hasFullKey = Boolean(fullKey);

  return (
    <View style={styles.setupCard}>
      <View style={styles.setupCardHeader}>
        <View style={styles.setupCardTitleWrap}>
          <Text style={styles.setupCardTitle} numberOfLines={1}>
            {keyRow.name}
          </Text>
          <Text style={styles.setupCardMeta}>
            Created {formatKeyDate(keyRow.createdAt)} · Last used{" "}
            {formatKeyDate(keyRow.lastUsedAt, "Never")}
          </Text>
        </View>
        <Pressable onPress={onRevoke} hitSlop={8} style={styles.revokeIconBtn}>
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </Pressable>
      </View>

      {showCopiedBanner && hasFullKey ? (
        <View style={styles.copiedBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
          <Text style={styles.copiedBannerText}>Copied to clipboard</Text>
        </View>
      ) : null}

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>API key</Text>
        {hasFullKey ? (
          <>
            <CopyRow
              value={fullKey!}
              label={`full-key-${copyScope}`}
              copiedLabel={copiedLabel}
              onCopy={onCopy}
              textStyle={styles.secretFull}
            />
            <Text style={styles.secretHint}>This is shown only once</Text>
          </>
        ) : (
          <>
            <Text style={styles.secretMasked}>{keyRow.keyPrefix}••••••••</Text>
            <Text style={styles.secretHint}>Full secret was only shown at creation</Text>
          </>
        )}
      </View>

      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Base URL</Text>
        <CopyRow
          value={apiBase}
          label={`base-url-${copyScope}`}
          copiedLabel={copiedLabel}
          onCopy={onCopy}
          textStyle={styles.mono}
        />
      </View>

      <Pressable
        style={({ pressed }) => [styles.primaryAction, pressed && styles.primaryActionPressed]}
        onPress={() => void onCopyAll()}
      >
        <Ionicons name="copy-outline" size={20} color="#fff" />
        <Text style={styles.primaryActionText}>
          {copiedLabel === `setup-${copyScope}` ? "Copied!" : "Copy All"}
        </Text>
      </Pressable>

      <Pressable onPress={() => void Linking.openURL(docsUrl)} style={styles.openDocsBtn}>
        <Ionicons name="book-outline" size={18} color={colors.accent} />
        <Text style={styles.openDocsText}>Open Docs</Text>
      </Pressable>
    </View>
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
      <Text style={[textStyle, { flex: 1 }]} numberOfLines={3} selectable={label.startsWith("full-key")}>
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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    lead: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: spacing.lg },
    loadingCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: "center",
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    loadingText: { fontSize: 14, color: colors.textMuted },
    setupCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.lg,
    },
    setupCardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    setupCardTitleWrap: { flex: 1, gap: 4 },
    setupCardTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
    setupCardMeta: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    revokeIconBtn: {
      padding: spacing.xs,
      marginTop: -spacing.xs,
      marginRight: -spacing.xs,
    },
    fieldBlock: { gap: spacing.xs },
    fieldLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textDim,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    mono: { fontFamily: "monospace", fontSize: 14, color: colors.text },
    copyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: colors.bgElevated,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
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
    newBadge: {
      backgroundColor: colors.accentMuted,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    newBadgeText: { fontSize: 11, fontWeight: "700", color: colors.accent },
    sheet: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingHorizontal: spacing.lg,
    },
    sheetScrollContent: { paddingBottom: spacing.lg },
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
    secretFull: {
      fontFamily: "monospace",
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
    },
    secretMasked: {
      fontFamily: "monospace",
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      letterSpacing: 1,
      paddingVertical: spacing.xs,
    },
    secretHint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
    primaryAction: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      minHeight: 52,
      paddingHorizontal: spacing.lg,
    },
    primaryActionPressed: { opacity: 0.85 },
    primaryActionText: { fontSize: 16, fontWeight: "700", color: "#fff" },
    openDocsBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    openDocsText: { fontSize: 15, fontWeight: "600", color: colors.accent },
  });
