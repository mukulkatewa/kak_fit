/** Keep every grid column inside the available content width, including gaps. */
export function gridItemWidth(contentWidth: number, columns: number, gap: number): number {
  return Math.max(0, (contentWidth - gap * (columns - 1)) / columns);
}

export function responsiveGridColumns(contentWidth: number, fontScale = 1): number {
  const preferred = contentWidth > 388 ? 3 : 2;
  const fitting = Math.floor((contentWidth + 8) / (130 * Math.max(1, fontScale) + 8));
  return Math.max(1, Math.min(preferred, fitting));
}

/** The navigator and floating workout controls must use the same measured bar. */
export function tabBarLayout(bottomInset: number, fontScale = 1) {
  const contentHeight = Math.max(56, 24 + 16 * fontScale + 4 + 8);
  const bottomPadding = Math.max(8, bottomInset);
  return { contentHeight, bottomPadding, height: contentHeight + 8 + bottomPadding };
}
