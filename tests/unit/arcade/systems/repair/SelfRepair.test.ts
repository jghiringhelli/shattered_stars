import { describe, it, expect } from "vitest";
import { selfRepairProfile } from "../../../../../src/arcade/systems/repair/SelfRepair";

describe("selfRepairProfile", () => {
  it("credits own shield regen when no repair card is fitted", () => {
    expect(selfRepairProfile(["elusive"])).toEqual({
      shield: "self_regen",
      hull: "self_regen",
    });
  });

  it("credits the astromech for its shield regeneration", () => {
    expect(selfRepairProfile(["repair_astromech"]).shield).toBe("astromech");
  });

  it("credits a hull-patching astromech for hull repair", () => {
    expect(selfRepairProfile(["patch_astromech"]).hull).toBe("astromech");
  });

  it("credits the mechanic crew for hull repair", () => {
    expect(selfRepairProfile(["mechanic", "patch_astromech"]).hull).toBe(
      "mechanic_crew",
    );
  });

  it("ignores unknown upgrade ids", () => {
    expect(selfRepairProfile(["no_such_card"]).shield).toBe("self_regen");
  });
});
