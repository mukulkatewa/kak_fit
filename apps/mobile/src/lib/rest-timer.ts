import { create } from "zustand";

type RestTimerState = {
  secondsLeft: number;
  isRunning: boolean;
  defaultSeconds: number;
  start: (seconds?: number) => void;
  tick: () => void;
  stop: () => void;
  setDefault: (seconds: number) => void;
  addSeconds: (n: number) => void;
};

export const useRestTimer = create<RestTimerState>((set, get) => ({
  secondsLeft: 0,
  isRunning: false,
  defaultSeconds: 90,
  start: (seconds) => {
    const dur = seconds ?? get().defaultSeconds;
    set({ secondsLeft: dur, isRunning: true });
  },
  tick: () => {
    const { secondsLeft, isRunning } = get();
    if (!isRunning) return;
    if (secondsLeft <= 1) {
      set({ secondsLeft: 0, isRunning: false });
      return;
    }
    set({ secondsLeft: secondsLeft - 1 });
  },
  stop: () => set({ isRunning: false, secondsLeft: 0 }),
  setDefault: (seconds) => set({ defaultSeconds: seconds }),
  addSeconds: (n) => {
    const current = get().secondsLeft;
    const next = Math.max(0, current + n);
    if (next === 0) {
      set({ secondsLeft: 0, isRunning: false });
    } else {
      set({ secondsLeft: next, isRunning: true });
    }
  },
}));

export function formatRestTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
