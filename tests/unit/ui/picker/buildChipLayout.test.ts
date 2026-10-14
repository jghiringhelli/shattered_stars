/**
 * Spec: the builds tab lays chips out in wrapping rows; when there are more
 * chips than fit in the allowed rows they split into pages, and every chip
 * lands on exactly one page.
 */

import { describe, it, expect } from "vitest";
import { pageChips } from "../../../../src/ui/picker/buildChipLayout";

describe("pageChips", () => {
  it("puts chips that fit on one row on one page", () => {
    const pages = pageChips([60, 60, 60], { maxWidth: 400, gap: 8, maxRows: 2 });
    expect(pages).toEqual([[[0, 1, 2]]]);
  });

  it("wraps to a second row when a chip does not fit", () => {
    const pages = pageChips([150, 150, 150], { maxWidth: 320, gap: 8, maxRows: 2 });
    expect(pages).toEqual([[[0, 1], [2]]]);
  });

  it("starts a new page when the rows are full", () => {
    const pages = pageChips([200, 200, 200, 200], { maxWidth: 300, gap: 8, maxRows: 2 });
    expect(pages).toEqual([[[0], [1]], [[2], [3]]]);
  });

  it("gives an over-wide chip its own row instead of looping forever", () => {
    const pages = pageChips([500, 50], { maxWidth: 300, gap: 8, maxRows: 2 });
    expect(pages).toEqual([[[0], [1]]]);
  });

  it("returns one empty page for no chips", () => {
    expect(pageChips([], { maxWidth: 300, gap: 8, maxRows: 2 })).toEqual([[]]);
  });

  it("never loses or repeats a chip", () => {
    const widths = Array.from({ length: 23 }, (_, i) => 60 + (i % 5) * 20);
    const pages = pageChips(widths, { maxWidth: 360, gap: 8, maxRows: 2 });
    expect(pages.flat(2)).toEqual(widths.map((_, i) => i));
  });
});
