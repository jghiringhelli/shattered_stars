/**
 * Spec: the stats tab shows a ship's dial as a speed x direction grid; only
 * the directions the dial actually uses get a column, in turn-order, and
 * each cell carries the maneuver's colour (or nothing when absent).
 */

import { describe, it, expect } from "vitest";
import { buildDialGrid } from "../../../../src/ui/picker/dialGrid";
import { SHIP_DEFINITIONS, getShipDial } from "../../../../src/data/ShipDefinitions";

describe("buildDialGrid", () => {
  it("orders columns from the left turn through straight to the right turn", () => {
    const grid = buildDialGrid([
      { direction: "turn_right", speed: 1, difficulty: "white" },
      { direction: "straight", speed: 1, difficulty: "green" },
      { direction: "turn_left", speed: 1, difficulty: "white" },
    ]);
    expect(grid.columns.map((c) => c.direction)).toEqual([
      "turn_left",
      "straight",
      "turn_right",
    ]);
  });

  it("has one row per speed, lowest first", () => {
    const grid = buildDialGrid([
      { direction: "straight", speed: 3, difficulty: "green" },
      { direction: "straight", speed: 1, difficulty: "green" },
    ]);
    expect(grid.rows.map((r) => r.speed)).toEqual([1, 3]);
  });

  it("leaves a cell empty when the dial lacks that maneuver at that speed", () => {
    const grid = buildDialGrid([
      { direction: "straight", speed: 1, difficulty: "green" },
      { direction: "kturn", speed: 3, difficulty: "red" },
    ]);
    const row1 = grid.rows.find((r) => r.speed === 1)!;
    expect(row1.cells.find((c) => c.direction === "kturn")?.difficulty).toBeNull();
    const row3 = grid.rows.find((r) => r.speed === 3)!;
    expect(row3.cells.find((c) => c.direction === "kturn")?.difficulty).toBe("red");
  });

  it("counts maneuvers by colour", () => {
    const grid = buildDialGrid([
      { direction: "straight", speed: 1, difficulty: "green" },
      { direction: "straight", speed: 2, difficulty: "green" },
      { direction: "turn_left", speed: 2, difficulty: "red" },
    ]);
    expect(grid.counts).toEqual({ green: 2, white: 0, red: 1 });
  });

  it("builds a non-empty grid for every ship in the game", () => {
    for (const id of Object.keys(SHIP_DEFINITIONS)) {
      const grid = buildDialGrid(getShipDial(id));
      expect(grid.rows.length, id).toBeGreaterThan(0);
      expect(grid.counts.green + grid.counts.white + grid.counts.red, id).toBeGreaterThan(0);
    }
  });
});
