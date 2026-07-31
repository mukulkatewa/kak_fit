import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VesselIcon } from "../src/components/vessel-icon";
import { Button, useToast } from "../src/components/ui";
import { parseMealParam, useUsualMealItems } from "../src/hooks/use-usual-meal-items";
import {
  formatAmountLabel,
  scaledLogItem,
  usualHint,
  type ReminderRowItem,
} from "../src/lib/meal-reminder-items";
import { snoozeMealReminder } from "../src/lib/meal-plan-notifications";
import { trpc } from "../src/lib/trpc";
import {
  mealReminderTheme,
  radius,
  spacing,
  typography,
  useTheme,
  type MealTypeKey,
  type Palette,
} from "../src/lib/theme";

const AUTO_SNOOZE_SECONDS = 300;

type RowState = {
  amount: number;
  included: boolean;
};

function buzz(duration = 8) {
  try {
    Vibration.vibrate(duration);
  } catch {
    // no-op on unsupported platforms
  }
}

function mealGlyph(mealType: MealTypeKey) {
  switch (mealType) {
    case "BREAKFAST":
      return "sunny-outline" as const;
    case "LUNCH":
      return "restaurant-outline" as const;
    case "DINNER":
      return "moon-outline" as const;
    case "SNACK":
      return "cafe-outline" as const;
  }
}

export default function MealReminderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: string }>();
  const mealType = parseMealParam(params.meal);
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const theme = useMemo(() => mealReminderTheme(mealType, colors, isDark), [mealType, colors, isDark]);
  const styles = useMemo(() => StyleSheet.create(makeStyles(colors)), [colors]);
  const { showToast } = useToast();
  const utils = trpc.useUtils();

  const { rows, title, window, planId, protein, mealLabel, dayInput, isLoading } = useUsualMealItems(mealType);

  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [remaining, setRemaining] = useState(AUTO_SNOOZE_SECONDS);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const autoSnoozeRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const timerProgress = useSharedValue(1);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const next: Record<string, RowState> = {};
    for (const row of rows) {
      next[row.key] = { amount: row.usual, included: true };
    }
    setRowState(next);
    setRemaining(AUTO_SNOOZE_SECONDS);
    autoSnoozeRef.current = false;
    timerProgress.value = 1;
  }, [rows, timerProgress]);

  const dismiss = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/nutrition");
  }, [router]);

  const handleSnooze = useCallback(
    async (toastMessage = "Snoozed · back in 30 min") => {
      // Works with or without a saved plan — history-driven reminders snooze too.
      await snoozeMealReminder({
        planId,
        mealType,
        title,
        protein,
        minutes: 30,
      });
      showToast(toastMessage, "info");
      dismiss();
    },
    [planId, mealType, title, protein, showToast, dismiss],
  );

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0 && !autoSnoozeRef.current) {
          autoSnoozeRef.current = true;
          void handleSnooze("No response · snoozed 30 min");
        }
        return Math.max(0, next);
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [handleSnooze]);

  useEffect(() => {
    if (reduceMotion) {
      timerProgress.value = remaining / AUTO_SNOOZE_SECONDS;
      return;
    }
    timerProgress.value = withTiming(remaining / AUTO_SNOOZE_SECONDS, { duration: 1000 });
  }, [remaining, reduceMotion, timerProgress]);

  const timerBarStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(100, timerProgress.value * 100))}%`,
  }));

  const logMeal = trpc.nutrition.logMeal.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.nutrition.dailySummary.invalidate(dayInput),
        utils.nutrition.todayMeals.invalidate(dayInput),
        utils.nutrition.todayPlan.invalidate(dayInput),
      ]);
      showToast(`${mealLabel} logged`, "success");
      dismiss();
    },
    onError: (error) => {
      setLogging(false);
      showToast(error.message, "error");
    },
  });

  const skipMeal = trpc.nutrition.skipPlanMeal.useMutation({
    onSuccess: () => {
      utils.nutrition.todayPlan.invalidate(dayInput);
      showToast("Marked as not eaten", "info");
      dismiss();
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const selectedRows = useMemo(
    () =>
      rows.filter((row) => {
        const state = rowState[row.key];
        return state?.included && state.amount > 0;
      }),
    [rows, rowState],
  );

  const canLog = selectedRows.length > 0;

  const handleLog = () => {
    if (!canLog || logging) return;
    setLogging(true);
    buzz(10);
    setLogged(true);

    logMeal.mutate({
      mealType,
      timezoneOffsetMinutes: dayInput.timezoneOffsetMinutes,
      dateMs: dayInput.dateMs,
      items: selectedRows.map((row) => {
        const state = rowState[row.key]!;
        return scaledLogItem(row, state.amount);
      }),
    });
  };

  const handleSkip = () => {
    buzz(10);
    if (planId) {
      skipMeal.mutate({ planId, mealType, hunger: "NO" });
      return;
    }
    showToast("Marked as not eaten", "info");
    dismiss();
  };

  const updateRow = (key: string, patch: Partial<RowState>) => {
    setRowState((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  };

  const countdownLabel = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  const cardEntering = reduceMotion ? undefined : FadeInDown.duration(620).springify().damping(16);

  return (
    <View style={styles.root}>
      <LinearGradient colors={theme.wallpaper} style={StyleSheet.absoluteFill} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={cardEntering} style={styles.card}>
          <View style={styles.timerTrack}>
            <Animated.View style={[styles.timerFill, { backgroundColor: theme.accent }, timerBarStyle]} />
          </View>

          <View style={styles.headRow}>
            <LinearGradient colors={theme.gradient} style={styles.badge}>
              <Ionicons name={mealGlyph(mealType)} size={22} color={colors.onAccent} />
            </LinearGradient>
            <View style={styles.headText}>
              <Text style={styles.mealTitle}>{mealLabel}</Text>
              <Text style={styles.mealWindow}>Usual window · {window}</Text>
            </View>
            <View style={styles.timerMeta}>
              <Text style={styles.timerMetaLabel}>Auto-snoozes in</Text>
              <Text style={[styles.timerMetaValue, { color: theme.accentSecondary }]}>{countdownLabel}</Text>
            </View>
          </View>

          <Text style={styles.subtitle}>
            Your usual {mealLabel.toLowerCase()} — tweak anything that&apos;s off, then log.
          </Text>

          {isLoading ? (
            <ActivityIndicator color={theme.accent} style={{ marginVertical: spacing.lg }} />
          ) : (
            <View style={styles.rows}>
              {rows.map((row, index) => (
                <ReminderRow
                  key={row.key}
                  row={row}
                  state={rowState[row.key] ?? { amount: row.usual, included: true }}
                  index={index}
                  reduceMotion={reduceMotion}
                  styles={styles}
                  colors={colors}
                  onToggle={() => {
                    const state = rowState[row.key];
                    if (!state) return;
                    updateRow(row.key, { included: !state.included });
                    buzz(8);
                  }}
                  onMinus={() => {
                    const state = rowState[row.key];
                    if (!state) return;
                    const next = Math.max(0, state.amount - row.meta.step);
                    updateRow(row.key, { amount: next, included: next > 0 ? state.included : false });
                    buzz(5);
                  }}
                  onPlus={() => {
                    const state = rowState[row.key];
                    if (!state) return;
                    const next = Math.min(row.meta.fillMax * 2, state.amount + row.meta.step);
                    updateRow(row.key, { amount: next, included: true });
                    buzz(5);
                  }}
                />
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              disabled={!canLog || logging}
              onPress={handleLog}
              style={({ pressed }) => [
                styles.logButtonWrap,
                (!canLog || logging) && styles.logButtonDisabled,
                pressed && canLog && styles.logButtonPressed,
              ]}
            >
              <LinearGradient
                colors={logged ? [colors.success, colors.successNeon] : theme.gradient}
                style={styles.logButton}
              >
                {logging ? (
                  <ActivityIndicator color={colors.onAccent} />
                ) : (
                  <Text style={styles.logButtonText}>
                    {logged ? "✓ Logged" : canLog ? `Log ${mealLabel.toLowerCase()}` : "Nothing selected"}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.secondaryRow}>
              <View style={styles.secondaryButton}>
                <Button label="Snooze 30 min" variant="secondary" fullWidth onPress={() => void handleSnooze()} />
              </View>
              <View style={styles.secondaryButton}>
                <Button
                  label="Not eating"
                  variant="secondary"
                  fullWidth
                  loading={skipMeal.isPending}
                  onPress={handleSkip}
                />
              </View>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function ReminderRow({
  row,
  state,
  index,
  reduceMotion,
  styles,
  colors,
  onToggle,
  onMinus,
  onPlus,
}: {
  row: ReminderRowItem;
  state: RowState;
  index: number;
  reduceMotion: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
  onToggle: () => void;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const changed = state.amount !== row.usual;
  const hint = changed ? `adjusted from ${usualHint(row.meta, row.usual)}` : usualHint(row.meta, row.usual);
  const entering = reduceMotion ? undefined : FadeIn.delay(index * 55).duration(400);

  return (
    <Animated.View
      entering={entering}
      style={[styles.row, !state.included && styles.rowExcluded]}
    >
      <Pressable
        onPress={onToggle}
        style={[styles.check, state.included && { backgroundColor: row.meta.accent, borderColor: row.meta.accent }]}
        hitSlop={6}
      >
        {state.included ? <Ionicons name="checkmark" size={14} color={colors.onAccent} /> : null}
      </Pressable>

      <VesselIcon
        vessel={row.meta.vessel}
        amount={state.amount}
        fillMax={row.meta.fillMax}
        lineColor={row.meta.lineColor}
        fillTop={row.meta.fillTop}
        fillBottom={row.meta.fillBottom}
      />

      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{row.name}</Text>
        <Text style={[styles.rowUsual, changed && { color: row.meta.accent, fontWeight: "700" }]}>{hint}</Text>
      </View>

      <View style={styles.stepper}>
        <Pressable onPress={onMinus} style={styles.stepBtn} hitSlop={4}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.amount}>{formatAmountLabel(row.meta, state.amount)}</Text>
        <Pressable onPress={onPlus} style={styles.stepBtn} hitSlop={4}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function makeStyles(colors: Palette) {
  return {
    root: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "flex-end" as const,
      paddingHorizontal: spacing.md,
    },
    card: {
      backgroundColor: colors.glass,
      borderRadius: 30,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    timerTrack: {
      height: 4,
      borderRadius: 4,
      backgroundColor: colors.surfaceHover,
      overflow: "hidden" as const,
      marginBottom: spacing.sm,
    },
    timerFill: {
      height: 4,
      borderRadius: 4,
    },
    headRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.md,
    },
    badge: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    headText: { flex: 1, minWidth: 0 },
    mealTitle: { ...typography.h3, color: colors.text, fontWeight: "700" as const },
    mealWindow: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
    timerMeta: { alignItems: "flex-end" as const },
    timerMetaLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "600" as const },
    timerMetaValue: { ...typography.label, fontWeight: "700" as const },
    subtitle: { ...typography.bodySmall, color: colors.textMuted, marginBottom: spacing.sm },
    rows: { gap: 7 },
    row: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSubtle,
    },
    rowExcluded: { opacity: 0.42 },
    check: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.textDim,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    rowInfo: { flex: 1, minWidth: 0 },
    rowName: { ...typography.bodySmall, color: colors.text, fontWeight: "600" as const },
    rowUsual: { ...typography.caption, color: colors.textDim, marginTop: 1 },
    stepper: { flexDirection: "row" as const, alignItems: "center" as const, gap: 2 },
    stepBtn: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: colors.surfaceHover,
      alignItems: "center" as const,
      justifyContent: "center" as const,
    },
    stepBtnText: { fontSize: 18, lineHeight: 20, color: colors.text, fontWeight: "500" as const },
    amount: {
      minWidth: 64,
      textAlign: "center" as const,
      ...typography.label,
      color: colors.text,
      fontWeight: "700" as const,
    },
    actions: { marginTop: spacing.md, gap: spacing.sm },
    logButtonWrap: { borderRadius: 15, overflow: "hidden" as const },
    logButton: {
      minHeight: 48,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingVertical: spacing.md,
    },
    logButtonText: { ...typography.button, color: colors.onAccent },
    logButtonDisabled: { opacity: 0.45 },
    logButtonPressed: { opacity: 0.92 },
    secondaryRow: { flexDirection: "row" as const, gap: spacing.sm },
    secondaryButton: { flex: 1 },
  };
}
