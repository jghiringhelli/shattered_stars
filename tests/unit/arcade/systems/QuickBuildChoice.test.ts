/**
 * QuickBuildChoice — the player's quick-build pick on a setup screen:
 * defaults to what assignQuickBuilds would give, cycles through the ship's
 * quick builds and never fields a unique ace twice in the squad.
 */

import { describe, it, expect } from "vitest";
import {
  cycleQuickBuild,
  quickBuildOptions,
  selectionFor,
} from "../../../../src/arcade/systems/QuickBuildChoice";
import { assignQuickBuilds } from "../../../../src/arcade/systems/QuickBuildEquip";
import {
  getEquippableLoadouts,
  SHIP_LOADOUTS,
} from "../../../../src/data/ShipLoadouts";
import { uniquePilotOf } from "../../../../src/data/squadRules";

const FANG = "corsair_fang";

/** A ship offering at least three quick builds (read from the catalogue). */
const MANY = Object.keys(SHIP_LOADOUTS).find(
  (shipId) => getEquippableLoadouts(shipId).length >= 3,
)!;

describe("quickBuildOptions", () => {
  it("offers the ship's equippable quick builds, in catalogue order", () => {
    expect(quickBuildOptions(FANG)).toEqual(
      getEquippableLoadouts(FANG).map((loadout) => loadout.id),
    );
  });

  it("offers nothing for an unknown ship", () => {
    expect(quickBuildOptions("no_such_ship")).toEqual([]);
  });
});

describe("selectionFor", () => {
  it("defaults to exactly what assignQuickBuilds gives", () => {
    expect(selectionFor([FANG, FANG]).loadoutIds).toEqual(
      assignQuickBuilds([FANG, FANG]),
    );
  });

  it("keeps a previous choice for the same ships", () => {
    const options = quickBuildOptions(MANY);
    const previous = { shipIds: [MANY], loadoutIds: [options[2]!] };
    expect(selectionFor([MANY], previous).loadoutIds).toEqual([options[2]]);
  });

  it("drops a previous choice made for other ships", () => {
    const previous = { shipIds: [MANY], loadoutIds: ["whatever"] };
    expect(selectionFor([FANG], previous)).toEqual({
      shipIds: [FANG],
      loadoutIds: assignQuickBuilds([FANG]),
    });
  });

  it("replaces a choice the ship no longer offers with the default", () => {
    const previous = { shipIds: [FANG], loadoutIds: ["retired_build"] };
    expect(selectionFor([FANG], previous).loadoutIds).toEqual(
      assignQuickBuilds([FANG]),
    );
  });

  it("drops a repeated unique ace from a previous choice", () => {
    const ace = assignQuickBuilds([FANG])[0]!;
    const previous = { shipIds: [FANG, FANG], loadoutIds: [ace, ace] };
    const [first, second] = selectionFor([FANG, FANG], previous).loadoutIds;
    expect(first).toBe(ace);
    expect(uniquePilotOf(second ?? null)).not.toBe(uniquePilotOf(ace));
  });
});

describe("cycleQuickBuild", () => {
  it("steps forward to the next quick build", () => {
    const options = quickBuildOptions(MANY);
    const start = { shipIds: [MANY], loadoutIds: [options[0]!] };
    expect(cycleQuickBuild(start, 0, 1).loadoutIds).toEqual([options[1]]);
  });

  it("steps backward and wraps to the last quick build", () => {
    const options = quickBuildOptions(MANY);
    const start = { shipIds: [MANY], loadoutIds: [options[0]!] };
    expect(cycleQuickBuild(start, 0, -1).loadoutIds).toEqual([
      options[options.length - 1],
    ]);
  });

  it("wraps forward from the last quick build to the first", () => {
    const options = quickBuildOptions(MANY);
    const last = options[options.length - 1]!;
    const start = { shipIds: [MANY], loadoutIds: [last] };
    expect(cycleQuickBuild(start, 0, 1).loadoutIds).toEqual([options[0]]);
  });

  it("from no build, forward picks the first and backward the last", () => {
    const options = quickBuildOptions(MANY);
    const bare = { shipIds: [MANY], loadoutIds: [null] };
    expect(cycleQuickBuild(bare, 0, 1).loadoutIds).toEqual([options[0]]);
    expect(cycleQuickBuild(bare, 0, -1).loadoutIds).toEqual([
      options[options.length - 1],
    ]);
  });

  it("never hands a squadmate's unique ace to another ship", () => {
    let selection = selectionFor([FANG, FANG]);
    const ace = uniquePilotOf(selection.loadoutIds[0] ?? null);
    for (let step = 0; step < 6; step++) {
      selection = cycleQuickBuild(selection, 1, 1);
      const pilot = uniquePilotOf(selection.loadoutIds[1] ?? null);
      expect(pilot === null || pilot !== ace).toBe(true);
    }
  });

  it("leaves the other ships' builds untouched", () => {
    const start = selectionFor([FANG, MANY]);
    expect(cycleQuickBuild(start, 1, 1).loadoutIds[0]).toBe(
      start.loadoutIds[0],
    );
  });

  it("a ship with no quick builds stays bare", () => {
    const bare = { shipIds: ["no_such_ship"], loadoutIds: [null] };
    expect(cycleQuickBuild(bare, 0, 1)).toEqual(bare);
  });

  it("an out-of-range index changes nothing", () => {
    const start = selectionFor([FANG]);
    expect(cycleQuickBuild(start, 3, 1)).toEqual(start);
  });
});
