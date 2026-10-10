import { describe, it, expect } from "vitest";
import {
  findLoadoutViolations,
  findDeadCards,
} from "../../../src/data/loadoutRules";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";

const SMALL_FIGHTER = SHIP_DEFINITIONS["terran_centurion"]!;
const MEDIUM_SUPPORT = SHIP_DEFINITIONS["terran_sentinel"]!;
const CONFED_FIGHTER = SHIP_DEFINITIONS["confed_hawk"]!;

describe("findLoadoutViolations", () => {
  it("accepts cards that each take a free slot of their category", () => {
    expect(
      findLoadoutViolations(["predator", "shield_upgrade"], SMALL_FIGHTER, [
        "talent",
        "modification",
      ]),
    ).toEqual([]);
  });

  it("rejects a card whose category is missing from the slot bar", () => {
    const violations = findLoadoutViolations(
      ["proton_torpedo"],
      SMALL_FIGHTER,
      ["talent"],
    );
    expect(violations).toEqual([
      { upgradeId: "proton_torpedo", reason: "No torpedo slot available" },
    ]);
  });

  it("needs a second slot for a second card of the same category", () => {
    const violations = findLoadoutViolations(
      ["shield_upgrade", "hull_upgrade"],
      SMALL_FIGHTER,
      ["modification"],
    );
    expect(violations.map((v) => v.upgradeId)).toEqual(["hull_upgrade"]);
  });

  it("rejects a card locked to another faction", () => {
    const violations = findLoadoutViolations(
      ["force_sensitive"],
      CONFED_FIGHTER,
      ["talent"],
    );
    expect(violations[0]?.reason).toContain("ascendant_empire");
  });

  it("rejects a card that does not fit the hull size", () => {
    const violations = findLoadoutViolations(
      ["engine_upgrade"],
      MEDIUM_SUPPORT,
      ["modification"],
    );
    expect(violations[0]?.reason).toContain("ship");
  });

  it("flags unknown upgrade ids", () => {
    expect(
      findLoadoutViolations(["not_a_card"], SMALL_FIGHTER, ["talent"]),
    ).toEqual([{ upgradeId: "not_a_card", reason: "Unknown upgrade" }]);
  });
});

describe("findDeadCards", () => {
  it("flags an ordnance booster on a build with no ordnance", () => {
    expect(findDeadCards(["fire_control_system"], SMALL_FIGHTER)).toEqual([
      "fire_control_system",
    ]);
  });

  it("accepts an ordnance booster next to ordnance", () => {
    expect(
      findDeadCards(
        ["fire_control_system", "concussion_missile"],
        SMALL_FIGHTER,
      ),
    ).toEqual([]);
  });

  it("flags a turret booster on a build with no turret", () => {
    expect(findDeadCards(["skilled_gunner"], MEDIUM_SUPPORT)).toEqual([
      "skilled_gunner",
    ]);
  });

  it("keeps command cards on aura projectors, where they widen the aura", () => {
    expect(findDeadCards(["tactical_officer"], MEDIUM_SUPPORT)).toEqual([]);
  });

  it("never flags stat cards", () => {
    expect(
      findDeadCards(["hull_upgrade", "shield_upgrade"], SMALL_FIGHTER),
    ).toEqual([]);
  });
});
