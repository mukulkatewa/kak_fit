import type { RouterOutputs } from "@kak-fit/api/router";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HevySegmentedControl } from "./hevy-ui";
import { Sheet } from "./sheet";
import { Button, EmptyState, ListGroup, ListRow, SearchBar, useToast } from "./ui";
import { useUsualMealItems } from "../hooks/use-usual-meal-items";
import { scaledLogItem, type ReminderRowItem } from "../lib/meal-reminder-items";
import { TOUCH_TARGET_MIN } from "../lib/layout-constants";
import { trpc, queryStaleTime } from "../lib/trpc";
import {
  radius,
  spacing,
  typography,
  useTheme,
  useThemedStyles,
  type MealTypeKey,
  type Palette,
  type ShadowSet,
} from "../lib/theme";

type SegmentKey = "RECENT" | "USUAL" | "QUICK";
type SubmitMethod = "usual" | "repeat" | "quick" | "plan";
type NutritionDayInput = { timezoneOffsetMinutes: number; dateMs: number };
type FoodSearchResult = RouterOutputs["nutrition"]["searchFoods"][number];
type TodayMeal = RouterOutputs["nutrition"]["todayMeals"][number];
type TodayMealItem = TodayMeal["items"][number];
type TodayPlan = RouterOutputs["nutrition"]["todayPlan"];

type LogPayloadItem = {
  foodId?: string;
  fdcId?: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  quantity: number;
};

type PlannedSlotItem = {
  name: string;
  amount: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const SEGMENT_OPTIONS: Array<{ key: SegmentKey; label: string }> = [
  { key: "RECENT", label: "Recent" },
  { key: "USUAL", label: "Usual" },
  { key: "QUICK", label: "Quick add" },
];

const NL_PLACEHOLDER = "2 roti, a katori dal, half a bowl of sabzi";
const NL_HELPER = "Type it like you'd say it. Separate items with a comma.";
const SEARCH_DEFAULT_QTY = 100;

function softHaptic() {
  try {
    Vibration.vibrate(10);
  } catch {
    // no-op on unsupported platforms
  }
}

function roughlyLine(calories: number, protein: number) {
  return `Roughly ${Math.round(calories)} kcal · ${Math.round(protein)}g protein`;
}

function formatIntake(eaten: number, target: number) {
  const eatenLabel = Math.round(eaten).toLocaleString("en-US");
  if (target > 0) {
    return `Daily intake ${eatenLabel} / ${Math.round(target).toLocaleString("en-US")} kcal`;
  }
  return `Daily intake ${eatenLabel} kcal`;
}

function repeatLabel(mealType: MealTypeKey) {
  switch (mealType) {
    case "BREAKFAST":
      return "Repeat breakfast";
    case "LUNCH":
      return "Repeat lunch";
    case "DINNER":
      return "Repeat dinner";
    case "SNACK":
      return "Repeat snacks";
  }
}

function cleanFoodName(name: string) {
  const stripped = name.replace(/^\[AI:[^\]]+\]\s*/, "").replace(/\s+-\s+.+$/, "").trim();
  return stripped || name;
}

function foodSearchKey(food: FoodSearchResult) {
  return food.id ?? `fdc-${food.fdcId}`;
}

function parsePlannedSlot(
  meals: unknown,
  mealType: MealTypeKey,
): PlannedSlotItem[] {
  if (!Array.isArray(meals)) return [];
  const match = meals.find(
    (meal) =>
      meal &&
      typeof meal === "object" &&
      "mealType" in meal &&
      (meal as { mealType?: string }).mealType === mealType,
  ) as { items?: PlannedSlotItem[] } | undefined;
  return Array.isArray(match?.items) ? match.items : [];
}

function planCoachName(plan: TodayPlan): string | undefined {
  if (!plan || typeof plan !== "object") return undefined;
  const record = plan as unknown as {
    coachName?: unknown;
    coach?: unknown;
  };
  if (typeof record.coachName === "string" && record.coachName.trim()) {
    return record.coachName.trim();
  }
  const coach = record.coach;
  if (typeof coach === "string" && coach.trim()) return coach.trim();
  if (coach && typeof coach === "object" && "name" in coach) {
    const name = (coach as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return undefined;
}

export function MealLogSheet({
  mealType,
  planId,
  initialSegment = "USUAL",
  presentation,
  onClose,
  dayInput: dayInputOverride,
}: {
  mealType: MealTypeKey;
  planId?: string;
  initialSegment?: SegmentKey;
  presentation: "sheet" | "screen";
  onClose?: () => void;
  dayInput?: NutritionDayInput;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const utils = trpc.useUtils();

  const usual = useUsualMealItems(mealType);
  const dayInput = dayInputOverride ?? usual.dayInput;
  // Don't borrow today's planId when the sheet is scoped to another day.
  const resolvedPlanId =
    planId ?? (dayInput.dateMs === usual.dayInput.dateMs ? usual.planId : undefined);

  const [segment, setSegment] = useState<SegmentKey>(initialSegment);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [qtyByKey, setQtyByKey] = useState<Record<string, number>>({});

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: summary } = trpc.nutrition.dailySummary.useQuery(dayInput, {
    staleTime: queryStaleTime.nutritionDaily,
  });
  const { data: todayMeals } = trpc.nutrition.todayMeals.useQuery(dayInput, {
    staleTime: queryStaleTime.nutritionMeals,
  });
  const { data: todayPlan } = trpc.nutrition.todayPlan.useQuery(dayInput, {
    staleTime: queryStaleTime.nutritionDaily,
  });
  const { data: previousPlan } = trpc.nutrition.previousPlan.useQuery(dayInput, {
    staleTime: queryStaleTime.nutritionDaily,
  });

  const searchEnabled = debouncedQuery.length > 1;
  const {
    data: searchResults = [],
    isFetching: searchFetching,
  } = trpc.nutrition.searchFoods.useQuery(
    { query: debouncedQuery },
    { enabled: searchEnabled },
  );

  const invalidateDay = useCallback(() => {
    void utils.nutrition.dailySummary.invalidate(dayInput);
    void utils.nutrition.todayMeals.invalidate(dayInput);
  }, [dayInput, utils.nutrition.dailySummary, utils.nutrition.todayMeals]);

  const logMeal = trpc.nutrition.logMeal.useMutation({
    onSuccess: () => {
      // TODO(v2 analytics): emit log_completed
      invalidateDay();
      showToast("Logged.", "success");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const markAte = trpc.nutrition.markPlanMealAte.useMutation({
    onSuccess: (nextPlan) => {
      // TODO(v2 analytics): emit log_completed
      utils.nutrition.todayPlan.setData(dayInput, nextPlan);
      void utils.nutrition.usualMealItems.invalidate({ mealType, ...dayInput });
      invalidateDay();
      showToast("Logged.", "success");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const skipMeal = trpc.nutrition.skipPlanMeal.useMutation({
    onSuccess: (nextPlan) => {
      utils.nutrition.todayPlan.setData(dayInput, nextPlan);
      void utils.nutrition.usualMealItems.invalidate({ mealType, ...dayInput });
      invalidateDay();
      showToast("Skipped this one? That's fine — it rolls to tomorrow.", "info");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const swapMeal = trpc.nutrition.swapPlanMeal.useMutation({
    onSuccess: (nextPlan) => {
      utils.nutrition.todayPlan.setData(dayInput, nextPlan);
      void utils.nutrition.usualMealItems.invalidate({ mealType, ...dayInput });
      invalidateDay();
      setSegment("QUICK");
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const updateMeal = trpc.nutrition.updateMeal.useMutation({
    onSuccess: () => {
      invalidateDay();
    },
    onError: (error) => showToast(error.message, "error"),
  });

  const busy =
    logMeal.isPending ||
    markAte.isPending ||
    skipMeal.isPending ||
    swapMeal.isPending ||
    updateMeal.isPending;

  const submitLog = useCallback(
    (items: LogPayloadItem[], { method }: { method: SubmitMethod }) => {
      // TODO(v2 analytics): emit meal_log_started
      if (method === "plan") {
        // TODO(v2 analytics): emit plan_item_marked_consumed
        if (!resolvedPlanId || markAte.isPending) return;
        softHaptic();
        markAte.mutate({ planId: resolvedPlanId, mealType });
        return;
      }
      if (method === "usual" || method === "repeat") {
        // TODO(v2 analytics): emit favorite_relogged
      }
      if (items.length === 0 || logMeal.isPending) return;
      logMeal.mutate({
        mealType,
        timezoneOffsetMinutes: dayInput.timezoneOffsetMinutes,
        dateMs: dayInput.dateMs,
        items,
      });
    },
    [
      dayInput.dateMs,
      dayInput.timezoneOffsetMinutes,
      logMeal,
      markAte,
      mealType,
      resolvedPlanId,
    ],
  );

  const planItems = useMemo(
    () => parsePlannedSlot(todayPlan?.meals, mealType),
    [todayPlan?.meals, mealType],
  );
  const previousItems = useMemo(
    () => parsePlannedSlot(previousPlan?.meals, mealType),
    [previousPlan?.meals, mealType],
  );
  const isPlanDriven = Boolean(resolvedPlanId && planItems.length > 0);
  const mealCompleted = Boolean(todayPlan?.completedMealTypes.includes(mealType));
  const mealSkipped = Boolean(todayPlan?.skippedMealTypes.includes(mealType));
  const coachName = planCoachName(todayPlan ?? null);

  const usualRows = useMemo(() => {
    if (usual.data?.source === "history" || usual.data?.source === "plan") {
      return usual.rows.slice(0, 6);
    }
    return [] as ReminderRowItem[];
  }, [usual.data?.source, usual.rows]);

  const todaySlotItems = useMemo(() => {
    const rows: Array<{ item: TodayMealItem; mealId: string }> = [];
    for (const meal of todayMeals ?? []) {
      if (meal.mealType !== mealType) continue;
      for (const item of meal.items) {
        rows.push({ item, mealId: meal.id });
      }
    }
    return rows;
  }, [todayMeals, mealType]);

  const historyRows = useMemo(() => {
    if (usual.data?.source !== "history") return [] as ReminderRowItem[];
    return usualRows;
  }, [usual.data?.source, usualRows]);

  const qtyFor = (key: string, fallback: number) => qtyByKey[key] ?? fallback;

  const adjustQty = (key: string, fallback: number, step: number, min = 0) => {
    setQtyByKey((current) => {
      const next = Math.max(min, (current[key] ?? fallback) + step);
      return { ...current, [key]: next };
    });
  };

  const onSearchChange = (value: string) => {
    setQuery(value);
    // TODO(v2): NL multi-item parse
    if (value.trim().length > 0) setSegment("QUICK");
  };

  const onScanOrPhoto = () => {
    // TODO(v2): barcode/photo parse
    showToast("Log with a photo", "info");
  };

  const logUsualRow = (row: ReminderRowItem) => {
    const amount = qtyFor(row.key, row.usual);
    if (amount <= 0) return;
    submitLog([scaledLogItem(row, amount)], { method: "usual" });
  };

  const logSearchFood = (food: FoodSearchResult) => {
    const key = foodSearchKey(food);
    const quantity = qtyFor(key, SEARCH_DEFAULT_QTY);
    if (quantity <= 0) return;
    submitLog(
      [
        {
          foodId: food.id ?? undefined,
          fdcId: food.fdcId > 0 ? food.fdcId : undefined,
          name: food.name,
          calories: food.calories,
          protein: food.protein,
          carbs: food.carbs,
          fat: food.fat,
          quantity,
        },
      ],
      { method: "quick" },
    );
  };

  const logRepeat = () => {
    if (previousItems.length > 0) {
      submitLog(
        previousItems.map((item) => ({
          name: item.name,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          quantity: 100,
        })),
        { method: "repeat" },
      );
      return;
    }
    if (historyRows.length > 0) {
      submitLog(
        historyRows.map((row) => scaledLogItem(row, qtyFor(row.key, row.usual))),
        { method: "repeat" },
      );
      return;
    }
    if (todaySlotItems.length > 0) {
      submitLog(
        todaySlotItems.map(({ item }) => ({
          foodId: item.food.id,
          name: item.food.name,
          calories: item.food.calories,
          protein: item.food.protein,
          carbs: item.food.carbs,
          fat: item.food.fat,
          quantity: qtyFor(`today-${item.id}`, item.quantity),
        })),
        { method: "repeat" },
      );
    }
  };

  const commitLoggedQuantity = (mealItemId: string, quantity: number) => {
    if (quantity <= 0 || updateMeal.isPending) return;
    updateMeal.mutate({ mealItemId, quantity });
  };

  const intakeLabel = formatIntake(summary?.calories ?? 0, summary?.targets.calories ?? 0);
  const canRepeat =
    previousItems.length > 0 || historyRows.length > 0 || todaySlotItems.length > 0;

  const body = (
    <KeyboardAvoidingView
      style={[styles.body, styles.bodyFill]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.mealTitle} numberOfLines={1}>
            {usual.title}
          </Text>
          <Text style={styles.intake}>{intakeLabel}</Text>
          {coachName ? (
            <Text style={styles.coachLine}>Today's plan from {coachName}</Text>
          ) : null}
        </View>
        {onClose ? (
          <Button label="Done" variant="ghost" size="sm" onPress={onClose} />
        ) : null}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <Text style={styles.searchLabel}>Type or say it</Text>
          <SearchBar
            value={query}
            onChangeText={onSearchChange}
            placeholder={NL_PLACEHOLDER}
          />
          <Text style={styles.searchHelper}>{NL_HELPER}</Text>
        </View>
        <View style={styles.iconCol}>
          <Pressable
            onPress={onScanOrPhoto}
            hitSlop={8}
            style={styles.quietIcon}
            accessibilityRole="button"
            accessibilityLabel="Scan barcode"
          >
            <Ionicons name="barcode-outline" size={22} color={colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={onScanOrPhoto}
            hitSlop={8}
            style={styles.quietIcon}
            accessibilityRole="button"
            accessibilityLabel="Log with a photo"
          >
            <Ionicons name="camera-outline" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <HevySegmentedControl options={SEGMENT_OPTIONS} value={segment} onChange={setSegment} />

      {isPlanDriven ? (
        <View style={styles.planHeaderActions}>
          <Button
            label="Mark today's meals as had"
            variant="secondary"
            size="sm"
            disabled={busy || mealCompleted}
            loading={markAte.isPending}
            onPress={() => submitLog([], { method: "plan" })}
          />
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {segment === "USUAL" ? (
          isPlanDriven ? (
            <PlanUsualList
              items={planItems}
              confirmed={mealCompleted}
              skipped={mealSkipped}
              busy={busy}
              onHadThis={() => submitLog([], { method: "plan" })}
              onSwap={() => {
                if (!resolvedPlanId || swapMeal.isPending) return;
                swapMeal.mutate({ planId: resolvedPlanId, mealType });
              }}
              onSkip={() => {
                if (!resolvedPlanId || skipMeal.isPending || mealSkipped || mealCompleted) return;
                skipMeal.mutate({ planId: resolvedPlanId, mealType });
              }}
            />
          ) : usual.isLoading ? (
            <ActivityIndicator color={colors.accent} style={styles.spinner} />
          ) : usualRows.length === 0 ? (
            <View style={styles.stack}>
              <EmptyState
                icon="star-outline"
                title="No favourites yet"
                message="Log a meal you eat often, then save it here for one-tap next time."
              />
              <Button label="Add a meal" onPress={() => setSegment("QUICK")} />
            </View>
          ) : (
            <ListGroup>
              {usualRows.map((row, index) => {
                const amount = qtyFor(row.key, row.usual);
                const expanded = expandedKey === row.key;
                const scale = row.usual > 0 ? amount / row.usual : 1;
                return (
                  <View key={row.key}>
                    <ListRow
                      title={row.name}
                      subtitle={`${row.amountLabel} · ${roughlyLine(row.calories * scale, row.protein * scale)}`}
                      onPress={() => setExpandedKey(expanded ? null : row.key)}
                      right={
                        <AddButton
                          disabled={busy}
                          onPress={() => logUsualRow(row)}
                        />
                      }
                      last={!expanded && index === usualRows.length - 1}
                    />
                    {expanded ? (
                      <QuantityStepper
                        amount={amount}
                        unit={row.meta.unit}
                        onMinus={() => adjustQty(row.key, row.usual, -row.meta.step)}
                        onPlus={() => adjustQty(row.key, row.usual, row.meta.step)}
                        last={index === usualRows.length - 1}
                      />
                    ) : null}
                  </View>
                );
              })}
            </ListGroup>
          )
        ) : null}

        {segment === "RECENT" ? (
          <View style={styles.stack}>
            {canRepeat ? (
              <ListGroup>
                <ListRow
                  title={repeatLabel(mealType)}
                  onPress={busy ? undefined : logRepeat}
                  last
                />
              </ListGroup>
            ) : null}
            {todaySlotItems.length === 0 && historyRows.length === 0 && !canRepeat ? (
              <View style={styles.stack}>
                <EmptyState
                  icon="time-outline"
                  title="Not logged yet"
                  message="Add your first meal — a line of text is enough."
                />
                <Button label="Add a meal" onPress={() => setSegment("QUICK")} />
              </View>
            ) : todaySlotItems.length === 0 && historyRows.length === 0 ? null : (
              <ListGroup>
                {todaySlotItems.map(({ item }, index) => {
                  const key = `today-${item.id}`;
                  const expanded = expandedKey === key;
                  const amount = qtyFor(key, item.quantity);
                  const serving = item.food.servingSize || 100;
                  const ratio = amount / serving;
                  const isLast =
                    !expanded &&
                    index === todaySlotItems.length - 1 &&
                    historyRows.length === 0;
                  return (
                    <View key={item.id}>
                      <ListRow
                        title={cleanFoodName(item.food.name)}
                        subtitle={roughlyLine(item.food.calories * ratio, item.food.protein * ratio)}
                        onPress={() => setExpandedKey(expanded ? null : key)}
                        last={isLast}
                      />
                      {expanded ? (
                        <QuantityStepper
                          amount={amount}
                          unit={item.food.servingUnit ?? undefined}
                          onMinus={() => {
                            const next = Math.max(0, amount - (item.food.servingUnit === "g" ? 10 : 0.5));
                            setQtyByKey((current) => ({ ...current, [key]: next }));
                            if (next > 0) commitLoggedQuantity(item.id, next);
                          }}
                          onPlus={() => {
                            const next = amount + (item.food.servingUnit === "g" ? 10 : 0.5);
                            setQtyByKey((current) => ({ ...current, [key]: next }));
                            commitLoggedQuantity(item.id, next);
                          }}
                          last={index === todaySlotItems.length - 1 && historyRows.length === 0}
                        />
                      ) : null}
                    </View>
                  );
                })}
                {historyRows.map((row, index) => {
                  const amount = qtyFor(row.key, row.usual);
                  const expanded = expandedKey === row.key;
                  const scale = row.usual > 0 ? amount / row.usual : 1;
                  return (
                    <View key={row.key}>
                      <ListRow
                        title={row.name}
                        subtitle={`${row.amountLabel} · ${roughlyLine(row.calories * scale, row.protein * scale)}`}
                        onPress={() => setExpandedKey(expanded ? null : row.key)}
                        right={
                          <AddButton disabled={busy} onPress={() => logUsualRow(row)} />
                        }
                        last={!expanded && index === historyRows.length - 1}
                      />
                      {expanded ? (
                        <QuantityStepper
                          amount={amount}
                          unit={row.meta.unit}
                          onMinus={() => adjustQty(row.key, row.usual, -row.meta.step)}
                          onPlus={() => adjustQty(row.key, row.usual, row.meta.step)}
                          last={index === historyRows.length - 1}
                        />
                      ) : null}
                    </View>
                  );
                })}
              </ListGroup>
            )}
          </View>
        ) : null}

        {segment === "QUICK" ? (
          searchEnabled && searchFetching && searchResults.length === 0 ? (
            <ActivityIndicator color={colors.accent} style={styles.spinner} />
          ) : searchEnabled && searchResults.length === 0 ? (
            <EmptyState
              icon="search-outline"
              title="Type or say it"
              message={NL_HELPER}
            />
          ) : !searchEnabled ? null : (
            <ListGroup>
              {searchResults.map((food, index) => {
                const key = foodSearchKey(food);
                const expanded = expandedKey === key;
                const amount = qtyFor(key, SEARCH_DEFAULT_QTY);
                const scale = amount / SEARCH_DEFAULT_QTY;
                return (
                  <View key={key}>
                    <ListRow
                      title={food.name}
                      subtitle={roughlyLine(food.calories * scale, food.protein * scale)}
                      onPress={() => setExpandedKey(expanded ? null : key)}
                      right={
                        <AddButton disabled={busy} onPress={() => logSearchFood(food)} />
                      }
                      last={!expanded && index === searchResults.length - 1}
                    />
                    {expanded ? (
                      <QuantityStepper
                        amount={amount}
                        unit="g"
                        onMinus={() => adjustQty(key, SEARCH_DEFAULT_QTY, -10)}
                        onPlus={() => adjustQty(key, SEARCH_DEFAULT_QTY, 10)}
                        last={index === searchResults.length - 1}
                      />
                    ) : null}
                  </View>
                );
              })}
            </ListGroup>
          )
        ) : null}

        <View style={styles.footer}>
          <Button
            label="Save as usual"
            variant="ghost"
            size="sm"
            onPress={() => {
              // TODO(v2): persist this meal as a favourite
            }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (presentation === "screen") {
    return (
      <View style={[styles.screenRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {body}
      </View>
    );
  }

  return (
    <Sheet visible onClose={onClose ?? (() => undefined)}>
      {body}
    </Sheet>
  );
}

function AddButton({ disabled, onPress }: { disabled?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={[styles.addBtn, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel="Add"
    >
      <Ionicons name="add" size={22} color={colors.text} />
    </Pressable>
  );
}

function QuantityStepper({
  amount,
  unit,
  onMinus,
  onPlus,
  last,
}: {
  amount: number;
  unit?: string;
  onMinus: () => void;
  onPlus: () => void;
  last?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const rounded = Number.isInteger(amount) ? String(amount) : String(Math.round(amount * 10) / 10);
  return (
    <View style={[styles.stepperRow, last && styles.stepperRowLast]}>
      <Pressable onPress={onMinus} style={styles.stepBtn} hitSlop={4} accessibilityLabel="Decrease">
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Text style={styles.stepAmount}>
        {rounded}
        {unit ? ` ${unit}` : ""}
      </Text>
      <Pressable onPress={onPlus} style={styles.stepBtn} hitSlop={4} accessibilityLabel="Increase">
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

function PlanUsualList({
  items,
  confirmed,
  skipped,
  busy,
  onHadThis,
  onSwap,
  onSkip,
}: {
  items: PlannedSlotItem[];
  confirmed: boolean;
  skipped: boolean;
  busy: boolean;
  onHadThis: () => void;
  onSwap: () => void;
  onSkip: () => void;
}) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.stack}>
      <ListGroup>
        {items.map((item, index) => (
          <View
            key={`${item.name}-${index}`}
            style={[styles.planRow, confirmed && styles.planRowConfirmed]}
          >
            <View
              style={[
                styles.ringDot,
                confirmed ? styles.ringDotFilled : styles.ringDotEmpty,
              ]}
            />
            <View style={styles.planRowBody}>
              <ListRow
                title={item.name}
                subtitle={`${item.amount} · ${roughlyLine(item.calories, item.protein)}`}
                right={
                  <Pressable
                    onPress={busy || confirmed ? undefined : onHadThis}
                    disabled={busy || confirmed}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={confirmed ? "Had it ✓" : "Had this"}
                  >
                    <Text style={[styles.hadLabel, confirmed && styles.hadLabelDone]}>
                      {confirmed ? "Had it ✓" : "Had this"}
                    </Text>
                  </Pressable>
                }
                last={index === items.length - 1}
              />
            </View>
          </View>
        ))}
      </ListGroup>
      <View style={styles.planSecondary}>
        <Button
          label="Had something else"
          variant="ghost"
          size="sm"
          disabled={busy || confirmed}
          onPress={onSwap}
        />
        {skipped ? (
          <Text style={styles.skipCopy}>
            Skipped this one? That's fine — it rolls to tomorrow.
          </Text>
        ) : confirmed ? null : (
          <Pressable onPress={onSkip} disabled={busy} hitSlop={8}>
            <Text style={styles.skipCopy}>
              Skipped this one? That's fine — it rolls to tomorrow.
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette, _shadows: ShadowSet) =>
  StyleSheet.create({
    screenRoot: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    body: {
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    bodyFill: {
      flex: 1,
      minHeight: 0,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.md,
      paddingTop: spacing.sm,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
      gap: spacing.xs,
    },
    mealTitle: {
      ...typography.h2,
      color: colors.text,
    },
    intake: {
      ...typography.caption,
      color: colors.textMuted,
    },
    coachLine: {
      ...typography.caption,
      color: colors.textMuted,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    searchField: {
      flex: 1,
      minWidth: 0,
      gap: spacing.xs,
    },
    searchLabel: {
      ...typography.caption,
      color: colors.textMuted,
    },
    searchHelper: {
      ...typography.caption,
      color: colors.textDim,
    },
    iconCol: {
      paddingTop: spacing.lg,
      gap: spacing.xs,
    },
    quietIcon: {
      minWidth: TOUCH_TARGET_MIN,
      minHeight: TOUCH_TARGET_MIN,
      alignItems: "center",
      justifyContent: "center",
    },
    planHeaderActions: {
      alignItems: "flex-start",
    },
    scroll: {
      flex: 1,
      minHeight: 0,
    },
    scrollContent: {
      gap: spacing.md,
      paddingBottom: spacing.xl,
    },
    stack: {
      gap: spacing.md,
    },
    spinner: {
      marginVertical: spacing.lg,
    },
    footer: {
      alignItems: "flex-start",
      paddingTop: spacing.sm,
    },
    addBtn: {
      minWidth: TOUCH_TARGET_MIN,
      minHeight: TOUCH_TARGET_MIN,
      alignItems: "center",
      justifyContent: "center",
    },
    disabled: {
      opacity: 0.4,
    },
    stepperRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    stepperRowLast: {
      borderBottomWidth: 0,
    },
    stepBtn: {
      width: 28,
      height: 28,
      borderRadius: radius.sm,
      backgroundColor: colors.surfaceHover,
      alignItems: "center",
      justifyContent: "center",
    },
    stepBtnText: {
      ...typography.h3,
      color: colors.text,
      fontWeight: "500",
    },
    stepAmount: {
      minWidth: 64,
      textAlign: "center",
      ...typography.label,
      color: colors.text,
      fontWeight: "700",
    },
    planRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
    },
    planRowConfirmed: {
      opacity: 0.72,
    },
    planRowBody: {
      flex: 1,
      minWidth: 0,
    },
    ringDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      marginLeft: spacing.lg,
    },
    ringDotEmpty: {
      borderColor: colors.success,
      backgroundColor: colors.surface,
    },
    ringDotFilled: {
      borderColor: colors.success,
      backgroundColor: colors.success,
    },
    hadLabel: {
      ...typography.caption,
      color: colors.success,
      fontWeight: "700",
    },
    hadLabelDone: {
      color: colors.textMuted,
    },
    planSecondary: {
      gap: spacing.sm,
      alignItems: "flex-start",
    },
    skipCopy: {
      ...typography.caption,
      color: colors.textMuted,
    },
  });
