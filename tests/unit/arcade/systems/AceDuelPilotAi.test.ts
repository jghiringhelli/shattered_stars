import { describe, expect, it } from "vitest";
import {
  REGENERATIVE_SHIELDS_PER_CYCLE,
  shieldsAfterCycle,
} from "../../../../src/arcade/systems/AceDuelPilotAi";
import { DURABILITY_SCALE } from "../../../../src/config";

/** One miniature shield point in real-time HP. */
const ONE_SHIELD = REGENERATIVE_SHIELDS_PER_CYCLE * DURABILITY_SCALE;

describe("shieldsAfterCycle", () => {
  it("leaves_shields_alone_without_regenerative_shields", () => {
    expect(shieldsAfterCycle(4, 12, ["marksmanship"])).toBe(4);
  });

  it("restores_one_miniature_shield_point_per_cycle_scaled_to_real_time_hp", () => {
    expect(shieldsAfterCycle(4, 100, ["regenerative_shields"])).toBe(
      4 + ONE_SHIELD,
    );
  });

  it("never_exceeds_maximum_shields", () => {
    expect(shieldsAfterCycle(11, 12, ["regenerative_shields"])).toBe(12);
    expect(shieldsAfterCycle(99, 100, ["regenerative_shields"])).toBe(100);
  });
});
