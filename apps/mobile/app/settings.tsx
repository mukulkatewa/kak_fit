import { useRouter } from "expo-router";
import { useEffect, useState, type FC, type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import {
  CalculatorIcon,
  CheckCircleIcon,
  CommandLineIcon,
  DevicePhoneMobileIcon,
  MoonIcon,
  SunIcon,
} from "react-native-heroicons/outline";
import Animated, {
  FadeInDown,
  ZoomIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Screen } from "../src/components/ui";
import { HevyStackHeader } from "../src/components/hevy-ui";
import { useSpringPress } from "../src/lib/animations";
import { useAuth } from "../src/lib/auth-context";
import { trpc } from "../src/lib/trpc";
import { formatRestTime } from "../src/lib/rest-timer";
import {
  radius,
  spacing,
  typography,
  useTheme,
  useThemedStyles,
  type Palette,
  type ShadowSet,
  type ThemeMode,
} from "../src/lib/theme";
import { BUTTON_HEIGHT_PRIMARY, TOUCH_TARGET_MIN } from "../src/lib/layout-constants";

type ThemeIcon = FC<{ color?: string; size?: number }>;

const THEME_OPTIONS: Array<{ key: ThemeMode; label: string; Icon: ThemeIcon }> = [
  { key: "system", label: "System", Icon: DevicePhoneMobileIcon },
  { key: "light", label: "Light", Icon: SunIcon },
  { key: "dark", label: "Dark", Icon: MoonIcon },
];

const UNIT_OPTIONS = [
  { key: "KG" as const, label: "Kilograms (kg)" },
  { key: "LBS" as const, label: "Pounds (lbs)" },
];

const REST_PRESETS = [60, 90, 120, 180, 300];

function AnimatedSection({
  sectionIndex,
  children,
}: {
  sectionIndex: number;
  children: ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(sectionIndex * 100).springify().damping(16)}>
      {children}
    </Animated.View>
  );
}

function SpringRow({
  onPress,
  bordered,
  children,
}: {
  onPress?: () => void;
  bordered?: boolean;
  children: ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  const { scale, onPressIn, onPressOut } = useSpringPress();

  return (
    <Animated.View style={scale}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={!onPress}
        style={[styles.row, bordered && styles.rowBorder]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function ThemeOptionRow({
  label,
  Icon,
  active,
  bordered,
  onPress,
}: {
  label: string;
  Icon: ThemeIcon;
  active: boolean;
  bordered?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <SpringRow onPress={onPress} bordered={bordered}>
      <Icon color={colors.textMuted} size={20} />
      <Text style={styles.rowLabel}>{label}</Text>
      {active ? (
        <Animated.View entering={ZoomIn.springify().damping(14)}>
          <CheckCircleIcon color={colors.accent} size={22} />
        </Animated.View>
      ) : (
        <View style={styles.radioEmpty} />
      )}
    </SpringRow>
  );
}

function RestTimerChip({
  seconds,
  active,
  onPress,
}: {
  seconds: number;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { scale, onPressIn, onPressOut } = useSpringPress();
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 220 });
  }, [active, progress]);

  const chipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.surface, colors.accent],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.border, colors.accent],
    ),
  }));

  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      [colors.textMuted, colors.onAccent],
    ),
  }));

  return (
    <Animated.View style={scale}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <Animated.View style={[styles.restChip, chipStyle]}>
          <Animated.Text style={[styles.restChipText, textStyle]}>
            {formatRestTime(seconds)}
          </Animated.Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function SignOutButton({ onPress }: { onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { scale, onPressIn, onPressOut } = useSpringPress();

  return (
    <Animated.View style={scale}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.signOutBtn}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { colors, mode, setMode } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const utils = trpc.useUtils();
  const { data: user } = trpc.auth.me.useQuery();

  const [weightUnit, setWeightUnit] = useState<"KG" | "LBS">("KG");
  const [restSeconds, setRestSeconds] = useState(90);
  const [exerciseReminderEnabled, setExerciseReminderEnabled] = useState(true);

  useEffect(() => {
    if (user?.weightUnit) setWeightUnit(user.weightUnit);
    if (user?.defaultRestSeconds) setRestSeconds(user.defaultRestSeconds);
    if (user?.exerciseReminderEnabled != null) {
      setExerciseReminderEnabled(user.exerciseReminderEnabled);
    }
  }, [user?.weightUnit, user?.defaultRestSeconds, user?.exerciseReminderEnabled]);

  const savePrefs = trpc.auth.updatePreferences.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
    onError: (e) => alert(e.message),
  });

  const persist = (patch: {
    weightUnit?: "KG" | "LBS";
    defaultRestSeconds?: number;
    exerciseReminderEnabled?: boolean;
  }) => {
    savePrefs.mutate(patch);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <Screen scroll variant="modal">
      <HevyStackHeader title="Settings" onBack={() => router.back()} />

      <AnimatedSection sectionIndex={0}>
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.group}>
          {THEME_OPTIONS.map((opt, i) => (
            <ThemeOptionRow
              key={opt.key}
              label={opt.label}
              Icon={opt.Icon}
              active={mode === opt.key}
              bordered={i < THEME_OPTIONS.length - 1}
              onPress={() => setMode(opt.key)}
            />
          ))}
        </View>
      </AnimatedSection>

      <AnimatedSection sectionIndex={1}>
        <Text style={styles.sectionLabel}>Workout</Text>
        <View style={styles.group}>
          {UNIT_OPTIONS.map((opt, i) => {
            const active = weightUnit === opt.key;
            return (
              <SpringRow
                key={opt.key}
                bordered={i < UNIT_OPTIONS.length - 1}
                onPress={() => {
                  setWeightUnit(opt.key);
                  persist({ weightUnit: opt.key });
                }}
              >
                <Ionicons name="barbell-outline" size={20} color={colors.textMuted} />
                <Text style={styles.rowLabel}>{opt.label}</Text>
                {active ? (
                  <Animated.View entering={ZoomIn.springify().damping(14)}>
                    <CheckCircleIcon color={colors.accent} size={22} />
                  </Animated.View>
                ) : (
                  <View style={styles.radioEmpty} />
                )}
              </SpringRow>
            );
          })}
        </View>
      </AnimatedSection>

      <AnimatedSection sectionIndex={2}>
        <Text style={styles.sectionLabel}>Default rest timer</Text>
        <View style={styles.restRow}>
          {REST_PRESETS.map((sec) => (
            <RestTimerChip
              key={sec}
              seconds={sec}
              active={restSeconds === sec}
              onPress={() => {
                setRestSeconds(sec);
                persist({ defaultRestSeconds: sec });
              }}
            />
          ))}
        </View>
      </AnimatedSection>

      <AnimatedSection sectionIndex={3}>
        <Text style={styles.sectionLabel}>Reminders</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <Ionicons name="notifications-outline" size={20} color={colors.textMuted} />
            <Text style={styles.rowLabel}>Daily workout reminders</Text>
            <Switch
              value={exerciseReminderEnabled}
              onValueChange={(value) => {
                setExerciseReminderEnabled(value);
                persist({ exerciseReminderEnabled: value });
              }}
              trackColor={{ false: colors.border, true: colors.accentMuted }}
              thumbColor={exerciseReminderEnabled ? colors.accent : colors.textMuted}
            />
          </View>
        </View>
      </AnimatedSection>

      <AnimatedSection sectionIndex={4}>
        <Text style={styles.sectionLabel}>Tools</Text>
        <View style={styles.group}>
          <SpringRow bordered onPress={() => router.push("/tools")}>
            <CalculatorIcon color={colors.textMuted} size={20} />
            <Text style={styles.rowLabel}>Plate & warm-up calculator</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </SpringRow>
          <SpringRow onPress={() => router.push("/developer-api")}>
            <CommandLineIcon color={colors.textMuted} size={20} />
            <Text style={styles.rowLabel}>Developer API</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </SpringRow>
        </View>
      </AnimatedSection>

      <AnimatedSection sectionIndex={5}>
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.group}>
          <View style={[styles.row, styles.rowBorder]}>
            <Ionicons name="person-outline" size={20} color={colors.textMuted} />
            <Text style={styles.rowLabel}>{user?.name ?? "Athlete"}</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
            <Text style={styles.rowLabel} numberOfLines={1}>
              {user?.email ?? ""}
            </Text>
          </View>
        </View>
      </AnimatedSection>

      <AnimatedSection sectionIndex={6}>
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
            <Text style={styles.rowLabel}>Kak Fit</Text>
            <Text style={styles.rowValue}>v0.2.0 · Free</Text>
          </View>
        </View>
      </AnimatedSection>

      <AnimatedSection sectionIndex={7}>
        <SignOutButton onPress={handleSignOut} />
      </AnimatedSection>
    </Screen>
  );
}

const makeStyles = (colors: Palette, shadows: ShadowSet) =>
  StyleSheet.create({
    sectionLabel: {
      ...typography.caption,
      color: colors.textMuted,
      fontWeight: "600",
      marginTop: spacing.sm,
      marginLeft: spacing.xs,
    },
    group: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      overflow: "hidden",
      ...shadows.sm,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      minHeight: 56,
    },
    rowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    rowLabel: { flex: 1, ...typography.body, color: colors.text },
    rowValue: { ...typography.bodySmall, color: colors.textMuted },
    radioEmpty: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.border,
    },
    restRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    restChip: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      minHeight: TOUCH_TARGET_MIN,
      justifyContent: "center",
    },
    restChipText: { ...typography.bodySmall, fontWeight: "600" },
    signOutBtn: {
      backgroundColor: colors.danger,
      borderRadius: radius.lg,
      minHeight: BUTTON_HEIGHT_PRIMARY,
      alignItems: "center",
      justifyContent: "center",
      marginTop: spacing.sm,
    },
    signOutText: { ...typography.button, color: "#fff" },
  });
