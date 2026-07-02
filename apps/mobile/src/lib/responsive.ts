import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { spacing } from "./theme";

/**
 * Responsive breakpoints (width/height in pt).
 * - narrow: iPhone SE (375pt)
 * - standard: iPhone 14 Pro / Pixel 5 (~393pt)
 * - wide: iPhone 14 Pro Max (430pt+)
 */
export const BREAKPOINT_NARROW = 380;
export const BREAKPOINT_WIDE = 428;
export const BREAKPOINT_COMPACT_HEIGHT = 700;

const GRID_MIN_TILE_WIDTH = 150;

/** Two-column grid item width accounting for horizontal padding and gap. */
export function getTwoColumnItemWidth(
  screenWidth: number,
  horizontalPadding: number,
  gap: number,
): number {
  const contentWidth = screenWidth - horizontalPadding * 2;
  return Math.max(GRID_MIN_TILE_WIDTH, (contentWidth - gap) / 2);
}

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isCompact = height < BREAKPOINT_COMPACT_HEIGHT;
    const isNarrow = width < BREAKPOINT_NARROW;
    const isWide = width > BREAKPOINT_WIDE;

    const horizontalPadding = isNarrow ? spacing.lg : spacing.xl;
    const heroFontSize = isNarrow ? 32 : 40;
    const heroLineHeight = isNarrow ? 36 : 44;
    const pageTitleSize = isNarrow ? 28 : 32;
    const pageTitleLineHeight = isNarrow ? 34 : 38;
    const loginTitleSize = isCompact ? 36 : isNarrow ? 40 : 44;
    const loginTitleLineHeight = isCompact ? 42 : isNarrow ? 46 : 50;
    const loginOrbSize = isCompact ? 96 : 116;
    const ambientRingSize = Math.min(360, width * 0.92);

    const gridGap = spacing.sm;
    const contentWidth = width - horizontalPadding * 2;
    const gridColumns = isWide ? 3 : 2;
    const twoColumnItemWidth = getTwoColumnItemWidth(width, horizontalPadding, gridGap);
    const threeColumnItemWidth = Math.max(
      120,
      (contentWidth - gridGap * 2) / 3,
    );
    const gridItemWidth = gridColumns === 3 ? threeColumnItemWidth : twoColumnItemWidth;

    return {
      isCompact,
      isNarrow,
      isWide,
      horizontalPadding,
      heroFontSize,
      heroLineHeight,
      pageTitleSize,
      pageTitleLineHeight,
      loginTitleSize,
      loginTitleLineHeight,
      loginOrbSize,
      ambientRingSize,
      width,
      height,
      contentWidth,
      gridColumns,
      gridGap,
      twoColumnItemWidth,
      threeColumnItemWidth,
      gridItemWidth,
    };
  }, [width, height]);
}
