/**
 * Spec: the one footer-hint format every menu uses — "KEY  ACTION" pairs,
 * actions upper-cased, pairs separated by a wide gap (no bullets).
 */

import { describe, it, expect } from "vitest";
import {
  FOOTER_PAIR_GAP,
  footerKeys,
} from "../../../../src/ui/menu/footerKeys";

describe("footerKeys", () => {
  it("formats key / action pairs like the Settings footer", () => {
    expect(
      footerKeys([
        ["↑ ↓", "browse ships"],
        ["ESC", "back"],
      ]),
    ).toBe(`↑ ↓  BROWSE SHIPS${FOOTER_PAIR_GAP}ESC  BACK`);
  });

  it("keeps key glyphs as written", () => {
    expect(footerKeys([["Wheel", "scroll"]])).toBe("Wheel  SCROLL");
  });

  it("uses a six-space gap between pairs", () => {
    expect(FOOTER_PAIR_GAP).toBe("      ");
  });
});
