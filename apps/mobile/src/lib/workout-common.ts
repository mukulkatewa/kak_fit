import type { TextStyle } from "react-native";
import { fonts, typography } from "./theme";

const sans = (style: TextStyle): TextStyle =>
  fonts.sans ? { fontFamily: fonts.sans, ...style } : style;

/**
 * Shared workout screen typography — spread with `color` from the active palette.
 * Keeps view/edit/list flows visually consistent.
 */
export const workoutTextStyles = {
  /** View detail hero title — intentional emphasis above h1 scale */
  titleView: sans({
    ...typography.h1,
    fontSize: 26,
  }),

  /** Edit screen hero title — intentional emphasis */
  titleEdit: sans({
    ...typography.h1,
    fontSize: 24,
  }),

  /** Inline title input when renaming */
  titleInput: sans({
    ...typography.h2,
    fontSize: 20,
  }),

  renameHint: typography.label,
  date: typography.bodySmall,
  hint: typography.caption,

  statValue: typography.bodySemibold,

  statLabel: typography.label,
  saveChipText: { ...typography.body, fontWeight: "700" as const },
  routineBtnText: { ...typography.body, fontWeight: "700" as const },

  exerciseName: typography.h3,

  setTableHeader: sans({
    ...typography.label,
    fontSize: 11, // Compact set table column header — intentional for data density
    fontWeight: "600",
  }),

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
  modalTitle: typography.h2,
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
