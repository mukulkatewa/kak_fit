export const TAB_BAR_HEIGHT = 84;
export const TAB_BAR_PADDING_BOTTOM = 28;

/** Primary tab screens where the active-workout overlay may appear. */
export const MAIN_TAB_ROOT_PATHS = ["/", "/routines", "/nutrition", "/profile"] as const;

const MAIN_TAB_ROOT_SET = new Set<string>(MAIN_TAB_ROOT_PATHS);

export function isMainTabRoot(pathname: string): boolean {
  return MAIN_TAB_ROOT_SET.has(pathname);
}
