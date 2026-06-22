import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { HevyStackHeader } from "../src/components/hevy-ui";
import { ListGroup, ListRow, Screen } from "../src/components/ui";
import { trpc } from "../src/lib/trpc";
import { radius, spacing, useTheme, useThemedStyles, type Palette } from "../src/lib/theme";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function CalendarScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { data: workouts } = trpc.progress.calendar.useQuery();

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map<string, { id: string; name: string | null; date: string }[]>();
    for (const w of workouts ?? []) {
      const d = new Date(w.date);
      const k = dayKey(d);
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
    const cells: Array<{ day: number; hasWorkout: boolean } | null> = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, hasWorkout: byDay.has(dayKey(new Date(year, month, d))) });
    }
    return cells;
  }, [cursor, byDay]);

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

  const todayKey = dayKey(new Date());

  return (
    <Screen scroll>
      <HevyStackHeader title="Calendar" onBack={() => router.back()} />

      <View style={styles.monthNav}>
        <Pressable hitSlop={8} onPress={() => shiftMonth(-1)}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.monthLabel}>
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </Text>
        <Pressable hitSlop={8} onPress={() => shiftMonth(1)}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekday}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {monthCells.map((cell, i) => {
          if (!cell) return <View key={`e-${i}`} style={styles.cell} />;
          const isToday =
            dayKey(new Date(cursor.getFullYear(), cursor.getMonth(), cell.day)) === todayKey;
          return (
            <View key={i} style={styles.cell}>
              <View style={[styles.dayDot, cell.hasWorkout && styles.dayDotActive, isToday && styles.dayToday]}>
                <Text style={[styles.dayText, cell.hasWorkout && styles.dayTextActive]}>{cell.day}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>
        {monthWorkouts.length} workout{monthWorkouts.length === 1 ? "" : "s"} this month
      </Text>
      {monthWorkouts.length > 0 ? (
        <ListGroup>
          {monthWorkouts.map((w, i) => (
            <ListRow
              key={w.id}
              title={w.name ?? "Workout"}
              subtitle={new Date(w.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              onPress={() => router.push(`/workout/${w.id}`)}
              last={i === monthWorkouts.length - 1}
            />
          ))}
        </ListGroup>
      ) : null}
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm },
    monthLabel: { fontSize: 18, fontWeight: "800", color: colors.text },
    weekRow: { flexDirection: "row" },
    weekday: { flex: 1, textAlign: "center", color: colors.textDim, fontSize: 12, fontWeight: "600" },
    grid: { flexDirection: "row", flexWrap: "wrap" },
    cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
    dayDot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    dayDotActive: { backgroundColor: colors.accent },
    dayToday: { borderWidth: 1.5, borderColor: colors.accent },
    dayText: { fontSize: 14, color: colors.textMuted },
    dayTextActive: { color: colors.onAccent, fontWeight: "800" },
    sectionLabel: { fontSize: 14, color: colors.textMuted, fontWeight: "600", marginTop: spacing.sm },
  });
