import { describe, expect, it } from "vitest";
import { shieldsAfterCycle } from "../../../../src/arcade/systems/AceDuelPilotAi";

describe("shieldsAfterCycle", () => {
  it("leaves_shields_alone_without_regenerative_shields", () => {
    expect(shieldsAfterCycle(1, 3, ["marksmanship"])).toBe(1);
  });

  it("restores_one_shield_per_cycle_with_regenerative_shields", () => {
    expect(shieldsAfterCycle(1, 3, ["regenerative_shields"])).toBe(2);
  });

  it("never_exceeds_maximum_shields", () => {
    expect(shieldsAfterCycle(3, 3, ["regenerative_shields"])).toBe(3);
  });
});
