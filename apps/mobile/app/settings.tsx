import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Screen } from "../src/components/ui";
import { HevyStackHeader } from "../src/components/hevy-ui";
import { useAuth } from "../src/lib/auth-context";
import { trpc } from "../src/lib/trpc";
import { formatRestTime } from "../src/lib/rest-timer";
import {
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Palette,
  type ThemeMode,
} from "../src/lib/theme";

const THEME_OPTIONS: Array<{ key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "system", label: "System", icon: "phone-portrait-outline" },
  { key: "light", label: "Light", icon: "sunny-outline" },
  { key: "dark", label: "Dark", icon: "moon-outline" },
];

const UNIT_OPTIONS = [
  { key: "KG" as const, label: "Kilograms (kg)" },
  { key: "LBS" as const, label: "Pounds (lbs)" },
];

const REST_PRESETS = [60, 90, 120, 180, 300];

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { colors, mode, setMode } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const utils = trpc.useUtils();
  const { data: user } = trpc.auth.me.useQuery();

  const [weightUnit, setWeightUnit] = useState<"KG" | "LBS">("KG");
  const [restSeconds, setRestSeconds] = useState(90);

  useEffect(() => {
    if (user?.weightUnit) setWeightUnit(user.weightUnit);
    if (user?.defaultRestSeconds) setRestSeconds(user.defaultRestSeconds);
  }, [user?.weightUnit, user?.defaultRestSeconds]);

  const savePrefs = trpc.auth.updatePreferences.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
    onError: (e) => alert(e.message),
  });

  const persist = (patch: { weightUnit?: "KG" | "LBS"; defaultRestSeconds?: number }) => {
    savePrefs.mutate(patch);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <Screen scroll>
      <HevyStackHeader title="Settings" onBack={() => router.back()} />

      <Text style={styles.sectionLabel}>Appearance</Text>
      <View style={styles.group}>
        {THEME_OPTIONS.map((opt, i) => {
          const active = mode === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setMode(opt.key)}
              style={[styles.row, i < THEME_OPTIONS.length - 1 && styles.rowBorder]}
            >
              <Ionicons name={opt.icon} size={20} color={colors.textMuted} />
              <Text style={styles.rowLabel}>{opt.label}</Text>
              {active ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
              ) : (
                <View style={styles.radioEmpty} />
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Workout</Text>
      <View style={styles.group}>
        {UNIT_OPTIONS.map((opt, i) => {
          const active = weightUnit === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => {
                setWeightUnit(opt.key);
                persist({ weightUnit: opt.key });
              }}
              style={[styles.row, i < UNIT_OPTIONS.length - 1 && styles.rowBorder]}
            >
              <Ionicons name="barbell-outline" size={20} color={colors.textMuted} />
              <Text style={styles.rowLabel}>{opt.label}</Text>
              {active ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
              ) : (
                <View style={styles.radioEmpty} />
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Default rest timer</Text>
      <View style={styles.restRow}>
        {REST_PRESETS.map((sec) => (
          <Pressable
            key={sec}
            onPress={() => {
              setRestSeconds(sec);
              persist({ defaultRestSeconds: sec });
            }}
            style={[styles.restChip, restSeconds === sec && styles.restChipActive]}
          >
            <Text style={[styles.restChipText, restSeconds === sec && styles.restChipTextActive]}>
              {formatRestTime(sec)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Tools</Text>
      <View style={styles.group}>
        <Pressable style={styles.row} onPress={() => router.push("/tools")}>
          <Ionicons name="calculator-outline" size={20} color={colors.textMuted} />
          <Text style={styles.rowLabel}>Plate & warm-up calculator</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
        </Pressable>
      </View>

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

      <Text style={styles.sectionLabel}>About</Text>
      <View style={styles.group}>
        <View style={styles.row}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
          <Text style={styles.rowLabel}>Kak Fit</Text>
          <Text style={styles.rowValue}>v0.2.0 · Free</Text>
        </View>
      </View>

      <Button label="Sign Out" variant="danger" fullWidth onPress={handleSignOut} />
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    sectionLabel: {
      fontSize: 13,
      color: colors.textMuted,
      fontWeight: "600",
      marginTop: spacing.sm,
      marginLeft: spacing.xs,
    },
    group: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      overflow: "hidden",
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
    rowLabel: { flex: 1, fontSize: 16, color: colors.text },
    rowValue: { fontSize: 14, color: colors.textMuted },
    radioEmpty: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.border,
    },
    restRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    restChip: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    restChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    restChipText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
    restChipTextActive: { color: colors.onAccent },
  });
