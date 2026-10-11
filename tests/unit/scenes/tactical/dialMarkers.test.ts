/**
 * dialMarkers — specification tests for the Continuous Tactical order
 * card's maneuver dial layout.
 */

import { describe, it, expect } from "vitest";
import type { ManeuverDefinition } from "../../../../src/core/types";
import {
  dialMarkers,
  difficultyColor,
} from "../../../../src/scenes/tactical/dialMarkers";

const DIAL: readonly ManeuverDefinition[] = [
  { direction: "straight", speed: 2, difficulty: "green" },
  { direction: "bank_left", speed: 2, difficulty: "white" },
  { direction: "turn_right", speed: 2, difficulty: "red" },
  { direction: "straight", speed: 3, difficulty: "white" },
] as ManeuverDefinition[];

describe("dialMarkers", () => {
  it("shows only the maneuvers at the ordered speed", () => {
    const markers = dialMarkers(DIAL, { direction: "straight", speed: 2 }, 40);
    expect(markers.map((m) => m.direction)).toEqual([
      "straight",
      "bank_left",
      "turn_right",
    ]);
  });

  it("places straight at the top and a right turn at the right", () => {
    const [straight, , turnRight] = dialMarkers(
      DIAL,
      { direction: "straight", speed: 2 },
      40,
    );
    expect(straight!.x).toBeCloseTo(0);
    expect(straight!.y).toBeCloseTo(-40);
    expect(turnRight!.x).toBeCloseTo(40);
    expect(turnRight!.y).toBeCloseTo(0);
  });

  it("colours by difficulty and marks the ordered maneuver", () => {
    const markers = dialMarkers(DIAL, { direction: "bank_left", speed: 2 }, 40);
    expect(markers.find((m) => m.selected)?.direction).toBe("bank_left");
    expect(markers.find((m) => m.direction === "turn_right")?.color).toBe(
      difficultyColor("red"),
    );
  });
});
