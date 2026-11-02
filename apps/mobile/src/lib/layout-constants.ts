import { Platform, useWindowDimensions, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "./theme";
import { tabBarLayout } from "./layout-metrics";

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

export function useTabBarLayout() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return tabBarLayout(insets.bottom, fontScale);
}

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

/** Bottom scroll padding — tab scenes sit above the tab bar; reserve pill space only when shown. */
export function useScreenBottomInset(
  variant: ScreenLayoutVariant = "stack",
  reserveWorkoutPill = false,
): number {
  const insets = useSafeAreaInsets();
  if (variant === "tab") {
    const pill = reserveWorkoutPill ? ACTIVE_WORKOUT_PILL_HEIGHT + spacing.sm : 0;
    const webClearance = Platform.OS === "web" ? spacing.xxl : 0;
    return spacing.lg + pill + webClearance;
  }
  return Math.max(insets.bottom, spacing.md) + spacing.sm;
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
