import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  radius,
  spacing,
  typography,
  useTheme,
  useThemedStyles,
  type Palette,
} from "../lib/theme";

type IconName = keyof typeof Ionicons.glyphMap;

// ─── Layout ─────────────────────────────────────────────────────────────────

export function Screen({
  children,
  scroll,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  padded?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const content = (
    <View style={[padded ? styles.screenInner : styles.screenInnerFlush, style]}>{children}</View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm }]}>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </View>
  );
}

export function Header({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  eyebrow?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.headerAction}>{action}</View> : null}
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────────────

export function Card({
  children,
  glow,
  style,
}: {
  children: React.ReactNode;
  glow?: boolean;
  style?: ViewStyle;
}) {
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.card, glow && styles.cardGlow, style]}>{children}</View>;
}

export function GlassCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.glassCard, style]}>{children}</View>;
}

export function StatPill({
  value,
  label,
  accent,
  gold,
}: {
  value: string | number;
  label: string;
  accent?: boolean;
  gold?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.statPill, accent && styles.statPillAccent, gold && styles.statPillGold]}>
      <Text style={[styles.statValue, accent && styles.statValueAccent, gold && styles.statValueGold]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function PRBadge({ label }: { label: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.prBadge}>
      <Ionicons name="trophy" size={11} color={colors.gold} />
      <Text style={styles.prBadgeText}>{label}</Text>
    </View>
  );
}

export function StreakBadge({ weeks }: { weeks: number }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.streakBadge}>
      <Text style={styles.streakEmoji}>🔥</Text>
      <Text style={styles.streakText}>{weeks} week streak</Text>
    </View>
  );
}

export function XPBar({ current, max, level }: { current: number; max: number; level: number }) {
  const styles = useThemedStyles(makeStyles);
  const pct = Math.min((current / max) * 100, 100);
  return (
    <View style={styles.xpContainer}>
      <View style={styles.xpHeader}>
        <View style={styles.xpLevelBadge}>
          <Text style={styles.xpLevel}>LVL {level}</Text>
        </View>
        <Text style={styles.xpText}>
          {current} / {max} XP
        </Text>
      </View>
      <View style={styles.xpTrack}>
        <View style={[styles.xpFill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

export function FitnessScoreRing({ score }: { score: number }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.scoreRing}>
      <View style={styles.scoreRingInner}>
        <Text style={styles.scoreValue}>{score}</Text>
        <Text style={styles.scoreLabel}>SCORE</Text>
      </View>
    </View>
  );
}

export function ProgressBar({ pct, color }: { pct: number; color?: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.min(pct, 100)}%`, backgroundColor: color ?? colors.accent },
        ]}
      />
    </View>
  );
}

export function Avatar({ name, size = 64 }: { name?: string | null; size?: number }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>
        {name?.[0]?.toUpperCase() ?? "K"}
      </Text>
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

// ─── Typography ───────────────────────────────────────────────────────────────

export function ListGroup({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return <View style={styles.listGroup}>{children}</View>;
}

export function StatBlock({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statBlockValue}>{value}</Text>
      <Text style={styles.statBlockLabel}>{label}</Text>
    </View>
  );
}

export function HevyButton({
  label,
  onPress,
  loading,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary";
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.hevyButton,
        variant === "secondary" && styles.hevyButtonSecondary,
        pressed && styles.pressed,
        loading && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? colors.accent : "#fff"} size="small" />
      ) : (
        <Text style={[styles.hevyButtonText, variant === "secondary" && styles.hevyButtonTextSecondary]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function BrandMark({ large }: { large?: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.brandMarkRow}>
      <View style={[styles.brandIcon, large && styles.brandIconLarge]}>
        <Ionicons name="barbell" size={large ? 32 : 18} color={colors.accent} />
      </View>
      <Text style={[styles.brandMark, large && styles.brandMarkLarge]}>Kak Fit</Text>
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.subtitle}>{children}</Text>;
}

// ─── Buttons ────────────────────────────────────────────────────────────────

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  fullWidth,
  disabled,
  loading,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gold";
  size?: "sm" | "md";
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tint =
    variant === "primary"
      ? "#fff"
      : variant === "gold"
        ? colors.gold
        : variant === "danger"
          ? colors.danger
          : variant === "secondary"
            ? colors.text
            : colors.accentBright;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        size === "sm" ? styles.buttonSm : styles.buttonMd,
        fullWidth && styles.buttonFull,
        variant === "secondary" && styles.buttonSecondary,
        variant === "ghost" && styles.buttonGhost,
        variant === "danger" && styles.buttonDanger,
        variant === "gold" && styles.buttonGold,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tint} size="small" />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Ionicons name={icon} size={size === "sm" ? 16 : 18} color={tint} /> : null}
          <Text style={[size === "sm" ? styles.buttonTextSm : styles.buttonText, { color: tint }]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function FAB({ onPress, icon = "add" }: { onPress: () => void; icon?: IconName }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
    >
      <Ionicons name={icon} size={26} color="#fff" />
    </Pressable>
  );
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

export function SearchBar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.searchBar}>
      <Ionicons name="search" size={18} color={colors.textDim} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? "Search..."}
        placeholderTextColor={colors.textDim}
        style={styles.searchInput}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText("")} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={colors.textDim} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Input(props: TextInputProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return <TextInput placeholderTextColor={colors.textDim} style={styles.input} {...props} />;
}

// ─── Lists ────────────────────────────────────────────────────────────────────

export function ListRow({
  title,
  subtitle,
  onPress,
  right,
  icon,
  gold,
  last,
}: {
  title: string;
  subtitle?: string;
  onPress?: PressableProps["onPress"];
  right?: React.ReactNode;
  icon?: IconName;
  gold?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.listRow,
        !last && styles.listRowBorder,
        onPress && pressed && styles.listRowPressed,
      ]}
    >
      {icon ? (
        <View style={[styles.listRowIcon, gold && styles.listRowIconGold]}>
          <Ionicons name={icon} size={18} color={gold ? colors.gold : colors.textMuted} />
        </View>
      ) : null}
      <View style={styles.listRowBody}>
        <Text style={styles.listRowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.listRowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textDim} /> : null)}
    </Pressable>
  );
}

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon?: IconName;
  title: string;
  message: string;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.empty}>
      {icon ? (
        <View style={styles.emptyIcon}>
          <Ionicons name={icon} size={30} color={colors.textDim} />
        </View>
      ) : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

export function MacroRing({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const pct = Math.min((value / target) * 100, 100);
  return (
    <View style={styles.macroRing}>
      <View style={[styles.macroRingOuter, { borderColor: color }]}>
        <Text style={[styles.macroRingValue, { color }]}>{Math.round(value)}</Text>
      </View>
      <Text style={styles.macroRingLabel}>{label}</Text>
      <Text style={styles.macroRingTarget}>{Math.round(pct)}%</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    screenInner: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      gap: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    screenInnerFlush: { flex: 1, gap: spacing.lg, paddingBottom: spacing.xxl },
    scrollContent: { flexGrow: 1 },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      minHeight: 44,
      marginBottom: spacing.xs,
    },
    headerText: { flex: 1, gap: 4 },
    headerTitle: { ...typography.display, color: colors.text },
    headerSubtitle: { ...typography.caption, color: colors.textMuted },
    headerAction: { marginLeft: spacing.md, marginTop: 8 },

    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.sm,
    },
    sectionTitle: { ...typography.h2, color: colors.text },
    sectionAction: { ...typography.caption, color: colors.accent },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    cardGlow: {},
    glassCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },

    statPill: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      alignItems: "center",
      gap: 2,
    },
    statPillAccent: {},
    statPillGold: {},
    statValue: { fontSize: 22, fontWeight: "700", color: colors.text },
    statValueAccent: { color: colors.accent },
    statValueGold: { color: colors.gold },
    statLabel: { ...typography.caption, color: colors.textMuted, fontSize: 12 },

    statBlock: { flex: 1, alignItems: "center", gap: 2 },
    statBlockValue: { fontSize: 20, fontWeight: "700", color: colors.text },
    statBlockLabel: { fontSize: 12, color: colors.textMuted },

    listGroup: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      overflow: "hidden",
    },

    prBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.goldMuted,
      borderRadius: radius.sm,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: "flex-start",
    },
    prBadgeText: { fontSize: 11, fontWeight: "600", color: colors.gold },

    streakBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      alignSelf: "flex-start",
    },
    streakEmoji: { fontSize: 14 },
    streakText: { ...typography.caption, color: colors.textMuted },

    xpContainer: { gap: spacing.sm },
    xpHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    xpLevelBadge: {
      backgroundColor: colors.accentMuted,
      borderRadius: radius.sm,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    xpLevel: { fontSize: 11, fontWeight: "600", color: colors.accent },
    xpText: { ...typography.caption, color: colors.textMuted },
    xpTrack: {
      height: 4,
      backgroundColor: colors.surfaceHover,
      borderRadius: radius.full,
      overflow: "hidden",
    },
    xpFill: { height: "100%", backgroundColor: colors.accent, borderRadius: radius.full },

    scoreRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 2,
      borderColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    scoreRingInner: { alignItems: "center" },
    scoreValue: { fontSize: 24, fontWeight: "700", color: colors.text },
    scoreLabel: { fontSize: 9, fontWeight: "600", color: colors.textMuted },

    progressTrack: {
      height: 4,
      backgroundColor: colors.surfaceHover,
      borderRadius: radius.full,
      overflow: "hidden",
    },
    progressFill: { height: "100%", borderRadius: radius.full },

    avatar: {
      backgroundColor: colors.surfaceHover,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontWeight: "600", color: colors.text },

    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceHover,
    },
    chipActive: { backgroundColor: colors.accent },
    chipText: { ...typography.caption, color: colors.textMuted, fontWeight: "500" },
    chipTextActive: { color: "#fff", fontWeight: "600" },

    brandMarkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    brandIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    brandIconLarge: { width: 64, height: 64, borderRadius: radius.lg },
    brandMark: { fontSize: 17, fontWeight: "600", color: colors.text },
    brandMarkLarge: { fontSize: 28, fontWeight: "700" },
    title: { ...typography.h1, color: colors.text },
    subtitle: { ...typography.body, color: colors.textMuted, lineHeight: 20 },

    button: {
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.accent,
    },
    buttonMd: { paddingVertical: 14, paddingHorizontal: 20, minHeight: 50 },
    buttonSm: { paddingVertical: 8, paddingHorizontal: 14, minHeight: 36 },
    buttonFull: { alignSelf: "stretch" },
    buttonSecondary: { backgroundColor: colors.surfaceHover },
    buttonGhost: { backgroundColor: "transparent" },
    buttonDanger: { backgroundColor: colors.dangerMuted },
    buttonGold: { backgroundColor: colors.surfaceHover },
    buttonDisabled: { opacity: 0.5 },
    buttonInner: { flexDirection: "row", alignItems: "center", gap: 8 },
    buttonText: { fontSize: 17, fontWeight: "600" },
    buttonTextSm: { fontSize: 15, fontWeight: "600" },
    pressed: { opacity: 0.7 },

    hevyButton: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: 16,
      paddingHorizontal: spacing.xxl,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 52,
    },
    hevyButtonSecondary: {
      backgroundColor: colors.surfaceHover,
    },
    hevyButtonText: {
      fontSize: 17,
      fontWeight: "600",
      color: "#ffffff",
    },
    hevyButtonTextSecondary: {
      color: colors.accent,
    },

    fab: {
      position: "absolute",
      right: spacing.lg,
      bottom: spacing.xl,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    fabPressed: { opacity: 0.8 },

    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceHover,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
      minHeight: 40,
    },
    searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 8 },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      color: colors.text,
      fontSize: 17,
    },

    listRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
      minHeight: 56,
    },
    listRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    listRowPressed: { backgroundColor: colors.surfaceHover },
    listRowIcon: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceHover,
      alignItems: "center",
      justifyContent: "center",
    },
    listRowIconGold: { backgroundColor: colors.goldMuted },
    listRowBody: { flex: 1, gap: 2 },
    listRowTitle: { fontSize: 17, color: colors.text, fontWeight: "400" },
    listRowSubtitle: { fontSize: 13, color: colors.textMuted },

    empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.md },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: { ...typography.h2, color: colors.text },
    emptyMessage: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: "center",
      lineHeight: 20,
      maxWidth: 260,
    },

    macroRing: { alignItems: "center", gap: 4, flex: 1 },
    macroRingOuter: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    macroRingValue: { fontSize: 15, fontWeight: "700" },
    macroRingLabel: { ...typography.caption, color: colors.textMuted },
    macroRingTarget: { fontSize: 11, color: colors.textDim },
  });

// Legacy alias
export { ListRow as ListItem };
