import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gridItemWidth, responsiveGridColumns, tabBarLayout } from "./layout-metrics";

describe("responsive layout bounds", () => {
  it("keeps grids inside phone and tablet widths at larger font sizes", () => {
    for (const width of [280, 320, 360, 393, 427, 600, 768]) {
      const padding = width < 380 ? 16 : 20;
      const contentWidth = width - padding * 2;
      for (const fontScale of [1, 1.3, 1.5, 2]) {
        const columns = responsiveGridColumns(contentWidth, fontScale);
        const itemWidth = gridItemWidth(contentWidth, columns, 8);
        assert.ok(columns >= 1 && columns <= 3);
        assert.ok(itemWidth > 0);
        assert.ok(Math.abs(itemWidth * columns + 8 * (columns - 1) - contentWidth) < 0.001);
        if (columns > 1) assert.ok(itemWidth >= 130 * fontScale);
      }
    }
  });

  it("reduces columns when accessibility text needs more room", () => {
    assert.equal(responsiveGridColumns(288), 2);
    assert.equal(responsiveGridColumns(288, 1.5), 1);
    assert.equal(responsiveGridColumns(560), 3);
    assert.equal(responsiveGridColumns(560, 2), 2);
  });

  it("reserves space for the icon, scaled label, and Android or iOS safe area", () => {
    for (const bottomInset of [0, 24, 34, 48]) {
      let previousHeight = 0;
      for (const fontScale of [1, 1.3, 1.5, 2]) {
        const layout = tabBarLayout(bottomInset, fontScale);
        assert.ok(layout.bottomPadding >= bottomInset);
        assert.ok(layout.contentHeight >= 24 + 16 * fontScale + 4 + 8);
        assert.equal(layout.height, layout.contentHeight + 8 + layout.bottomPadding);
        assert.ok(layout.height >= previousHeight);
        previousHeight = layout.height;
      }
    }
  });
});
