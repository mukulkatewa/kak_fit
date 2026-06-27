export const TAB_BAR_HEIGHT = 84;
export const TAB_BAR_PADDING_BOTTOM = 28;

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
