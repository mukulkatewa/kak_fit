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
  useWindowDimensions,
  type PressableProps,
  type ScrollViewProps,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import {
  ChevronRightIcon,
  MagnifyingGlassIcon,
  XCircleIcon,
} from "react-native-heroicons/outline";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { create } from "zustand";
import { useScreenBottomInset, useScreenTopInset, type ScreenLayoutVariant } from "../lib/layout-constants";
import { useWorkoutPillInset } from "../lib/workout-pill-inset";
import { useResponsive } from "../lib/responsive";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  radius,
  spacing,
  typography,
  useTheme,
  useThemedStyles,
  type Palette,
  type ShadowSet,
} from "../lib/theme";

type IconName = keyof typeof Ionicons.glyphMap;

function usePressScale(activeScale = 0.98) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const onPressIn = () => {
    scale.value = withTiming(activeScale, { duration: 80 });
  };
  const onPressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
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
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useResponsive();
  const workoutPillVisible = useWorkoutPillInset((s) => s.visible);
  const bottomPad = useScreenBottomInset(
    variant,
    variant === "tab" && workoutPillVisible,
  );
  const internalScrollRef = useRef<ScrollView>(null);
  const resolvedScrollRef = scrollViewRef ?? internalScrollRef;

  useScrollToTop(resolvedScrollRef);

  const innerStyle = [
    padded ? styles.screenInner : styles.screenInnerFlush,
    padded && { paddingHorizontal: horizontalPadding },
    !scroll && { paddingBottom: bottomPad },
    style,
  ];

  const content = <View style={innerStyle}>{children}</View>;

  return (
    <View style={[styles.screen, { paddingTop: topInset, paddingLeft: insets.left, paddingRight: insets.right }]}>
      {scroll ? (
        <ScrollView
          ref={resolvedScrollRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          bounces={Platform.OS === "ios"}
          overScrollMode={Platform.OS === "android" ? "never" : undefined}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPad },
          ]}
          contentInsetAdjustmentBehavior="never"
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
        <Pressable onPress={onAction} hitSlop={8} style={{ flexShrink: 0 }}>
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
  const { colors, shadows } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View
      style={[
        styles.card,
        glow && shadows.glow(colors.accent),
        style,
      ]}
    >
      {children}
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
  const { style, onPressIn, onPressOut } = usePressScale();

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

export function Title({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={styles.title}>{children}</Text>;
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
  const { style, onPressIn, onPressOut } = usePressScale();
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
  const isPrimary = btn.variant === "primary";
  const isDestructive = btn.variant === "destructive";

  const handlePress = () => {
    btn.onPress?.();
    const shouldDismiss = btn.dismissOnPress ?? btn.variant !== "destructive";
    if (shouldDismiss) {
      onDismiss?.();
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.dialogBtn,
        isPrimary && styles.dialogBtnPrimary,
        isDestructive && styles.dialogBtnDestructive,
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
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
  const { height } = useWindowDimensions();
  const paddingTop = Math.max(insets.top, spacing.xl);
  const paddingBottom = Math.max(insets.bottom, spacing.xl);

  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onDismiss}>
      {visible ? (
        <Animated.View
          entering={FadeIn.duration(120)}
          style={[
            styles.dialogBackdrop,
            {
              paddingTop,
              paddingBottom,
              paddingHorizontal: spacing.xl,
            },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss dialog" />
          <Animated.View
            entering={FadeIn.duration(120)}
            style={[styles.dialogCard, { maxHeight: height - paddingTop - paddingBottom }]}
            accessibilityViewIsModal
          >
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={styles.dialogContent} bounces={false}>
              <Text style={styles.dialogTitle} accessibilityRole="header">{title}</Text>
              {message ? <Text style={styles.dialogMessage}>{message}</Text> : null}
              <View style={styles.dialogActions}>
                {buttons.map((btn, i) => (
                  <DialogActionButton key={`${btn.label}-${i}`} btn={btn} onDismiss={onDismiss} />
                ))}
              </View>
            </ScrollView>
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
        <Animated.View entering={FadeIn.duration(160)} style={styles.emptyIcon}>
          <Ionicons name={icon} size={30} color={colors.textDim} />
        </Animated.View>
      ) : null}
      <Animated.Text entering={FadeIn.duration(160)} style={styles.emptyTitle}>
        {title}
      </Animated.Text>
      <Animated.Text entering={FadeIn.duration(160)} style={styles.emptyMessage}>
        {message}
      </Animated.Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (colors: Palette, shadows: ShadowSet) =>
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
    screenInnerFlush: { minHeight: 0, gap: spacing.lg },
    scrollView: {
      flex: 1,
      ...(Platform.OS === "web" ? { minHeight: 0, overflow: "scroll" as const } : null),
    },
    scrollContent: { flexGrow: 0 },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      minHeight: 44,
      marginBottom: spacing.xs,
    },
    headerText: { flex: 1, minWidth: 0, gap: 4 },
    headerTitle: { ...typography.h1, color: colors.text },
    headerSubtitle: { ...typography.caption, color: colors.textMuted },
    headerAction: { marginLeft: spacing.md, marginTop: 8, flexShrink: 0 },

    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: spacing.sm,
      gap: spacing.md,
    },
    sectionTitle: { ...typography.h2, color: colors.text, flex: 1, minWidth: 0 },
    sectionAction: { ...typography.caption, color: colors.accent },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
    },

    statBlock: { flex: 1, alignItems: "center", gap: 2 },
    statBlockValue: { ...typography.h2, color: colors.text },
    statBlockLabel: { ...typography.label, color: colors.textMuted },

    listGroup: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      overflow: "hidden",
    },

    avatar: {
      backgroundColor: colors.surfaceHover,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { ...typography.bodySmall, fontWeight: "600", color: colors.text }, // custom: large brand mark
    title: { ...typography.h1, color: colors.text },

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
    buttonInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, maxWidth: "100%" },
    buttonText: { ...typography.button, flexShrink: 1, textAlign: "center" },
    buttonTextSm: { ...typography.body, fontWeight: "600", flexShrink: 1, textAlign: "center" },
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
      textAlign: "center",
      flexShrink: 1,
    },
    hevyButtonTextSecondary: {
      color: colors.accent,
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

    dialogBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
    },
    dialogCard: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: colors.bgElevated,
      borderRadius: radius.lg,
      overflow: "hidden",
      flexShrink: 1,
      borderWidth: 1,
      borderColor: colors.border,
      zIndex: 1,
    },
    dialogContent: { padding: spacing.xl, gap: spacing.md },
    dialogTitle: { ...typography.h2, color: colors.text },
    dialogMessage: { ...typography.body, color: colors.textMuted },
    dialogActions: {
      alignItems: "stretch",
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    dialogBtn: {
      width: "100%",
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    dialogBtnPrimary: { backgroundColor: colors.accent },
    dialogBtnDestructive: { backgroundColor: colors.dangerMuted },
    dialogBtnText: { ...typography.body, fontWeight: "600", color: colors.textMuted, textAlign: "center", flexShrink: 1 },
    dialogBtnTextPrimary: { color: colors.onAccent },
    dialogBtnTextDestructive: { color: colors.danger, fontWeight: "700" },
  });

// ─── Toast ────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info";

type ToastStore = {
  visible: boolean;
  message: string;
  type: ToastType;
  onPress: (() => void) | null;
  showToast: (message: string, type?: ToastType, options?: { onPress?: () => void }) => void;
  hideToast: () => void;
};

let toastHideTimer: ReturnType<typeof setTimeout> | null = null;

const useToastStore = create<ToastStore>((set) => ({
  visible: false,
  message: "",
  type: "info",
  onPress: null,
  showToast: (message, type = "info", options) => {
    if (toastHideTimer) clearTimeout(toastHideTimer);
    set({ visible: true, message, type, onPress: options?.onPress ?? null });
    const duration = options?.onPress ? 8000 : 2500;
    toastHideTimer = setTimeout(() => {
      set({ visible: false, onPress: null });
      toastHideTimer = null;
    }, duration);
  },
  hideToast: () => {
    if (toastHideTimer) clearTimeout(toastHideTimer);
    toastHideTimer = null;
    set({ visible: false, onPress: null });
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
export function showAppToast(
  message: string,
  type: ToastType = "info",
  options?: { onPress?: () => void },
) {
  useToastStore.getState().showToast(message, type, options);
}

export function ToastContainer() {
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const visible = useToastStore((s) => s.visible);
  const message = useToastStore((s) => s.message);
  const type = useToastStore((s) => s.type);
  const onPress = useToastStore((s) => s.onPress);
  const hideToast = useToastStore((s) => s.hideToast);
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
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: insets.bottom + 16,
        left: 16,
        right: 16,
        opacity,
        zIndex: 1000,
      }}
    >
      <Pressable
        onPress={() => {
          if (!onPress) return;
          hideToast();
          onPress();
        }}
        style={{
          backgroundColor,
          borderRadius: radius.lg,
          borderWidth,
          borderColor,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          ...shadows.md,
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
      </Pressable>
    </RNAnimated.View>
  );
}

// Legacy alias
export { ListRow as ListItem };
