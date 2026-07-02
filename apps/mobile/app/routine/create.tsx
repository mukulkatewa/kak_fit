import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Screen, SearchBar, ThemedDialog, useToast } from "../../src/components/ui";
import { HevyInfoStrip, HevyModalHeader, HevyUnderlineInput } from "../../src/components/hevy-ui";
import { trpc } from "../../src/lib/trpc";
import { useTheme, useThemedStyles, spacing, radius, typography, type Palette } from "../../src/lib/theme";
import { useUserPreferences } from "../../src/lib/use-preferences";
import { fromKg, toKg, weightLabel } from "../../src/lib/units";
import { parseOptionalNumber } from "../../src/lib/workout-errors";
import { ExerciseAvatar } from "../../src/components/exercise-avatar";
import { flexFill, webFlexScreen } from "../../src/lib/layout-constants";
import { openExerciseDetail } from "../../src/lib/exercise-navigation";

// ─── Types ─────────────────────────────────────────────────────────────────────

const ROUTINE_SET_TYPES = ["NORMAL", "WARMUP", "DROP"] as const;
type RoutineSetType = (typeof ROUTINE_SET_TYPES)[number];

const SET_TYPE_LABEL: Record<RoutineSetType, string> = {
  NORMAL: "",
  WARMUP: "W",
  DROP: "D",
};

type RoutineSet = {
  id: string;
  setNumber: number;
  targetWeight?: number; // stored in kg
  targetReps?: number;
  targetDuration?: number;
  setType: RoutineSetType;
};

type RoutineExerciseLocal = {
  exerciseId: string;
  name: string;
  imageUrl: string | null;
  sets: RoutineSet[];
  restSeconds: number | null;
  notes: string;
  superLink: boolean; // linked to previous exercise (superset)
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const REST_PRESETS = [null, 60, 90, 120, 180, 300] as const;

function nextRest(current: number | null): number | null {
  const idx = REST_PRESETS.indexOf(current as (typeof REST_PRESETS)[number]);
  return REST_PRESETS[(idx + 1) % REST_PRESETS.length] ?? null;
}

function formatRest(s: number | null): string {
  if (!s) return "OFF";
  if (s < 60) return `${s}s`;
  if (s % 60 === 0) return `${s / 60}m`;
  return `${Math.floor(s / 60)}m${s % 60}s`;
}

function cycleSetType(current: RoutineSetType): RoutineSetType {
  const idx = ROUTINE_SET_TYPES.indexOf(current);
  return ROUTINE_SET_TYPES[(idx + 1) % ROUTINE_SET_TYPES.length];
}

function setTypeColor(colors: Palette): Record<RoutineSetType, string> {
  return { NORMAL: colors.textMuted, WARMUP: colors.gold ?? "#EAB308", DROP: colors.accentBright ?? colors.accent };
}

function newRoutineSetId() {
  return `set-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeDefaultSet(setNumber: number, lastSet?: RoutineSet): RoutineSet {
  return {
    id: newRoutineSetId(),
    setNumber,
    targetWeight: lastSet?.targetWeight,
    targetReps: lastSet?.targetReps,
    setType: "NORMAL",
  };
}

// ─── RoutineSetRow ──────────────────────────────────────────────────────────────

function RoutineSetRow({
  set,
  weightUnit,
  onChange,
  onRemove,
  onCycleType,
  isOnlySet,
}: {
  set: RoutineSet;
  weightUnit: "KG" | "LBS";
  onChange: (patch: Partial<RoutineSet>) => void;
  onRemove: () => void;
  onCycleType: () => void;
  isOnlySet: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  const [weightDraft, setWeightDraft] = useState(
    set.targetWeight != null && set.targetWeight > 0
      ? String(fromKg(set.targetWeight, weightUnit))
      : "",
  );
  const [repsDraft, setRepsDraft] = useState(
    set.targetReps != null && set.targetReps > 0 ? String(set.targetReps) : "",
  );

  const prevSetRef = useRef(set);
  useEffect(() => {
    const prev = prevSetRef.current;
    if (prev.targetWeight !== set.targetWeight) {
      setWeightDraft(
        set.targetWeight != null && set.targetWeight > 0
          ? String(fromKg(set.targetWeight, weightUnit))
          : "",
      );
    }
    if (prev.targetReps !== set.targetReps) {
      setRepsDraft(set.targetReps != null && set.targetReps > 0 ? String(set.targetReps) : "");
    }
    prevSetRef.current = set;
  }, [set, weightUnit]);

  const commitWeight = () => {
    const v = parseOptionalNumber(weightDraft);
    onChange({ targetWeight: v != null ? toKg(v, weightUnit) : undefined });
  };

  const commitReps = () => {
    const v = parseOptionalNumber(repsDraft);
    onChange({ targetReps: v });
  };

  const label = SET_TYPE_LABEL[set.setType];
  const typeColor = setTypeColor(colors)[set.setType];

  return (
    <View style={styles.setRow}>
      <Pressable style={styles.setTypeBtn} onPress={onCycleType}>
        {label ? (
          <Text style={[styles.setTypeBadge, { color: typeColor }]}>{label}</Text>
        ) : (
          <Text style={styles.setNumber}>{set.setNumber}</Text>
        )}
      </Pressable>

      <TextInput
        style={styles.setInput}
        value={weightDraft}
        onChangeText={setWeightDraft}
        onBlur={commitWeight}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={colors.textDim}
      />
      <TextInput
        style={styles.setInput}
        value={repsDraft}
        onChangeText={setRepsDraft}
        onBlur={commitReps}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor={colors.textDim}
      />
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        disabled={isOnlySet}
        style={[styles.removeSetBtn, isOnlySet && { opacity: 0.3 }]}
      >
        <Ionicons name="close" size={16} color={colors.textDim} />
      </Pressable>
    </View>
  );
}

// ─── ExerciseCard ───────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  index,
  isFirst,
  isLast,
  weightUnit,
  onMoveUp,
  onMoveDown,
  onRemove,
  onUpdate,
  onToggleLink,
  onOpenExercise,
}: {
  exercise: RoutineExerciseLocal;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  weightUnit: "KG" | "LBS";
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<RoutineExerciseLocal>) => void;
  onToggleLink: () => void;
  onOpenExercise: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  const updateSet = (setIdx: number, patch: Partial<RoutineSet>) => {
    const sets = exercise.sets.map((s, i) => (i === setIdx ? { ...s, ...patch } : s));
    onUpdate({ sets });
  };

  const addSet = () => {
    const last = exercise.sets[exercise.sets.length - 1];
    const newSet = makeDefaultSet(exercise.sets.length + 1, last);
    onUpdate({ sets: [...exercise.sets, newSet] });
  };

  const removeSet = (setIdx: number) => {
    if (exercise.sets.length <= 1) return;
    const sets = exercise.sets
      .filter((_, i) => i !== setIdx)
      .map((s, i) => ({ ...s, setNumber: i + 1 }));
    onUpdate({ sets });
  };

  return (
    <View>
      {index > 0 ? (
        <Pressable style={styles.supersetRow} onPress={onToggleLink} hitSlop={6}>
          <Ionicons
            name={exercise.superLink ? "git-merge" : "link-outline"}
            size={13}
            color={exercise.superLink ? colors.accent : colors.textDim}
          />
          <Text style={[styles.supersetText, exercise.superLink && styles.supersetTextActive]}>
            {exercise.superLink ? "Superset" : "Make superset"}
          </Text>
        </Pressable>
      ) : null}

      <View style={[styles.card, exercise.superLink && styles.cardLinked]}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <Pressable onPress={onOpenExercise} style={styles.exerciseTitleTap}>
            <ExerciseAvatar name={exercise.name} imageUrl={exercise.imageUrl} size={36} />
            <Text style={styles.exerciseName} numberOfLines={1}>{exercise.name}</Text>
          </Pressable>
          <Pressable
            onPress={onMoveUp}
            disabled={isFirst}
            pointerEvents={isFirst ? "none" : "auto"}
            hitSlop={isFirst ? undefined : 6}
            style={isFirst && styles.dimmed}
          >
            <Ionicons name="chevron-up" size={19} color={colors.textMuted} />
          </Pressable>
          <Pressable
            onPress={onMoveDown}
            disabled={isLast}
            pointerEvents={isLast ? "none" : "auto"}
            hitSlop={isLast ? undefined : 6}
            style={isLast && styles.dimmed}
          >
            <Ionicons name="chevron-down" size={19} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={onRemove} hitSlop={12}>
            <Ionicons name="close-circle" size={22} color={colors.danger} />
          </Pressable>
        </View>

        {/* Notes */}
        <TextInput
          style={styles.notesInput}
          value={exercise.notes}
          onChangeText={(v) => onUpdate({ notes: v })}
          placeholder="Add routine notes here"
          placeholderTextColor={colors.textDim}
          multiline
        />

        {/* Rest timer */}
        <Pressable style={styles.restRow} onPress={() => onUpdate({ restSeconds: nextRest(exercise.restSeconds) })}>
          <Ionicons name="timer-outline" size={14} color={colors.textDim} />
          <Text style={styles.restLabel}>Rest Timer:</Text>
          <Text style={[styles.restValue, !!exercise.restSeconds && styles.restValueActive]}>
            {formatRest(exercise.restSeconds)}
          </Text>
        </Pressable>

        {/* Column headers */}
        <View style={styles.setHeader}>
          <Text style={[styles.setCol, styles.setColNarrow]}>SET</Text>
          <Text style={styles.setCol}>{weightLabel(weightUnit).toUpperCase()}</Text>
          <Text style={styles.setCol}>REPS</Text>
          <View style={styles.setColRemove} />
        </View>

        {/* Set rows */}
        {exercise.sets.map((set, si) => (
          <RoutineSetRow
            key={set.id}
            set={set}
            weightUnit={weightUnit}
            isOnlySet={exercise.sets.length <= 1}
            onChange={(patch) => updateSet(si, patch)}
            onRemove={() => removeSet(si)}
            onCycleType={() => updateSet(si, { setType: cycleSetType(set.setType) })}
          />
        ))}

        {/* Add set */}
        <Pressable style={styles.addSetBtn} onPress={addSet}>
          <Ionicons name="add" size={15} color={colors.accent} />
          <Text style={styles.addSetText}>Add Set</Text>
        </Pressable>
      </View>
    </View>
  );
}

const ROUTINE_NAME_SUGGESTIONS = [
  "Push Day",
  "Pull Day",
  "Leg Day",
  "Upper Body",
  "Lower Body",
  "Full Body",
] as const;

function defaultRoutineName() {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return `${days[new Date().getDay()]} Workout`;
}

// ─── Screen ─────────────────────────────────────────────────────────────────────

export default function CreateRoutineScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(editId);
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const { showToast } = useToast();
  const { weightUnit } = useUserPreferences();

  const [name, setName] = useState(() => (isEdit ? "" : defaultRoutineName()));
  const [nameError, setNameError] = useState(false);
  const nameInputRef = useRef<TextInput>(null);
  const hasHydratedFromServer = useRef(false);
  const [addExerciseDialogOpen, setAddExerciseDialogOpen] = useState(false);
  const [removeExerciseDialog, setRemoveExerciseDialog] = useState<{
    visible: boolean;
    index?: number;
    name?: string;
  }>({ visible: false });
  const [showTip, setShowTip] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [exercises, setExercises] = useState<RoutineExerciseLocal[]>([]);

  const {
    data: editing,
    isLoading: editingLoading,
    isError: editingError,
  } = trpc.routine.getById.useQuery(
    { id: editId! },
    { enabled: isEdit },
  );

  useEffect(() => {
    hasHydratedFromServer.current = false;
  }, [editId]);

  useEffect(() => {
    if (editing && !hasHydratedFromServer.current) {
      hasHydratedFromServer.current = true;
      setName(editing.name);
      setExercises(
        editing.exercises.map((ex, i) => ({
          exerciseId: ex.exercise.id,
          name: ex.exercise.name,
          imageUrl: ex.exercise.imageUrl ?? null,
          notes: ex.notes ?? "",
          restSeconds: ex.restSeconds ?? null,
          superLink:
            i > 0 &&
            ex.supersetGroup != null &&
            editing.exercises[i - 1]?.supersetGroup != null &&
            ex.supersetGroup === editing.exercises[i - 1]?.supersetGroup,
          sets:
            ex.sets.length > 0
              ? ex.sets.map((s) => ({
                  id: s.id,
                  setNumber: s.setNumber,
                  targetWeight: s.targetWeight ?? undefined,
                  targetReps: s.targetReps ?? undefined,
                  targetDuration: s.targetDuration ?? undefined,
                  setType: (s.setType as RoutineSetType | null | undefined) ?? "NORMAL",
                }))
              : [makeDefaultSet(1)],
        })),
      );
    }
  }, [editing]);

  const { data: exerciseList, isLoading: pickerLoading } = trpc.exercise.list.useQuery(
    { search: search || undefined, limit: 40 },
    { enabled: pickerOpen },
  );

  const update = trpc.routine.update.useMutation({
    onSuccess: () => {
      utils.routine.list.invalidate();
      if (editId) utils.routine.getById.invalidate({ id: editId });
      router.back();
    },
    onError: (e) => showToast(e.message, "error"),
  });

  const create = trpc.routine.create.useMutation({
    onMutate: async (input) => {
      await utils.routine.list.cancel();
      const previous = utils.routine.list.getData();
      utils.routine.list.setData(undefined, (old) => [
        {
          id: `optimistic-${Date.now()}`,
          userId: "",
          folderId: null,
          shareToken: null,
          name: input.name,
          notes: input.notes ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
          exercises: input.exercises.map((ex, index) => ({
            id: `optimistic-ex-${index}`,
            order: ex.order,
            exercise: { id: ex.exerciseId, name: "Saving…", imageUrl: null },
          })),
        },
        ...(old ?? []),
      ]);
      return { previous };
    },
    onError: (e, _input, context) => {
      if (context?.previous) {
        utils.routine.list.setData(undefined, context.previous);
      }
      showToast(e.message, "error");
    },
    onSuccess: () => {
      utils.routine.list.invalidate();
      router.back();
    },
  });

  const canSave = name.trim().length > 0 && exercises.length > 0;
  const formReady = !isEdit || editing != null;

  const save = () => {
    Keyboard.dismiss();
    if (!canSave) return;
    // Build superset groups from consecutive linked exercises.
    const groups: Array<number | null> = new Array(exercises.length).fill(null);
    let gid = 0;
    for (let i = 0; i < exercises.length; i++) {
      if (exercises[i].superLink) {
        if (groups[i - 1] == null) {
          gid += 1;
          groups[i - 1] = gid;
        }
        groups[i] = groups[i - 1];
      }
    }
    const payload = exercises.map((ex, index) => ({
      exerciseId: ex.exerciseId,
      order: index,
      supersetGroup: groups[index],
      restSeconds: ex.restSeconds ?? undefined,
      notes: ex.notes.trim() || undefined,
      sets:
        ex.sets.length > 0
          ? ex.sets.map((s) => ({
              setNumber: s.setNumber,
              targetWeight: s.targetWeight,
              targetReps: s.targetReps,
              targetDuration: s.targetDuration,
              setType: s.setType !== "NORMAL" ? s.setType : undefined,
            }))
          : Array.from({ length: 3 }, (_, i) => ({ setNumber: i + 1, targetReps: 10 })),
    }));
    if (isEdit && editId) {
      update.mutate({ id: editId, name: name.trim(), exercises: payload });
    } else {
      create.mutate({ name: name.trim(), exercises: payload });
    }
  };

  const updateExercise = (index: number, patch: Partial<RoutineExerciseLocal>) => {
    setExercises((prev) => prev.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)));
  };

  const removeExercise = (index: number) => {
    setExercises((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0) next[0] = { ...next[0], superLink: false };
      return next;
    });
  };

  const moveExercise = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= exercises.length) return;
    setExercises((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      if (next.length > 0) next[0] = { ...next[0], superLink: false };
      return next;
    });
  };

  const toggleLink = (index: number) => {
    if (index === 0) return;
    updateExercise(index, { superLink: !exercises[index].superLink });
  };

  const closePicker = () => {
    setPickerOpen(false);
    setSearch("");
  };

  const addExercise = (exerciseId: string, exerciseName: string, exerciseImageUrl: string | null) => {
    if (exercises.some((e) => e.exerciseId === exerciseId)) return;
    setExercises((prev) => [
      ...prev,
      {
        exerciseId,
        name: exerciseName,
        imageUrl: exerciseImageUrl,
        notes: "",
        restSeconds: null,
        superLink: false,
        sets: [makeDefaultSet(1)],
      },
    ]);
    showToast("Exercise added", "success");
  };

  if (isEdit && editingLoading) {
    return (
      <Screen>
        <View style={[styles.headerPad, { paddingTop: insets.top }]}>
          <HevyModalHeader
            title="Edit Routine"
            onCancel={() => router.back()}
            onSave={save}
            saveDisabled
          />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </Screen>
    );
  }

  if (isEdit && editingError) {
    return (
      <Screen>
        <View style={[styles.headerPad, { paddingTop: insets.top }]}>
          <HevyModalHeader
            title="Edit Routine"
            onCancel={() => router.back()}
            onSave={save}
            saveDisabled
          />
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textDim} />
          <Text style={styles.errorTitle}>Routine not found</Text>
          <Text style={styles.errorText}>
            This routine may have been deleted or you don&apos;t have access.
          </Text>
          <Button label="Go back" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.headerPad}>
        <HevyModalHeader
          title={isEdit ? "Edit Routine" : "Create Routine"}
          onCancel={() => router.back()}
          onSave={save}
          saveDisabled={!canSave || !formReady}
          saveLoading={create.isPending || update.isPending}
          onSaveDisabledTap={() => {
            if (name.trim().length === 0) {
              setNameError(true);
              nameInputRef.current?.focus();
            } else if (exercises.length === 0) {
              setAddExerciseDialogOpen(true);
            }
          }}
        />
      </View>

      {formReady ? (
        <>
          {showTip ? (
            <HevyInfoStrip
              text="You're creating a Routine. Add exercises, then tap Save."
              onDismiss={() => setShowTip(false)}
            />
          ) : null}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + spacing.xl },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <HevyUnderlineInput
              ref={nameInputRef}
              placeholder="Routine title (required)"
              value={name}
              error={nameError}
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError(false);
              }}
            />
            {nameError ? (
              <Text style={styles.nameErrorText}>Routine title is required.</Text>
            ) : null}
            {!isEdit ? (
              <View style={styles.nameSuggestions}>
                <Text style={styles.nameSuggestionsLabel}>Suggestions</Text>
                <View style={styles.nameSuggestionChips}>
                  {ROUTINE_NAME_SUGGESTIONS.map((suggestion) => (
                    <Pressable
                      key={suggestion}
                      style={[
                        styles.nameSuggestionChip,
                        name === suggestion && styles.nameSuggestionChipActive,
                      ]}
                      onPress={() => {
                        setName(suggestion);
                        setNameError(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.nameSuggestionChipText,
                          name === suggestion && styles.nameSuggestionChipTextActive,
                        ]}
                      >
                        {suggestion}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {exercises.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="barbell-outline" size={48} color={colors.textDim} />
                <Text style={styles.emptyText}>
                  Get started by adding an exercise to your routine.
                </Text>
                <Pressable style={styles.addBtn} onPress={() => setPickerOpen(true)}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.addBtnText}>Add exercise</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {exercises.map((ex, i) => (
                  <ExerciseCard
                    key={ex.exerciseId}
                    exercise={ex}
                    index={i}
                    isFirst={i === 0}
                    isLast={i === exercises.length - 1}
                    weightUnit={weightUnit}
                    onMoveUp={() => moveExercise(i, -1)}
                    onMoveDown={() => moveExercise(i, 1)}
                    onRemove={() =>
                      setRemoveExerciseDialog({
                        visible: true,
                        index: i,
                        name: ex.name,
                      })
                    }
                    onUpdate={(patch) => updateExercise(i, patch)}
                    onToggleLink={() => toggleLink(i)}
                    onOpenExercise={() => openExerciseDetail(utils, router, ex.exerciseId)}
                  />
                ))}
                <Button
                  label="Add exercise"
                  icon="add"
                  variant="secondary"
                  fullWidth
                  onPress={() => setPickerOpen(true)}
                />
              </>
            )}
          </ScrollView>
        </>
      ) : null}

      {pickerOpen && formReady ? (
        <View
          style={[
            styles.picker,
            { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom },
          ]}
        >
          <View style={styles.pickerHeader}>
            <HevyModalHeader
              title="Add exercise"
              onCancel={closePicker}
              onSave={closePicker}
            />
          </View>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search exercises" />
          {pickerLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={exerciseList ?? []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickerRow}
                  onPress={() => addExercise(item.id, item.name, item.imageUrl ?? null)}
                >
                  <Text style={styles.pickerName}>{item.name}</Text>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      closePicker();
                      openExerciseDetail(utils, router, item.id);
                    }}
                    hitSlop={8}
                    style={styles.pickerInfoButton}
                  >
                    <Ionicons name="information-circle-outline" size={22} color={colors.textMuted} />
                  </Pressable>
                  <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
                </Pressable>
              )}
            />
          )}
        </View>
      ) : null}

      <ThemedDialog
        visible={removeExerciseDialog.visible}
        title="Remove exercise?"
        message={
          removeExerciseDialog.name
            ? `Remove "${removeExerciseDialog.name}" from this routine?`
            : "Remove this exercise from the routine?"
        }
        onDismiss={() => setRemoveExerciseDialog({ visible: false })}
        buttons={[
          { label: "Cancel" },
          {
            label: "Remove",
            variant: "destructive",
            onPress: () => {
              if (removeExerciseDialog.index !== undefined) {
                removeExercise(removeExerciseDialog.index);
              }
              setRemoveExerciseDialog({ visible: false });
            },
          },
        ]}
      />

      <ThemedDialog
        visible={addExerciseDialogOpen}
        title="Add an exercise"
        message="Add at least one exercise before saving."
        onDismiss={() => setAddExerciseDialogOpen(false)}
        buttons={[
          { label: "Cancel" },
          {
            label: "Add exercise",
            variant: "primary",
            onPress: () => setPickerOpen(true),
          },
        ]}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────────

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { ...flexFill, backgroundColor: colors.bg, ...webFlexScreen },
    headerPad: { paddingHorizontal: spacing.lg },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.lg,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl,
    },
    errorTitle: {
      fontSize: 18, // Error state title emphasis
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
    },
    errorText: { ...typography.body, color: colors.textMuted, textAlign: "center", lineHeight: 22 },
    scroll: { ...flexFill },
    scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md },
    nameErrorText: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
    nameSuggestions: { gap: spacing.sm, marginTop: spacing.xs },
    nameSuggestionsLabel: { ...typography.label, color: colors.textDim },
    nameSuggestionChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    nameSuggestionChip: {
      backgroundColor: colors.surface,
      borderRadius: radius.full,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.separator,
    },
    nameSuggestionChipActive: {
      backgroundColor: colors.accentMuted,
      borderColor: colors.accent,
    },
    nameSuggestionChipText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
    nameSuggestionChipTextActive: { color: colors.accent },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.lg,
      paddingVertical: 80,
    },
    emptyText: {
      ...typography.body,
      color: colors.textMuted,
      textAlign: "center",
      maxWidth: 260,
      lineHeight: 22,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.accent,
      borderRadius: radius.full,
      paddingVertical: 14,
      paddingHorizontal: 28,
    },
    addBtnText: { ...typography.button, color: "#fff", fontWeight: "600" },

    // Exercise card
    supersetRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingLeft: spacing.sm,
      paddingVertical: 4,
    },
    supersetText: { ...typography.label, color: colors.textDim, fontWeight: "600" },
    supersetTextActive: { color: colors.accent },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: spacing.sm,
      marginBottom: 2,
    },
    cardLinked: { borderLeftWidth: 3, borderLeftColor: colors.accent },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    exerciseTitleTap: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0 },
    exerciseName: { flex: 1, minWidth: 0, ...typography.h3, color: colors.accent },
    dimmed: { opacity: 0.3 },
    notesInput: {
      ...typography.caption,
      color: colors.text,
      paddingVertical: spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    restRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    restLabel: { ...typography.caption, color: colors.textDim },
    restValue: { ...typography.caption, color: colors.textDim, fontWeight: "600" },
    restValueActive: { color: colors.accent },

    // Set header / rows
    setHeader: {
      flexDirection: "row",
      gap: spacing.xs,
      paddingHorizontal: 2,
      marginTop: 2,
    },
    setCol: {
      flex: 1,
      fontSize: 11, // Compact set table column header - intentional for data density
      fontWeight: "600",
      color: colors.textDim,
      textAlign: "center",
    },
    setColNarrow: { flex: 0, width: 32 },
    setColRemove: { width: 28 },
    setRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    setTypeBtn: { width: 32, alignItems: "center" },
    setNumber: { ...typography.caption, fontWeight: "700", color: colors.textMuted, textAlign: "center" },
    setTypeBadge: { ...typography.caption, fontWeight: "700", textAlign: "center" },
    setInput: {
      flex: 1,
      minWidth: 0,
      backgroundColor: colors.surfaceHover,
      borderRadius: radius.sm,
      ...typography.body,
      color: colors.text,
      paddingVertical: 7,
      paddingHorizontal: 6,
      textAlign: "center",
    },
    removeSetBtn: { width: 28, alignItems: "center" },
    addSetBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingTop: spacing.xs,
    },
    addSetText: { ...typography.bodySmall, color: colors.accent, fontWeight: "600" },

    // Picker
    picker: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.bg,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    pickerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    pickerTitle: { ...typography.h2, color: colors.text },
    pickerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
      gap: spacing.md,
    },
    pickerInfoButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
    pickerName: { flex: 1, ...typography.h3, color: colors.text },
  });
