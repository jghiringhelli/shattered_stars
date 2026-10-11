import { describe, it, expect } from "vitest";
import type { ManeuverDefinition } from "../../../src/core/types";
import {
  dialSteps,
  stressDifficulty,
} from "../../../src/data/dialPermissiveness";

const STRAIGHT_1_GREEN: ManeuverDefinition = {
  direction: "straight",
  speed: 1,
  difficulty: "green",
};

describe("stressDifficulty", () => {
  it("reads the dial entry for the cell", () => {
    expect(stressDifficulty([STRAIGHT_1_GREEN], "straight", 1)).toBe("green");
  });

  it("treats a cell missing from the dial as red", () => {
    expect(stressDifficulty([STRAIGHT_1_GREEN], "bank_left", 1)).toBe("red");
  });
});

describe("dialSteps", () => {
  it("scores green 2, white 1 and red 0 per stress cell", () => {
    const dial: ManeuverDefinition[] = [
      STRAIGHT_1_GREEN,
      { direction: "bank_left", speed: 1, difficulty: "white" },
      { direction: "turn_left", speed: 1, difficulty: "red" },
    ];
    expect(dialSteps(dial, { min: 1, max: 1 })).toBe(3);
  });

  it("counts a missing maneuver as red", () => {
    expect(dialSteps([STRAIGHT_1_GREEN], { min: 1, max: 1 })).toBe(2);
  });

  it("reads only the cells the stress model reads (left side, no K-turn)", () => {
    const dial: ManeuverDefinition[] = [
      { direction: "bank_right", speed: 1, difficulty: "green" },
      { direction: "kturn", speed: 1, difficulty: "green" },
      { direction: "segnor_left", speed: 1, difficulty: "green" },
    ];
    expect(dialSteps(dial, { min: 1, max: 1 })).toBe(0);
  });

  it("ignores maneuvers outside the ship's speed band", () => {
    const dial: ManeuverDefinition[] = [
      STRAIGHT_1_GREEN,
      { direction: "straight", speed: 3, difficulty: "green" },
    ];
    expect(dialSteps(dial, { min: 1, max: 2 })).toBe(2);
  });

  it("never scores speed 0 (a hover is not a stress maneuver)", () => {
    const dial: ManeuverDefinition[] = [
      { direction: "straight", speed: 0, difficulty: "green" },
    ];
    expect(dialSteps(dial, { min: 0, max: 0 })).toBe(0);
  });
});
