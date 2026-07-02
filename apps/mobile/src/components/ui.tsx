import { Ionicons } from "@expo/vector-icons";
import { useScrollToTop } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated as RNAnimated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import {
  ChevronRightIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XCircleIcon,
} from "react-native-heroicons/outline";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { create } from "zustand";
import { SPRING_CONFIG } from "../lib/animations";
import { useScreenBottomInset, useScreenTopInset, type ScreenLayoutVariant } from "../lib/layout-constants";
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

function usePressScale(activeScale = 0.95) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const onPressIn = () => {
    scale.value = withSpring(activeScale, SPRING_CONFIG.snappy);
  };
  const onPressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG.snappy);
  };
  return { style, onPressIn, onPressOut };
}

// ─── Layout ─────────────────────────────────────────────────────────────────

export function Screen({
  children,
  scroll,
  style,
  padded = true,
  refreshControl,
  scrollViewRef,
  variant = "stack",
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  padded?: boolean;
  refreshControl?: ScrollViewProps["refreshControl"];
  scrollViewRef?: React.RefObject<ScrollView | null>;
  /** Layout context — tab screens reserve space for tab bar overlay and active-workout pill. */
  variant?: ScreenLayoutVariant;
}) {
  const styles = useThemedStyles(makeStyles);
  const topInset = useScreenTopInset(variant);
  const bottomPad = useScreenBottomInset(variant);
  const internalScrollRef = useRef<ScrollView>(null);
  const resolvedScrollRef = scrollViewRef ?? internalScrollRef;

  useScrollToTop(resolvedScrollRef);

  const innerStyle = [
    padded ? styles.screenInner : styles.screenInnerFlush,
    !scroll && { paddingBottom: bottomPad },
    style,
  ];

  const content = <View style={innerStyle}>{children}</View>;

  return (
    <View style={[styles.screen, { paddingTop: topInset }]}>
      {scroll ? (
        <ScrollView
          ref={resolvedScrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPad },
          ]}
          contentInsetAdjustmentBehavior={Platform.OS === "ios" ? "automatic" : undefined}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          refreshControl={refreshControl}
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
  const { style, onPressIn, onPressOut } = usePressScale(0.95);

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.chip, active && styles.chipActive]}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </Pressable>
    </Animated.View>
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
  const { style, onPressIn, onPressOut } = usePressScale(0.95);

  const content = loading ? (
    <ActivityIndicator color={variant === "secondary" ? colors.accent : "#fff"} size="small" />
  ) : (
    <Text style={[styles.hevyButtonText, variant === "secondary" && styles.hevyButtonTextSecondary]}>
      {label}
    </Text>
  );

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={loading}
        style={loading && styles.buttonDisabled}
      >
        {variant === "primary" ? (
          <LinearGradient
            colors={[colors.accentBright, colors.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hevyButton}
          >
            {content}
          </LinearGradient>
        ) : (
          <View style={[styles.hevyButton, styles.hevyButtonSecondary]}>{content}</View>
        )}
      </Pressable>
    </Animated.View>
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
  /** lg = 56px primary, md = 52px secondary, sm = 44px compact */
  size?: "lg" | "md" | "sm";
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { style, onPressIn, onPressOut } = usePressScale(0.95);
  const resolvedSize = size ?? (variant === "primary" ? "lg" : "md");
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
    <Animated.View style={[style, fullWidth && styles.buttonFull]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        style={[
          styles.button,
          resolvedSize === "lg"
            ? styles.buttonLg
            : resolvedSize === "sm"
              ? styles.buttonSm
              : styles.buttonMd,
          fullWidth && styles.buttonFullInner,
          variant === "secondary" && styles.buttonSecondary,
          variant === "ghost" && styles.buttonGhost,
          variant === "danger" && styles.buttonDanger,
          variant === "gold" && styles.buttonGold,
          (disabled || loading) && styles.buttonDisabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={tint} size="small" />
        ) : (
          <View style={styles.buttonInner}>
            {icon ? <Ionicons name={icon} size={resolvedSize === "sm" ? 16 : 18} color={tint} /> : null}
            <Text
              style={[
                resolvedSize === "sm" ? styles.buttonTextSm : styles.buttonText,
                { color: tint },
              ]}
            >
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function FAB({ onPress, icon = "add" }: { onPress: () => void; icon?: IconName }) {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const scale = useSharedValue(1);
  const shadowPulse = useSharedValue(0.35);

  useEffect(() => {
    shadowPulse.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: 1200 }),
        withTiming(0.25, { duration: 1200 }),
      ),
      -1,
      true,
    );
  }, [shadowPulse]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    shadowOpacity: shadowPulse.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, SPRING_CONFIG.snappy);
  };

  const handlePressOut = () => {
    scale.value = withSequence(
      withSpring(1.1, SPRING_CONFIG.snappy),
      withSpring(1, SPRING_CONFIG.snappy),
    );
  };

  return (
    <Animated.View
      style={[
        styles.fab,
        !isDark && {
          shadowColor: colors.accent,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        },
        shadowStyle,
        scaleStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.fabInner}
      >
        {icon === "add" ? (
          <PlusIcon color={colors.onAccent} size={26} />
        ) : (
          <Ionicons name={icon} size={26} color={colors.onAccent} />
        )}
      </Pressable>
    </Animated.View>
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
  const [focused, setFocused] = useState(false);
  const focusProgress = useSharedValue(0);

  useEffect(() => {
    focusProgress.value = withTiming(focused ? 1 : 0, { duration: 200 });
  }, [focused, focusProgress]);

  const barStyle = useAnimatedStyle(() => ({
    borderWidth: 1,
    borderColor: focusProgress.value > 0.5 ? colors.accent : "transparent",
  }));

  return (
    <Animated.View style={[styles.searchBar, barStyle]}>
      <MagnifyingGlassIcon color={colors.textDim} size={18} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? "Search..."}
        placeholderTextColor={colors.textDim}
        style={styles.searchInput}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText("")} hitSlop={8}>
          <XCircleIcon color={colors.textDim} size={18} />
        </Pressable>
      ) : null}
    </Animated.View>
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
  onLongPress,
  right,
  icon,
  gold,
  last,
}: {
  title: string;
  subtitle?: string;
  onPress?: PressableProps["onPress"];
  onLongPress?: PressableProps["onLongPress"];
  right?: React.ReactNode;
  icon?: IconName;
  gold?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { style, onPressIn, onPressOut } = usePressScale(0.98);
  const interactive = Boolean(onPress || onLongPress);

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={interactive ? onPressIn : undefined}
        onPressOut={interactive ? onPressOut : undefined}
        disabled={!interactive}
        style={[styles.listRow, !last && styles.listRowBorder]}
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
        {right ?? (onPress ? <ChevronRightIcon color={colors.textDim} size={16} /> : null)}
      </Pressable>
    </Animated.View>
  );
}

function DialogActionButton({
  btn,
  onDismiss,
}: {
  btn: {
    label: string;
    onPress?: () => void;
    variant?: "primary" | "secondary" | "destructive";
    dismissOnPress?: boolean;
  };
  onDismiss?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const scale = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const isPrimary = btn.variant === "primary";
  const isDestructive = btn.variant === "destructive";

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: shakeX.value }],
  }));

  const handlePress = () => {
    if (isDestructive) {
      shakeX.value = withSequence(
        withTiming(-5, { duration: 45 }),
        withTiming(5, { duration: 45 }),
        withTiming(-4, { duration: 45 }),
        withTiming(0, { duration: 45 }),
      );
    }
    btn.onPress?.();
    const shouldDismiss = btn.dismissOnPress ?? btn.variant !== "destructive";
    if (shouldDismiss) {
      onDismiss?.();
    }
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={[
          styles.dialogBtn,
          isPrimary && styles.dialogBtnPrimary,
          isDestructive && styles.dialogBtnDestructive,
        ]}
        onPress={handlePress}
        onPressIn={() => {
          if (isPrimary) {
            scale.value = withSpring(0.95, SPRING_CONFIG.snappy);
          }
        }}
        onPressOut={() => {
          if (isPrimary) {
            scale.value = withSpring(1, SPRING_CONFIG.snappy);
          }
        }}
      >
        <Text
          style={[
            styles.dialogBtnText,
            isPrimary && styles.dialogBtnTextPrimary,
            isDestructive && styles.dialogBtnTextDestructive,
          ]}
        >
          {btn.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function ThemedDialog({
  visible,
  title,
  message,
  buttons,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  message?: string;
  buttons: Array<{
    label: string;
    onPress?: () => void;
    variant?: "primary" | "secondary" | "destructive";
    /** When false, dialog stays open after press (e.g. async destructive actions). Default: true except destructive. */
    dismissOnPress?: boolean;
  }>;
  onDismiss?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      {visible ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[
            styles.dialogBackdrop,
            {
              paddingTop: Math.max(insets.top, spacing.xl),
              paddingBottom: Math.max(insets.bottom, spacing.xl),
              paddingHorizontal: spacing.xl,
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onDismiss} accessibilityRole="button" />
          <Animated.View
            entering={FadeInUp.springify().damping(16)}
            style={styles.dialogCard}
            accessibilityViewIsModal
          >
            <Text style={styles.dialogTitle}>{title}</Text>
            {message ? <Text style={styles.dialogMessage}>{message}</Text> : null}
            <View style={styles.dialogActions}>
              {buttons.map((btn) => (
                <DialogActionButton key={btn.label} btn={btn} onDismiss={onDismiss} />
              ))}
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}
    </Modal>
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
        <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.emptyIcon}>
          <Ionicons name={icon} size={30} color={colors.textDim} />
        </Animated.View>
      ) : null}
      <Animated.Text entering={FadeInDown.delay(100).springify().damping(16)} style={styles.emptyTitle}>
        {title}
      </Animated.Text>
      <Animated.Text entering={FadeInDown.delay(160).springify().damping(16)} style={styles.emptyMessage}>
        {message}
      </Animated.Text>
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
  const percentage = target > 0 ? Math.min(1, value / target) : 0;
  const pct = Math.round(percentage * 100);
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
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
      ...(Platform.OS === "web" ? { minHeight: 0, height: "100%" as const } : null),
    },
    screenInner: {
      flex: 1,
      minHeight: 0,
      paddingHorizontal: spacing.lg,
      gap: spacing.lg,
    },
    screenInnerFlush: { flex: 1, minHeight: 0, gap: spacing.lg },
    scrollContent: { flexGrow: 1 },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      minHeight: 44,
      marginBottom: spacing.xs,
    },
    headerText: { flex: 1, gap: 4 },
    headerTitle: { ...typography.h1, color: colors.text },
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
    statValue: { fontSize: 22, fontWeight: "700", color: colors.text }, // custom: stat emphasis
    statValueAccent: { color: colors.accent },
    statValueGold: { color: colors.gold },
    statLabel: { ...typography.label, color: colors.textMuted },

    statBlock: { flex: 1, alignItems: "center", gap: 2 },
    statBlockValue: { ...typography.h2, color: colors.text },
    statBlockLabel: { ...typography.label, color: colors.textMuted },

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
    prBadgeText: { ...typography.label, color: colors.gold },

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
    streakEmoji: { fontSize: 14 }, // emoji size
    streakText: { ...typography.caption, color: colors.textMuted },

    xpContainer: { gap: spacing.sm },
    xpHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    xpLevelBadge: {
      backgroundColor: colors.accentMuted,
      borderRadius: radius.sm,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    xpLevel: { ...typography.label, color: colors.accent },
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
    scoreValue: { fontSize: 24, fontWeight: "700", color: colors.text }, // custom: ring score
    scoreLabel: { ...typography.label, fontSize: 9, color: colors.textMuted }, // custom: compact ring label

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
    avatarText: { ...typography.bodySmall, fontWeight: "600", color: colors.text },

    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceHover,
    },
    chipActive: { backgroundColor: colors.accent },
    chipText: { ...typography.caption, color: colors.textMuted },
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
    brandMark: { ...typography.body, fontWeight: "600", color: colors.text },
    brandMarkLarge: { fontSize: 28, fontWeight: "700" }, // custom: large brand mark
    title: { ...typography.h1, color: colors.text },
    subtitle: { ...typography.bodySmall, color: colors.textMuted },

    button: {
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.accent,
    },
    buttonLg: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      minHeight: 56,
      minWidth: 56,
    },
    buttonMd: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      minHeight: 52,
    },
    buttonSm: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      minHeight: 44,
      minWidth: 44,
    },
    buttonFull: { alignSelf: "stretch" },
    buttonFullInner: { alignSelf: "stretch" },
    buttonSecondary: { backgroundColor: colors.surfaceHover },
    buttonGhost: { backgroundColor: "transparent" },
    buttonDanger: { backgroundColor: colors.dangerMuted },
    buttonGold: { backgroundColor: colors.surfaceHover },
    buttonDisabled: { opacity: 0.5 },
    buttonInner: { flexDirection: "row", alignItems: "center", gap: 8 },
    buttonText: { ...typography.button },
    buttonTextSm: { ...typography.body, fontWeight: "600" },
    pressed: { opacity: 0.7 },

    hevyButton: {
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xxl,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 56,
      minWidth: 56,
    },
    hevyButtonSecondary: {
      backgroundColor: colors.surfaceHover,
    },
    hevyButtonText: {
      ...typography.button,
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
      minWidth: 56,
      minHeight: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
    },
    fabInner: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
    },

    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceHover,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
      minHeight: 44,
    },
    searchInput: { flex: 1, color: colors.text, ...typography.body, paddingVertical: 8 },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      color: colors.text,
      ...typography.body,
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
    listRowTitle: { ...typography.body, color: colors.text },
    listRowSubtitle: { ...typography.caption, color: colors.textMuted },

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
    macroRingValue: { ...typography.body, fontWeight: "700" },
    macroRingLabel: { ...typography.caption, color: colors.textMuted },
    macroRingTarget: { ...typography.label, color: colors.textDim },

    dialogBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    dialogCard: {
      width: "100%",
      maxWidth: 340,
      backgroundColor: colors.bgElevated,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      zIndex: 1,
    },
    dialogTitle: { ...typography.h2, color: colors.text },
    dialogMessage: { ...typography.body, color: colors.textMuted },
    dialogActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    dialogBtn: {
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
    },
    dialogBtnPrimary: { backgroundColor: colors.accent },
    dialogBtnDestructive: { backgroundColor: colors.dangerMuted },
    dialogBtnText: { ...typography.body, fontWeight: "600", color: colors.textMuted },
    dialogBtnTextPrimary: { color: colors.onAccent },
    dialogBtnTextDestructive: { color: colors.danger, fontWeight: "700" },
  });

// ─── Toast ────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info";

type ToastStore = {
  visible: boolean;
  message: string;
  type: ToastType;
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
};

let toastHideTimer: ReturnType<typeof setTimeout> | null = null;

const useToastStore = create<ToastStore>((set) => ({
  visible: false,
  message: "",
  type: "info",
  showToast: (message, type = "info") => {
    if (toastHideTimer) clearTimeout(toastHideTimer);
    set({ visible: true, message, type });
    toastHideTimer = setTimeout(() => {
      set({ visible: false });
      toastHideTimer = null;
    }, 2500);
  },
  hideToast: () => {
    if (toastHideTimer) clearTimeout(toastHideTimer);
    toastHideTimer = null;
    set({ visible: false });
  },
}));

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const showToast = useToastStore((s) => s.showToast);
  const value = useMemo(() => ({ showToast }), [showToast]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  const showToast = useToastStore((s) => s.showToast);
  return useMemo(
    () => ({ showToast: ctx?.showToast ?? showToast }),
    [ctx, showToast],
  );
}

/** Imperative toast for modules outside React (e.g. auth refresh). */
export function showAppToast(message: string, type: ToastType = "info") {
  useToastStore.getState().showToast(message, type);
}

export function ToastContainer() {
  const { colors, shadows } = useTheme();
  const visible = useToastStore((s) => s.visible);
  const message = useToastStore((s) => s.message);
  const type = useToastStore((s) => s.type);
  const opacity = useRef(new RNAnimated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      RNAnimated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      return;
    }
    RNAnimated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
      ({ finished }) => {
        if (finished) setMounted(false);
      },
    );
  }, [visible, opacity]);

  if (!mounted) return null;

  const backgroundColor =
    type === "success" ? colors.success : type === "error" ? colors.danger : colors.surface;
  const textColor = type === "info" ? colors.text : "#FFFFFF";
  const borderWidth = type === "info" ? 1 : 0;
  const borderColor = type === "info" ? colors.border : "transparent";

  return (
    <RNAnimated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        bottom: 100,
        left: 16,
        right: 16,
        opacity,
        zIndex: 1000,
        backgroundColor,
        borderRadius: radius.lg,
        borderWidth,
        borderColor,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        ...shadows.card,
      }}
    >
      <Text
        style={{
          color: textColor,
          textAlign: "center",
          fontSize: 15,
          fontWeight: "600",
          lineHeight: 20,
        }}
      >
        {message}
      </Text>
    </RNAnimated.View>
  );
}

// Legacy alias
export { ListRow as ListItem };
