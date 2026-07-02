import { Platform, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "./theme";

/** Flex child that should fill remaining space and allow nested ScrollViews to scroll. */
export const flexFill: ViewStyle = { flex: 1, minHeight: 0 };

/** Minimum tappable area for icon controls (iOS HIG / Material). */
export const TOUCH_TARGET_MIN = 44;
/** Primary CTA button height. */
export const BUTTON_HEIGHT_PRIMARY = 56;
/** Secondary button height. */
export const BUTTON_HEIGHT_SECONDARY = 52;
/** Extra tap padding for navigation and primary actions. */
export const HIT_SLOP_LARGE = 8;
/** Extra tap padding for list rows and cards. */
export const HIT_SLOP_MEDIUM = 4;

/** Standard 44×44 icon button wrapper — use hitSlop when visual size is smaller. */
export const iconButtonStyle: ViewStyle = {
  minWidth: TOUCH_TARGET_MIN,
  minHeight: TOUCH_TARGET_MIN,
  alignItems: "center",
  justifyContent: "center",
};

/** Extra constraints for full-height screens on web. */
export const webFlexScreen: ViewStyle =
  Platform.OS === "web" ? { minHeight: 0, height: "100%" } : {};

/** Icon + label area of the bottom tab bar (excluding safe-area padding). */
export const TAB_BAR_CONTENT_HEIGHT = 56;
export const TAB_BAR_HEIGHT = TAB_BAR_CONTENT_HEIGHT + 8;
export const TAB_BAR_PADDING_BOTTOM = Platform.OS === "web" ? spacing.sm : 28;

/** Height of the floating active-workout pill above the tab bar. */
export const ACTIVE_WORKOUT_PILL_HEIGHT = 64;

export type ScreenLayoutVariant = "tab" | "stack" | "modal";

/** Top padding below status bar / browser chrome. */
export function useScreenTopInset(variant: ScreenLayoutVariant = "stack"): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS === "web") {
    return variant === "modal" ? spacing.xs : spacing.sm;
  }
  return insets.top + (variant === "modal" ? spacing.xs : spacing.sm);
}

/** Bottom padding for slide-up sheets and bottom menu cards. */
export function useBottomSheetInset(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + spacing.md;
}

/** Bottom scroll padding — tab scenes sit above the tab bar; reserve space for the floating workout pill. */
export function useScreenBottomInset(variant: ScreenLayoutVariant = "stack"): number {
  const insets = useSafeAreaInsets();
  if (variant === "tab") {
    const overlayReserve = ACTIVE_WORKOUT_PILL_HEIGHT + spacing.sm;
    return spacing.lg + overlayReserve;
  }
  return Math.max(insets.bottom, spacing.md) + spacing.sm;
}

/** @deprecated Use useScreenBottomInset("tab") */
export function useTabBarBottomInset(): number {
  return useScreenBottomInset("tab");
}

/** @deprecated Use useScreenTopInset("tab") */
export function useTabScreenTopInset(): number {
  return useScreenTopInset("tab");
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
