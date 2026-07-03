import { create } from "zustand";

/** Tracks whether the floating active-workout pill is visible (tab roots only). */
export const useWorkoutPillInset = create<{
  visible: boolean;
  setVisible: (visible: boolean) => void;
}>((set) => ({
  visible: false,
  setVisible: (visible) => set({ visible }),
}));
