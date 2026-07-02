import { Ionicons } from "@expo/vector-icons";
import { forwardRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from "react-native";
import { radius, shadows, spacing, typography, useTheme, useThemedStyles, type Palette } from "../lib/theme";

type IconName = keyof typeof Ionicons.glyphMap;

/** Hevy top bar: title + optional chevron, right actions */
export function HevyTopBar({
  title,
  showChevron,
  onPressTitle,
  right,
}: {
  title: string;
  showChevron?: boolean;
  onPressTitle?: () => void;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.topBar}>
      <Pressable style={styles.titleRow} onPress={onPressTitle} disabled={!onPressTitle}>
        <Text style={styles.title}>{title}</Text>
        {showChevron ? <Ionicons name="chevron-down" size={18} color={colors.text} /> : null}
      </Pressable>
      <View style={styles.actions}>{right}</View>
    </View>
  );
}

export function HevyIconButton({
  icon,
  onPress,
  disabled,
}: {
  icon: IconName;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.iconBtn, disabled && { opacity: 0.4 }]}
      hitSlop={8}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

/** Profile stats row like Hevy: number + label columns */
export function HevyStatsRow({
  items,
}: {
  items: Array<{ value: string | number; label: string }>;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.statsRow}>
      {items.map((item) => (
        <View key={item.label} style={styles.statCol}>
          <Text style={styles.statValue}>{item.value}</Text>
          <Text style={styles.statLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Green profile completion banner */
export function HevyBanner({ text, onPress, onDismiss }: { text: string; onPress?: () => void; onDismiss?: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable style={styles.banner} onPress={onPress}>
      <Text style={styles.bannerText}>{text}</Text>
      <Ionicons name="chevron-forward" size={18} color="#fff" />
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={8} style={styles.bannerDismiss}>
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/** Duration / Volume / Reps segmented control */
export function HevySegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (key: T) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.segmented}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 2x2 dashboard grid like Hevy profile */
export function HevyDashboardGrid({
  items,
}: {
  items: Array<{ icon: IconName; label: string; onPress: () => void }>;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <Pressable key={item.label} style={styles.gridItem} onPress={item.onPress}>
          <Ionicons name={item.icon} size={22} color={colors.text} />
          <Text style={styles.gridLabel}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Modal header: Cancel | Title | Save */
export function HevyModalHeader({
  title,
  onCancel,
  onSave,
  onSaveDisabledTap,
  saveDisabled,
  saveLoading,
}: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  onSaveDisabledTap?: () => void;
  saveDisabled?: boolean;
  saveLoading?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.modalHeader}>
      <Pressable onPress={onCancel} hitSlop={8}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
      <Text style={styles.modalTitle}>{title}</Text>
      <Pressable
        onPress={() => {
          if (saveLoading) return;
          if (saveDisabled) onSaveDisabledTap?.();
          else onSave();
        }}
        hitSlop={8}
      >
        <View style={[styles.saveBtn, (saveDisabled || saveLoading) && styles.saveBtnDisabled]}>
          <Text style={styles.saveText}>{saveLoading ? "…" : "Save"}</Text>
        </View>
      </Pressable>
    </View>
  );
}

/** Yellow info strip on create routine */
export function HevyInfoStrip({ text, onDismiss }: { text: string; onDismiss?: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.infoStrip}>
      <Text style={styles.infoText}>{text}</Text>
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={18} color="#1a1a1a" />
        </Pressable>
      ) : null}
    </View>
  );
}

export const HevyUnderlineInput = forwardRef<
  TextInput,
  {
    placeholder: string;
    value: string;
    onChangeText: (t: string) => void;
    error?: boolean;
  }
>(function HevyUnderlineInput({ placeholder, value, onChangeText, error }, ref) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TextInput
      ref={ref}
      placeholder={placeholder}
      placeholderTextColor={colors.textDim}
      value={value}
      onChangeText={onChangeText}
      style={[
        styles.underlineInput,
        error && { borderBottomColor: colors.danger, borderBottomWidth: 1 },
      ]}
    />
  );
});

/** Centered stack header with optional back — Hevy Explore style */
export function HevyStackHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stackHeader}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} style={styles.stackBack}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.stackBack} />
      )}
      <Text style={styles.stackTitle}>{title}</Text>
      <View style={styles.stackRight}>{right}</View>
    </View>
  );
}

/** Horizontal filter chips — Filters / Level / Goal / Equipment */
export function HevyFilterBar({
  chips,
}: {
  chips: Array<{
    key: string;
    label: string;
    icon?: IconName;
    active?: boolean;
    onPress: () => void;
  }>;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.filterRow}>
      {chips.map((chip) => (
        <Pressable
          key={chip.key}
          onPress={chip.onPress}
          style={[styles.filterChip, chip.active && styles.filterChipActive]}
        >
          {chip.icon ? <Ionicons name={chip.icon} size={14} color={chip.active ? "#fff" : colors.text} /> : null}
          <Text style={[styles.filterChipText, chip.active && styles.filterChipTextActive]}>{chip.label}</Text>
          {chip.key !== "filters" ? (
            <Ionicons name="chevron-down" size={12} color={chip.active ? "#fff" : colors.textMuted} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

/** Program card — badge graphic + title + routine count */
export function HevyProgramCard({
  badge,
  badgeColor,
  title,
  routineCount,
  onPress,
}: {
  badge: string;
  badgeColor: string;
  title: string;
  routineCount: number;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable style={styles.programCard} onPress={onPress}>
      <View style={[styles.programBadge, { backgroundColor: badgeColor }]}>
        <Text style={styles.programBadgeText}>{badge}</Text>
        <Ionicons name="barbell-outline" size={28} color="#1a1a1a" style={styles.programBadgeIcon} />
      </View>
      <View style={styles.programInfo}>
        <Text style={styles.programTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.programMeta}>{routineCount} routine{routineCount === 1 ? "" : "s"}</Text>
      </View>
    </Pressable>
  );
}

/** Personalized program promo card */
export function HevyTrainerCard({ onPress }: { onPress?: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.trainerCard}>
      <Text style={styles.trainerTitle}>Personalized Program</Text>
      <Text style={styles.trainerSubtitle}>Based on your needs & goals</Text>
      <Pressable style={styles.trainerCta} onPress={onPress}>
        <Text style={styles.trainerCtaText}>Explore now</Text>
      </Pressable>
    </View>
  );
}

/** Category grid tile — label + emoji icon */
export function HevyCategoryTile({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable style={styles.categoryTile} onPress={onPress}>
      <Text style={styles.categoryLabel}>{label}</Text>
      <Text style={styles.categoryIcon}>{icon}</Text>
    </Pressable>
  );
}

/** Full-width secondary button */
export function HevyOutlineButton({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable style={styles.outlineBtn} onPress={onPress}>
      <Text style={styles.outlineBtnText}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 44,
      marginBottom: spacing.sm,
    },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1, minWidth: 0 },
    title: { ...typography.h1, color: colors.text },
    actions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    iconBtn: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
    statsRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.sm },
    statCol: { gap: 2 },
    statValue: { fontSize: 16, fontWeight: "700", color: colors.text },
    statLabel: { fontSize: 13, color: colors.textMuted },
    banner: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.accent,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    bannerText: { flex: 1, color: "#fff", fontSize: 15, fontWeight: "500" },
    bannerDismiss: { marginLeft: spacing.xs },
    segmented: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: radius.full,
      padding: 4,
      gap: 4,
    },
    segment: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radius.full,
      alignItems: "center",
    },
    segmentActive: { backgroundColor: colors.accent },
    segmentText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
    segmentTextActive: { color: "#fff" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    gridItem: {
      width: "48%",
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: 56,
    },
    gridLabel: { fontSize: 16, fontWeight: "500", color: colors.text },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    cancelText: { color: colors.accent, fontSize: 17, fontWeight: "400", minWidth: 70 },
    modalTitle: { fontSize: 17, fontWeight: "600", color: colors.text },
    saveBtn: {
      backgroundColor: colors.surfaceHover,
      borderRadius: radius.full,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      minWidth: 70,
      alignItems: "center",
    },
    saveBtnDisabled: { opacity: 0.45 },
    saveText: { color: colors.text, fontSize: 15, fontWeight: "600" },
    infoStrip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#f5e6a3",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    infoText: { flex: 1, color: "#1a1a1a", fontSize: 14, fontWeight: "500" },
    underlineInput: {
      fontSize: 17,
      color: colors.text,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    stackHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 44,
      marginBottom: spacing.md,
    },
    stackBack: { width: 44, alignItems: "flex-start" },
    stackTitle: { fontSize: 17, fontWeight: "600", color: colors.text, textAlign: "center", flex: 1 },
    stackRight: { width: 44, alignItems: "flex-end" },
    filterRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.surface,
      borderRadius: radius.full,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    filterChipActive: { backgroundColor: colors.accent },
    filterChipText: { color: colors.text, fontSize: 14, fontWeight: "500" },
    filterChipTextActive: { color: "#fff" },
    programCard: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.md,
      alignItems: "center",
    },
    programBadge: {
      width: 88,
      height: 88,
      borderRadius: radius.md,
      padding: spacing.sm,
      justifyContent: "space-between",
      overflow: "hidden",
    },
    programBadgeText: {
      fontSize: 11,
      fontWeight: "800",
      color: "#1a1a1a",
      fontStyle: "italic",
      lineHeight: 13,
    },
    programBadgeIcon: { alignSelf: "flex-end", opacity: 0.5 },
    programInfo: { flex: 1, gap: 6 },
    programTitle: { fontSize: 16, fontWeight: "600", color: colors.text, lineHeight: 22 },
    programMeta: { fontSize: 14, color: colors.textMuted },
    trainerCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      gap: spacing.sm,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    trainerTitle: { fontSize: 20, fontWeight: "800", color: colors.text, textAlign: "center" },
    trainerSubtitle: { fontSize: 14, fontWeight: "500", color: colors.textMuted, textAlign: "center" },
    trainerCta: {
      alignSelf: "stretch",
      marginTop: spacing.md,
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: 14,
      alignItems: "center",
    },
    trainerCtaText: { fontSize: 16, fontWeight: "700", color: "#fff" },
    categoryTile: {
      flexBasis: "48%",
      flexGrow: 1,
      maxWidth: "48%",
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 64,
    },
    categoryLabel: { fontSize: 16, fontWeight: "500", color: colors.text, flex: 1 },
    categoryIcon: { fontSize: 28 },
    outlineBtn: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingVertical: 16,
      alignItems: "center",
    },
    outlineBtnText: { fontSize: 16, fontWeight: "600", color: colors.text },
  });
