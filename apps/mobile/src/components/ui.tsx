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

// ─── Layout ───────────────────────────────────────────────────────────────────

export function Screen({
  children,
  scroll,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const content = <View style={[styles.screenInner, style]}>{children}</View>;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.md }]}>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
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
        <Pressable onPress={onAction}>
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
  return (
    <View style={[styles.card, glow && shadows.glow, style]}>{children}</View>
  );
}

export function GlassCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.glassCard, style]}>{children}</View>
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
      <Text style={[styles.statValue, gold && styles.statValueGold]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function PRBadge({ label }: { label: string }) {
  return (
    <View style={styles.prBadge}>
      <Ionicons name="trophy" size={12} color={colors.gold} />
      <Text style={styles.prBadgeText}>{label}</Text>
    </View>
  );
}

export function StreakBadge({ weeks }: { weeks: number }) {
  return (
    <View style={styles.streakBadge}>
      <Text style={styles.streakEmoji}>🔥</Text>
      <Text style={styles.streakText}>{weeks}w streak</Text>
    </View>
  );
}

export function XPBar({ current, max, level }: { current: number; max: number; level: number }) {
  const pct = Math.min((current / max) * 100, 100);
  return (
    <View style={styles.xpContainer}>
      <View style={styles.xpHeader}>
        <Text style={styles.xpLevel}>Lv.{level}</Text>
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
      <Text style={styles.scoreValue}>{score}</Text>
      <Text style={styles.scoreLabel}>FITNESS</Text>
    </View>
  );
}

// ─── Typography ─────────────────────────────────────────────────────────────────

export function BrandMark() {
  return <Text style={styles.brandMark}>KAK FIT</Text>;
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

// ─── Inputs & Buttons ─────────────────────────────────────────────────────────

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gold";
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.buttonSecondary,
        variant === "ghost" && styles.buttonGhost,
        variant === "danger" && styles.buttonDanger,
        variant === "gold" && styles.buttonGold,
        (disabled || loading || pressed) && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : colors.accent} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={
                variant === "primary"
                  ? "#fff"
                  : variant === "gold"
                    ? colors.gold
                    : colors.accent
              }
            />
          ) : null}
          <Text
            style={[
              styles.buttonText,
              variant === "secondary" && styles.buttonTextSecondary,
              variant === "ghost" && styles.buttonTextGhost,
              variant === "gold" && styles.buttonTextGold,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

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
        <Pressable onPress={() => onChangeText("")}>
          <Ionicons name="close-circle" size={18} color={colors.textDim} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textDim}
      style={styles.input}
      {...props}
    />
  );
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
  icon?: keyof typeof Ionicons.glyphMap;
  gold?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && styles.listRowPressed]}
    >
      {icon ? (
        <View style={[styles.listRowIcon, gold && styles.listRowIconGold]}>
          <Ionicons name={icon} size={20} color={gold ? colors.gold : colors.accent} />
        </View>
      ) : null}
      <View style={styles.listRowBody}>
        <Text style={styles.listRowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.listRowSubtitle}>{subtitle}</Text> : null}
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
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}) {
  return (
    <View style={styles.empty}>
      {icon ? (
        <View style={styles.emptyIcon}>
          <Ionicons name={icon} size={32} color={colors.textDim} />
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
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screenInner: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  scrollContent: { flexGrow: 1 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { ...typography.h2, color: colors.text },
  sectionAction: { ...typography.caption, color: colors.accent },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
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
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
  },
  statPillAccent: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  statPillGold: { borderColor: colors.gold, backgroundColor: colors.goldMuted },
  statValue: { ...typography.h1, color: colors.text },
  statValueGold: { color: colors.gold },
  statLabel: { ...typography.caption, color: colors.textMuted },
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
  },
  prBadgeText: { ...typography.caption, color: colors.gold, fontWeight: "700" },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.successMuted,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.success,
  },
  streakEmoji: { fontSize: 14 },
  streakText: { ...typography.caption, color: colors.successNeon, fontWeight: "700" },
  xpContainer: { gap: spacing.sm },
  xpHeader: { flexDirection: "row", justifyContent: "space-between" },
  xpLevel: { ...typography.caption, color: colors.accentNeon, fontWeight: "700" },
  xpText: { ...typography.caption, color: colors.textMuted },
  xpTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: radius.full,
  },
  scoreRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentMuted,
  },
  scoreValue: { fontSize: 28, fontWeight: "800", color: colors.text },
  scoreLabel: { fontSize: 9, fontWeight: "700", color: colors.accentNeon, letterSpacing: 1 },
  brandMark: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.accentNeon,
    letterSpacing: 3,
  },
  title: { ...typography.display, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.accent,
  },
  buttonDanger: {
    backgroundColor: colors.dangerMuted,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  buttonGold: {
    backgroundColor: colors.goldMuted,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  buttonInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  buttonText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  buttonTextSecondary: { color: colors.text },
  buttonTextGhost: { color: colors.accent },
  buttonTextGold: { color: colors.gold },
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
    padding: spacing.lg,
    gap: spacing.md,
  },
  listRowPressed: { backgroundColor: colors.surfaceHover },
  listRowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  listRowIconGold: { backgroundColor: colors.goldMuted },
  listRowBody: { flex: 1, gap: 3 },
  listRowTitle: { ...typography.body, color: colors.text, fontWeight: "600" },
  listRowSubtitle: { ...typography.caption, color: colors.textMuted },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, gap: spacing.md },
  emptyIcon: {
    width: 64,
    height: 64,
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
    lineHeight: 22,
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

// Legacy aliases
export { ListRow as ListItem, Card as GlassCard };
