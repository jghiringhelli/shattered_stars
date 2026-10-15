import { describe, expect, it } from "vitest";
import {
  nearestIndex,
  nextByDirection,
  readingOrder,
  type FocusBox,
} from "../../../../src/ui/menu/focusGeometry";

const box = (x: number, y: number, width = 100, height = 40): FocusBox => ({
  x,
  y,
  width,
  height,
});

/** Two columns of two rows: 0 1 / 2 3. */
const GRID = [box(0, 0), box(200, 0), box(0, 100), box(200, 100)];

describe("focusGeometry", () => {
  it("orders controls top to bottom then left to right", () => {
    expect(readingOrder([GRID[3]!, GRID[0]!, GRID[2]!, GRID[1]!])).toEqual([
      1, 3, 2, 0,
    ]);
  });

  it("moves along the arrow's direction", () => {
    expect(nextByDirection(GRID, 0, "right")).toBe(1);
    expect(nextByDirection(GRID, 0, "down")).toBe(2);
    expect(nextByDirection(GRID, 3, "left")).toBe(2);
    expect(nextByDirection(GRID, 3, "up")).toBe(1);
  });

  it("stays put when nothing lies that way", () => {
    expect(nextByDirection(GRID, 0, "up")).toBe(0);
    expect(nextByDirection(GRID, 1, "right")).toBe(1);
  });

  it("prefers the control in line over a nearer one off to the side", () => {
    const boxes = [box(0, 0), box(300, 60), box(10, 120)];
    expect(nextByDirection(boxes, 0, "down")).toBe(2);
  });

  it("starts at the first control in reading order when nothing is focused", () => {
    expect(nextByDirection([GRID[2]!, GRID[1]!], -1, "down")).toBe(1);
  });

  it("finds the control nearest a remembered point", () => {
    expect(nearestIndex(GRID, { x: 210, y: 110 })).toBe(3);
    expect(nearestIndex([], { x: 0, y: 0 })).toBe(-1);
  });
});
