import { describe, it, expect } from "vitest";
import {
  uniquePilotOf,
  wouldDuplicateUniquePilot,
} from "../../../src/data/squadRules";
import { SHIP_LOADOUTS } from "../../../src/data/ShipLoadouts";
import { PILOT_CARDS } from "../../../src/systems/SquadBuilder";

const loadouts = Object.values(SHIP_LOADOUTS).flat();
const uniqueBuild = loadouts.find((l) => PILOT_CARDS[l.pilotId]?.isUnique)!;
const genericBuild = loadouts.find((l) => !PILOT_CARDS[l.pilotId]?.isUnique)!;

describe("uniquePilotOf", () => {
  it("names the unique pilot of an ace loadout", () => {
    expect(uniquePilotOf(uniqueBuild.id)).toBe(uniqueBuild.pilotId);
  });

  it("returns null for a generic pilot", () => {
    expect(uniquePilotOf(genericBuild.id)).toBeNull();
  });

  it("returns null for the bare ship", () => {
    expect(uniquePilotOf(null)).toBeNull();
  });
});

describe("wouldDuplicateUniquePilot", () => {
  it("refuses a second copy of a unique pilot", () => {
    expect(wouldDuplicateUniquePilot([uniqueBuild.id], uniqueBuild.id)).toBe(
      true,
    );
  });

  it("allows the first copy of a unique pilot", () => {
    expect(wouldDuplicateUniquePilot([genericBuild.id], uniqueBuild.id)).toBe(
      false,
    );
  });

  it("allows any number of generic pilots", () => {
    expect(
      wouldDuplicateUniquePilot(
        [genericBuild.id, genericBuild.id],
        genericBuild.id,
      ),
    ).toBe(false);
  });

  it("allows any number of bare ships", () => {
    expect(wouldDuplicateUniquePilot([null, null], null)).toBe(false);
  });
});
