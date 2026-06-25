import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, EmptyState, HevyButton, ListGroup } from "../../src/components/ui";
import { SkeletonCards } from "../../src/components/skeleton";
import { QueryErrorState } from "../../src/components/query-error-state";
import { ExerciseAvatar } from "../../src/components/exercise-avatar";
import { RoutineExpandableRow } from "../../src/components/routine-expandable-row";
import { HevyIconButton, HevyStackHeader } from "../../src/components/hevy-ui";
import { Screen } from "../../src/components/ui";
import { formatRoutineExerciseDetail } from "../../src/lib/routine-display";
import { trpc } from "../../src/lib/trpc";
import { alertWorkoutConflict } from "../../src/lib/workout-errors";
import { navigateToActiveWorkout } from "../../src/lib/workout-navigation";
import { useUserPreferences } from "../../src/lib/use-preferences";
import { useTheme, useThemedStyles, spacing, radius, type Palette } from "../../src/lib/theme";
import type { RouterOutputs } from "@kak-fit/api/router";

type RoutineItem = RouterOutputs["routine"]["list"][number];

export default function MyRoutinesScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const { weightUnit } = useUserPreferences();
  const { data: routines, isPending, isError, refetch } = trpc.routine.list.useQuery();
  const { data: folders } = trpc.routine.folders.useQuery();

  const [folderModal, setFolderModal] = useState<{ mode: "create" | "rename"; id?: string } | null>(null);
  const [folderName, setFolderName] = useState("");
  const [previewRoutineId, setPreviewRoutineId] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const previewRoutine = trpc.routine.getById.useQuery(
    { id: previewRoutineId! },
    { enabled: !!previewRoutineId, staleTime: 60_000 },
  );

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const discardActive = trpc.workout.discardActive.useMutation();

  const startRoutine = trpc.workout.startFromRoutine.useMutation({
    onSuccess: (workout) => {
      setStartingId(null);
      setPreviewRoutineId(null);
      navigateToActiveWorkout(utils, router, workout);
    },
    onError: (e, vars) => {
      setStartingId(null);
      alertWorkoutConflict(
        e,
        () => router.push("/workout/active"),
        async () => {
          setStartingId(vars.routineId);
          await discardActive.mutateAsync();
          await utils.workout.active.invalidate();
          startRoutine.mutate(vars);
        },
      );
    },
  });

  const duplicate = trpc.routine.duplicate.useMutation({
    onSuccess: () => utils.routine.list.invalidate(),
    onError: (e) => Alert.alert("Error", e.message),
  });
  const shareRoutine = trpc.routine.share.useMutation();
  const remove = trpc.routine.delete.useMutation({
    onSuccess: () => utils.routine.list.invalidate(),
    onError: (e) => Alert.alert("Error", e.message),
  });
  const createFolder = trpc.routine.createFolder.useMutation({
    onSuccess: () => utils.routine.folders.invalidate(),
    onError: (e) => Alert.alert("Error", e.message),
  });
  const renameFolder = trpc.routine.renameFolder.useMutation({
    onSuccess: () => utils.routine.folders.invalidate(),
    onError: (e) => Alert.alert("Error", e.message),
  });
  const deleteFolder = trpc.routine.deleteFolder.useMutation({
    onSuccess: () => {
      utils.routine.folders.invalidate();
      utils.routine.list.invalidate();
    },
    onError: (e) => Alert.alert("Error", e.message),
  });
  const setFolder = trpc.routine.setFolder.useMutation({
    onSuccess: () => {
      utils.routine.list.invalidate();
      utils.routine.folders.invalidate();
    },
    onError: (e) => Alert.alert("Error", e.message),
  });

  const grouped = useMemo(() => {
    const byFolder = new Map<string | null, RoutineItem[]>();
    for (const r of routines ?? []) {
      const key = r.folderId ?? null;
      const arr = byFolder.get(key) ?? [];
      arr.push(r);
      byFolder.set(key, arr);
    }
    return byFolder;
  }, [routines]);

  const openCreateFolder = () => {
    setFolderName("");
    setFolderModal({ mode: "create" });
  };
  const openRenameFolder = (id: string, current: string) => {
    setFolderName(current);
    setFolderModal({ mode: "rename", id });
  };
  const submitFolder = () => {
    const name = folderName.trim();
    if (!name) return;
    if (folderModal?.mode === "create") createFolder.mutate({ name });
    else if (folderModal?.id) renameFolder.mutate({ id: folderModal.id, name });
    setFolderModal(null);
  };

  const moveRoutine = (routine: RoutineItem) => {
    const options = [
      ...(folders ?? []).map((f) => ({
        text: f.name,
        onPress: () => setFolder.mutate({ routineId: routine.id, folderId: f.id }),
      })),
      ...(routine.folderId
        ? [{ text: "Remove from folder", onPress: () => setFolder.mutate({ routineId: routine.id, folderId: null }) }]
        : []),
      { text: "Cancel", style: "cancel" as const },
    ];
    if ((folders ?? []).length === 0) {
      Alert.alert("No folders", "Create a folder first with the folder + button.");
      return;
    }
    Alert.alert("Move to folder", routine.name, options);
  };

  const confirmDeleteFolder = (id: string, name: string) => {
    Alert.alert("Delete folder?", `"${name}" — routines inside are kept and moved out.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteFolder.mutate({ id }) },
    ]);
  };

  const handleShare = async (item: RoutineItem) => {
    try {
      const result = await shareRoutine.mutateAsync({ id: item.id });
      await Share.share({
        message: `Check out my "${result.name}" routine on Kak Fit!\n${result.url}`,
        url: result.url,
      });
    } catch (e) {
      Alert.alert("Share failed", e instanceof Error ? e.message : "Try again.");
    }
  };

  const renderRoutine = (item: RoutineItem, index: number, total: number) => (
    <View key={item.id} style={styles.routineWrap}>
      <View style={startingId === item.id ? { opacity: 0.6 } : undefined}>
        <ListGroup>
          <RoutineExpandableRow
            routine={item}
            expanded={expandedIds.has(item.id)}
            onToggleExpand={() => toggleExpanded(item.id)}
            last={index === total - 1}
            disabled={startingId === item.id}
            loading={startingId === item.id}
            onStart={() => setPreviewRoutineId(item.id)}
          />
        </ListGroup>
      </View>
      <View style={styles.actions}>
        <Action icon="create-outline" label="Edit" onPress={() => router.push(`/routine/create?id=${item.id}`)} />
        <Action icon="share-outline" label="Share" onPress={() => handleShare(item)} />
        <Action icon="folder-outline" label="Move" onPress={() => moveRoutine(item)} />
        <Action icon="copy-outline" label="Copy" onPress={() => duplicate.mutate({ id: item.id })} />
        <Action
          icon="trash-outline"
          label="Delete"
          danger
          onPress={() =>
            Alert.alert("Delete routine?", item.name, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => remove.mutate({ id: item.id }) },
            ])
          }
        />
      </View>
    </View>
  );

  const ungrouped = grouped.get(null) ?? [];

  return (
    <Screen scroll padded={false}>
      <View style={[styles.pad, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <HevyStackHeader
          title="My Routines"
          onBack={() => router.back()}
          right={
            <View style={styles.headerActions}>
              <HevyIconButton icon="folder-open-outline" onPress={openCreateFolder} />
              <HevyIconButton icon="add" onPress={() => router.push("/routine/create")} />
            </View>
          }
        />

        {isError ? (
          <QueryErrorState
            message="Couldn't load routines. Check your connection."
            onRetry={() => void refetch()}
          />
        ) : isPending && routines === undefined ? (
          <SkeletonCards count={3} height={56} />
        ) : (routines ?? []).length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="barbell-outline"
              title="No routines yet"
              message="Create a template or save a program from Explore."
            />
            <Button label="Create Routine" icon="add" onPress={() => router.push("/routine/create")} />
          </View>
        ) : (
          <View style={styles.list}>
            {(folders ?? []).map((folder) => {
              const items = grouped.get(folder.id) ?? [];
              return (
                <View key={folder.id} style={styles.folderSection}>
                  <View style={styles.folderHeader}>
                    <Ionicons name="folder" size={16} color={colors.accent} />
                    <Text style={styles.folderName}>{folder.name}</Text>
                    <Text style={styles.folderCount}>{items.length}</Text>
                    <Pressable hitSlop={8} onPress={() => openRenameFolder(folder.id, folder.name)}>
                      <Ionicons name="create-outline" size={18} color={colors.textMuted} />
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => confirmDeleteFolder(folder.id, folder.name)}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </Pressable>
                  </View>
                  {items.length === 0 ? (
                    <Text style={styles.folderEmpty}>Empty — use Move on a routine to add it here.</Text>
                  ) : (
                    items.map((item, index) => renderRoutine(item, index, items.length))
                  )}
                </View>
              );
            })}

            {ungrouped.length > 0 ? (
              <View style={styles.folderSection}>
                {(folders ?? []).length > 0 ? <Text style={styles.ungroupedLabel}>Ungrouped</Text> : null}
                {ungrouped.map((item, index) => renderRoutine(item, index, ungrouped.length))}
              </View>
            ) : null}
          </View>
        )}
      </View>

      <Modal visible={folderModal !== null} transparent animationType="fade" onRequestClose={() => setFolderModal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFolderModal(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{folderModal?.mode === "rename" ? "Rename folder" : "New folder"}</Text>
            <TextInput
              value={folderName}
              onChangeText={setFolderName}
              placeholder="Folder name (e.g. Push / Pull / Legs)"
              placeholderTextColor={colors.textDim}
              style={styles.modalInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setFolderModal(null)} hitSlop={8}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={submitFolder}>
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={previewRoutineId !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPreviewRoutineId(null)}
      >
        <View style={[styles.previewSheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle} numberOfLines={2}>
              {previewRoutine.data?.name ?? "Routine"}
            </Text>
            <Pressable onPress={() => setPreviewRoutineId(null)} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {previewRoutine.isLoading ? (
            <View style={styles.previewLoading}>
              <ActivityIndicator color={colors.accent} size="large" />
            </View>
          ) : previewRoutine.isError ? (
            <View style={styles.previewLoading}>
              <Text style={styles.previewError}>Couldn't load routine details.</Text>
              <Button label="Close" variant="ghost" onPress={() => setPreviewRoutineId(null)} />
            </View>
          ) : previewRoutine.data ? (
            <>
              {previewRoutine.data.notes ? (
                <Text style={styles.previewNotes}>{previewRoutine.data.notes}</Text>
              ) : null}

              <ScrollView
                style={styles.previewScroll}
                contentContainerStyle={styles.previewScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {previewRoutine.data.exercises.map((exercise) => (
                  <View key={exercise.id} style={styles.previewExerciseRow}>
                    <ExerciseAvatar
                      name={exercise.exercise.name}
                      imageUrl={exercise.exercise.imageUrl ?? null}
                      size={40}
                    />
                    <View style={styles.previewExerciseBody}>
                      <Text style={styles.previewExerciseName}>{exercise.exercise.name}</Text>
                      <Text style={styles.previewExerciseDetail}>
                        {formatRoutineExerciseDetail(exercise, weightUnit)}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <HevyButton
                label="Start Workout"
                onPress={() => {
                  if (!previewRoutineId) return;
                  setStartingId(previewRoutineId);
                  startRoutine.mutate({ routineId: previewRoutineId });
                }}
                loading={startRoutine.isPending && startingId === previewRoutineId}
              />
            </>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

function Action({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable style={styles.actionBtn} onPress={onPress} hitSlop={6}>
      <Ionicons name={icon} size={16} color={danger ? colors.danger : colors.textMuted} />
      <Text style={[styles.actionText, danger && styles.danger]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    pad: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
    headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    list: { gap: spacing.xl },
    folderSection: { gap: spacing.sm },
    folderHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    folderName: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "700" },
    folderCount: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      backgroundColor: colors.surfaceHover,
      borderRadius: radius.full,
      paddingHorizontal: 8,
      paddingVertical: 2,
      overflow: "hidden",
    },
    folderEmpty: { color: colors.textDim, fontSize: 13, paddingLeft: spacing.sm },
    ungroupedLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
    routineWrap: { gap: spacing.sm },
    actions: { flexDirection: "row", gap: spacing.lg, paddingHorizontal: spacing.sm, flexWrap: "wrap" },
    actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
    actionText: { color: colors.textMuted, fontSize: 13 },
    danger: { color: colors.danger },
    emptyWrap: { gap: spacing.lg, alignItems: "center", marginTop: spacing.xl },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
    },
    modalCard: {
      width: "100%",
      backgroundColor: colors.bgElevated,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
    modalInput: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 16,
    },
    modalActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.lg },
    modalCancel: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
    modalSave: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 10 },
    modalSaveText: { color: colors.onAccent, fontSize: 15, fontWeight: "700" },
    previewSheet: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingTop: spacing.lg,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    previewHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    previewTitle: { flex: 1, fontSize: 26, fontWeight: "800", color: colors.text },
    previewNotes: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
    previewLoading: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
    previewError: { color: colors.textMuted, fontSize: 15, textAlign: "center" },
    previewScroll: { flex: 1 },
    previewScrollContent: { gap: spacing.md, paddingBottom: spacing.md },
    previewExerciseRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    previewExerciseBody: { flex: 1, gap: 2 },
    previewExerciseName: { fontSize: 16, fontWeight: "700", color: colors.text },
    previewExerciseDetail: { fontSize: 13, color: colors.textMuted },
  });
