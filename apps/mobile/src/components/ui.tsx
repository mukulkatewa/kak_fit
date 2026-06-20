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
import { colors, radius, shadows, spacing, typography } from "../lib/theme";

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
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow ? <Text style={styles.headerEyebrow}>{eyebrow}</Text> : null}
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
  return <View style={[styles.card, glow && styles.cardGlow, style]}>{children}</View>;
}

export function GlassCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
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
  return (
    <View style={styles.prBadge}>
      <Ionicons name="trophy" size={11} color={colors.gold} />
      <Text style={styles.prBadgeText}>{label}</Text>
    </View>
  );
}

export function StreakBadge({ weeks }: { weeks: number }) {
  return (
    <View style={styles.streakBadge}>
      <Text style={styles.streakEmoji}>🔥</Text>
      <Text style={styles.streakText}>{weeks} week streak</Text>
    </View>
  );
}

export function XPBar({ current, max, level }: { current: number; max: number; level: number }) {
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
  return (
    <View style={styles.scoreRing}>
      <View style={styles.scoreRingInner}>
        <Text style={styles.scoreValue}>{score}</Text>
        <Text style={styles.scoreLabel}>SCORE</Text>
      </View>
    </View>
  );
}

export function ProgressBar({ pct, color = colors.accent }: { pct: number; color?: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

export function Avatar({ name, size = 64 }: { name?: string | null; size?: number }) {
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

export function BrandMark() {
  return (
    <View style={styles.brandMarkRow}>
      <View style={styles.brandDot} />
      <Text style={styles.brandMark}>KAK FIT</Text>
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
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
}: {
  title: string;
  subtitle?: string;
  onPress?: PressableProps["onPress"];
  right?: React.ReactNode;
  icon?: IconName;
  gold?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && styles.listRowPressed]}
    >
      {icon ? (
        <View style={[styles.listRowIcon, gold && styles.listRowIconGold]}>
          <Ionicons name={icon} size={20} color={gold ? colors.gold : colors.accentBright} />
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
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textDim} /> : null)}
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

const styles = StyleSheet.create({
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
    alignItems: "center",
    minHeight: 44,
  },
  headerText: { flex: 1, gap: 2 },
  headerEyebrow: {
    ...typography.label,
    color: colors.accentNeon,
    marginBottom: 2,
  },
  headerTitle: { ...typography.display, color: colors.text },
  headerSubtitle: { ...typography.body, color: colors.textMuted },
  headerAction: { marginLeft: spacing.md },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { ...typography.h2, color: colors.text },
  sectionAction: { ...typography.caption, color: colors.accentBright },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  cardGlow: { borderColor: colors.accent, ...shadows.glow },
  glassCard: {
    backgroundColor: colors.glass,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: spacing.md,
  },

  statPill: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    gap: 3,
  },
  statPillAccent: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  statPillGold: { borderColor: colors.gold, backgroundColor: colors.goldMuted },
  statValue: { ...typography.h1, color: colors.text, fontSize: 24 },
  statValueAccent: { color: colors.accentBright },
  statValueGold: { color: colors.gold },
  statLabel: { ...typography.label, color: colors.textMuted, fontSize: 10 },

  prBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.goldMuted,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.gold,
    alignSelf: "flex-start",
  },
  prBadgeText: { ...typography.label, color: colors.gold, fontSize: 9 },

  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.successMuted,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.success,
    alignSelf: "flex-start",
  },
  streakEmoji: { fontSize: 15 },
  streakText: { ...typography.caption, color: colors.successNeon, fontWeight: "700" },

  xpContainer: { gap: spacing.sm },
  xpHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  xpLevelBadge: {
    backgroundColor: colors.accentMuted,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  xpLevel: { ...typography.label, color: colors.accentBright, fontSize: 10 },
  xpText: { ...typography.caption, color: colors.textMuted },
  xpTrack: {
    height: 8,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.full,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  xpFill: { height: "100%", backgroundColor: colors.accent, borderRadius: radius.full },

  scoreRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentMuted,
  },
  scoreRingInner: { alignItems: "center" },
  scoreValue: { fontSize: 30, fontWeight: "800", color: colors.text, letterSpacing: -1 },
  scoreLabel: { fontSize: 8, fontWeight: "800", color: colors.accentNeon, letterSpacing: 1.5 },

  progressTrack: {
    height: 6,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: radius.full },

  avatar: {
    backgroundColor: colors.accentMuted,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800", color: colors.accentBright },

  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  chipText: { ...typography.caption, color: colors.textMuted },
  chipTextActive: { color: colors.accentBright },

  brandMarkRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accentNeon },
  brandMark: { fontSize: 11, fontWeight: "800", color: colors.accentNeon, letterSpacing: 3 },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, lineHeight: 21 },

  button: {
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
  },
  buttonMd: { paddingVertical: 14, paddingHorizontal: 22, minHeight: 50 },
  buttonSm: { paddingVertical: 9, paddingHorizontal: 16, minHeight: 38 },
  buttonFull: { alignSelf: "stretch" },
  buttonSecondary: { backgroundColor: colors.surfaceHover, borderWidth: 1, borderColor: colors.border },
  buttonGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
  buttonDanger: { backgroundColor: colors.dangerMuted, borderWidth: 1, borderColor: colors.danger },
  buttonGold: { backgroundColor: colors.goldMuted, borderWidth: 1, borderColor: colors.gold },
  buttonDisabled: { opacity: 0.5 },
  buttonInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  buttonText: { fontSize: 16, fontWeight: "700" },
  buttonTextSm: { fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },

  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.glow,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.94 }] },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    minHeight: 48,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 10 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
  },

  listRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  listRowPressed: { backgroundColor: colors.surfaceHover, transform: [{ scale: 0.99 }] },
  listRowIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  listRowIconGold: { backgroundColor: colors.goldMuted },
  listRowBody: { flex: 1, gap: 3 },
  listRowTitle: { ...typography.body, color: colors.text, fontWeight: "700" },
  listRowSubtitle: { ...typography.caption, color: colors.textMuted, fontWeight: "500" },

  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.md },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { ...typography.h2, color: colors.text },
  emptyMessage: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 280,
  },

  macroRing: { alignItems: "center", gap: 4, flex: 1 },
  macroRingOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  macroRingValue: { fontSize: 16, fontWeight: "800" },
  macroRingLabel: { ...typography.caption, color: colors.textMuted },
  macroRingTarget: { fontSize: 10, color: colors.textDim },
});

// Legacy alias
export { ListRow as ListItem };
