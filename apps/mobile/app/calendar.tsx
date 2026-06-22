import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HevyStackHeader } from "../src/components/hevy-ui";
import { EmptyState, ListGroup, ListRow, Screen } from "../src/components/ui";
import { trpc } from "../src/lib/trpc";
import { spacing, useTheme, useThemedStyles, type Palette } from "../src/lib/theme";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoDateKey(d: Date) {
  // Use local date to avoid UTC-shift bugs
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function CalendarScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const styles = useThemedStyles(makeStyles);
  // Horizontal padding from Screen (spacing.lg each side)
  const cellSize = Math.floor((screenWidth - spacing.lg * 2) / 7);

  const { data: workouts, isLoading } = trpc.progress.calendar.useQuery();

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map<string, typeof workouts>();
    for (const w of workouts ?? []) {
      const k = isoDateKey(new Date(w.date));
      const arr = map.get(k) ?? [];
      arr.push(w);
      map.set(k, arr);
    }
    return map;
  }, [workouts]);

  const monthCells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number; key: string } | null> = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        key: isoDateKey(new Date(year, month, d)),
      });
    }
    return cells;
  }, [cursor]);

  const monthWorkouts = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    return (workouts ?? [])
      .filter((w) => {
        const d = new Date(w.date);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [workouts, cursor]);

  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const todayKey = isoDateKey(new Date());

  return (
    <Screen scroll>
      <HevyStackHeader title="Calendar" onBack={() => router.back()} />

      <View style={styles.monthNav}>
        <Pressable hitSlop={12} onPress={() => shiftMonth(-1)} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.monthLabel}>
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </Text>
        <Pressable hitSlop={12} onPress={() => shiftMonth(1)} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* Day-of-week header */}
      <View style={styles.weekRow}>
        {DAYS.map((d) => (
          <View key={d} style={[styles.dayCell, { width: cellSize }]}>
            <Text style={styles.weekday}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      {isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <View style={styles.grid}>
          {monthCells.map((cell, i) => {
            if (!cell) return <View key={`e-${i}`} style={{ width: cellSize, height: cellSize }} />;
            const hasWorkout = Boolean(byDay.get(cell.key)?.length);
            const isToday = cell.key === todayKey;
            const isFuture = cell.key > todayKey;
            return (
              <Pressable
                key={cell.key}
                style={[styles.dayCell, { width: cellSize, height: cellSize }]}
                onPress={() => {
                  const wks = byDay.get(cell.key);
                  if (wks?.length === 1) router.push(`/workout/${wks[0].id}`);
                }}
              >
                <View
                  style={[
                    styles.dayDot,
                    hasWorkout && styles.dayDotActive,
                    isToday && !hasWorkout && styles.dayToday,
                    isToday && hasWorkout && styles.dayTodayActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      hasWorkout && styles.dayTextActive,
                      isFuture && styles.dayTextFuture,
                    ]}
                  >
                    {cell.day}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.legend}>
        <View style={styles.legendDot} />
        <Text style={styles.legendText}>Workout completed</Text>
        <Text style={styles.monthCount}>
          {monthWorkouts.length > 0 ? `${monthWorkouts.length} this month` : ""}
        </Text>
      </View>

      {monthWorkouts.length === 0 && !isLoading ? (
        <EmptyState
          icon="calendar-outline"
          title="No workouts this month"
          message="Complete a workout to see it here."
        />
      ) : (
        <ListGroup>
          {monthWorkouts.map((w, i) => (
            <ListRow
              key={w.id}
              title={w.name ?? "Workout"}
              subtitle={new Date(w.date).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
              onPress={() => router.push(`/workout/${w.id}`)}
              last={i === monthWorkouts.length - 1}
            />
          ))}
        </ListGroup>
      )}
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    monthNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    navBtn: { padding: spacing.xs },
    monthLabel: { fontSize: 20, fontWeight: "800", color: colors.text },
    weekRow: { flexDirection: "row", marginBottom: spacing.xs },
    dayCell: { alignItems: "center", justifyContent: "center" },
    weekday: { fontSize: 12, fontWeight: "700", color: colors.textDim },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    dayDot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    dayDotActive: { backgroundColor: colors.accent },
    dayToday: { borderWidth: 1.5, borderColor: colors.accent },
    dayTodayActive: { borderWidth: 2, borderColor: colors.onAccent },
    dayText: { fontSize: 14, color: colors.text, fontWeight: "500" },
    dayTextActive: { color: colors.onAccent, fontWeight: "800" },
    dayTextFuture: { color: colors.textDim },
    legend: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.md },
    legendDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
    legendText: { fontSize: 13, color: colors.textMuted, flex: 1 },
    monthCount: { fontSize: 13, color: colors.accent, fontWeight: "700" },
  });
