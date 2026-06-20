import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from "react-native";
import { colors, radius, spacing } from "../lib/theme";

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
}: {
  icon: IconName;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.iconBtn} hitSlop={8}>
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

/** Dark blue profile completion banner */
export function HevyBanner({ text, onPress, onDismiss }: { text: string; onPress?: () => void; onDismiss?: () => void }) {
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
  saveDisabled,
  saveLoading,
}: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
  saveLoading?: boolean;
}) {
  return (
    <View style={styles.modalHeader}>
      <Pressable onPress={onCancel} hitSlop={8}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
      <Text style={styles.modalTitle}>{title}</Text>
      <Pressable onPress={onSave} disabled={saveDisabled || saveLoading} hitSlop={8}>
        <View style={[styles.saveBtn, (saveDisabled || saveLoading) && styles.saveBtnDisabled]}>
          <Text style={styles.saveText}>{saveLoading ? "…" : "Save"}</Text>
        </View>
      </Pressable>
    </View>
  );
}

/** Yellow info strip on create routine */
export function HevyInfoStrip({ text, onDismiss }: { text: string; onDismiss?: () => void }) {
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

export function HevyUnderlineInput({
  placeholder,
  value,
  onChangeText,
}: {
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
}) {
  return (
    <TextInput
      placeholder={placeholder}
      placeholderTextColor={colors.textDim}
      value={value}
      onChangeText={onChangeText}
      style={styles.underlineInput}
    />
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    marginBottom: spacing.sm,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  title: { fontSize: 28, fontWeight: "700", color: colors.text },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconBtn: { padding: 4 },
  statsRow: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.sm },
  statCol: { gap: 2 },
  statValue: { fontSize: 16, fontWeight: "700", color: colors.text },
  statLabel: { fontSize: 13, color: colors.textMuted },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e3a5f",
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
});
