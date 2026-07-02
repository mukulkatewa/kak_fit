import type { TextStyle } from "react-native";
import { typography } from "./theme";

/**
 * Shared workout screen typography — spread with `color` from the active palette.
 * Keeps view/edit/list flows visually consistent.
 */
export const workoutTextStyles = {
  /** View detail hero title */
  titleView: {
    fontSize: 26, // Hero title - intentional emphasis
    fontWeight: "800",
  } as TextStyle,

  /** Edit screen hero title */
  titleEdit: {
    fontSize: 24, // Edit hero title - intentional emphasis
    fontWeight: "800",
  } as TextStyle,

  /** Inline title input when renaming */
  titleInput: {
    fontSize: 20,
    fontWeight: "700",
  } as TextStyle,

  renameHint: typography.label,
  date: typography.bodySmall,
  hint: typography.caption,

  statValue: {
    fontSize: 17, // Stat emphasis - intentional
    fontWeight: "800",
  } as TextStyle,

  statLabel: typography.label,
  saveChipText: { ...typography.body, fontWeight: "700" as const },
  routineBtnText: { ...typography.body, fontWeight: "700" as const },

  exerciseName: {
    fontSize: 17, // Exercise name emphasis
    fontWeight: "700",
  } as TextStyle,

  setTableHeader: {
    fontSize: 11, // Compact set table header - intentional for data density
    fontWeight: "700",
  } as TextStyle,

  setCell: typography.body,
  setNumber: { ...typography.bodySmall, fontWeight: "700" as const },
  setInput: typography.body,
  addSetText: { ...typography.bodySmall, fontWeight: "600" as const },
  photosEmpty: typography.caption,

  folderName: typography.h3,
  folderCount: { ...typography.label, fontWeight: "700" as const },
  folderEmpty: typography.caption,
  ungroupedLabel: { ...typography.caption, fontWeight: "600" as const },
  actionText: typography.caption,
  modalTitle: {
    fontSize: 18, // Modal title emphasis
    fontWeight: "800",
  } as TextStyle,
  modalInput: typography.h3,
  modalCancel: { ...typography.body, fontWeight: "600" as const },
  moveRoutineName: typography.body,
  moveOptionText: typography.h3,
  modalSaveText: { ...typography.body, fontWeight: "700" as const },
  previewNotes: { ...typography.bodySmall, lineHeight: 20 },
  previewError: typography.body,
  previewExerciseName: typography.h3,
  previewExerciseDetail: typography.caption,
} as const;
