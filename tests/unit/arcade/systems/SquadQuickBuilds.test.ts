/**
 * SquadQuickBuilds — specification tests for handing quick builds to a
 * squad configured in the squad builder.
 */

import { describe, it, expect } from "vitest";
import { squadQuickBuilds } from "../../../../src/arcade/systems/SquadQuickBuilds";
import { assignQuickBuilds } from "../../../../src/arcade/systems/QuickBuildEquip";
import { uniquePilotOf } from "../../../../src/data/squadRules";

/** corsair_fang's first quick build is flown by a unique ace (Poison Fang). */
const FANG = "corsair_fang";

describe("squadQuickBuilds", () => {
  it("keeps the loadout chosen for a ship index", () => {
    expect(squadQuickBuilds([FANG, FANG], { "1": "fang_swarm" })[1]).toBe(
      "fang_swarm",
    );
  });

  it("gives every unchosen ship its default quick build", () => {
    expect(squadQuickBuilds([FANG])).toEqual(assignQuickBuilds([FANG]));
  });

  it("never repeats a chosen unique ace in a default build", () => {
    const chosenAce = "fang_raider";
    expect(uniquePilotOf(chosenAce)).not.toBeNull();
    const [byDefault] = squadQuickBuilds([FANG, FANG], { "1": chosenAce });
    expect(uniquePilotOf(byDefault ?? null)).not.toBe(uniquePilotOf(chosenAce));
  });

  it("ignores choices keyed past the end of the squad", () => {
    expect(squadQuickBuilds([FANG], { "3": "fang_swarm" })).toHaveLength(1);
  });

  it("a ship without quick builds flies bare", () => {
    expect(squadQuickBuilds(["no_such_ship"])).toEqual([null]);
  });
});
