import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "./theme";

export const TAB_BAR_HEIGHT = 84;
export const TAB_BAR_PADDING_BOTTOM = 28;

/** Bottom inset so scroll content clears the tab bar. */
export function useTabBarBottomInset(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, TAB_BAR_PADDING_BOTTOM) + spacing.lg;
}

/** Top inset for tab screen content below status / browser chrome. */
export function useTabScreenTopInset(): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS === "web") {
    return Math.max(insets.top, spacing.md);
  }
  return insets.top + spacing.sm;
}

/** Screens where the active-workout overlay may appear (tab roots + common drill-downs). */
export const MAIN_TAB_ROOT_PATHS = [
  "/",
  "/routines",
  "/nutrition",
  "/profile",
  "/progress",
  "/calendar",
  "/measurements",
] as const;

const MAIN_TAB_ROOT_SET = new Set<string>(MAIN_TAB_ROOT_PATHS);

export function isMainTabRoot(pathname: string): boolean {
  return MAIN_TAB_ROOT_SET.has(pathname);
}
