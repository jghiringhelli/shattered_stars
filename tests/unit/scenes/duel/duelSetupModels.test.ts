import { describe, expect, it } from "vitest";
import {
  EVEN_GAP_POINTS,
  pointsStrip,
  sidePoints,
} from "../../../../src/scenes/duel/duelPointsModel";
import {
  compareStats,
  type StatBonuses,
} from "../../../../src/scenes/duel/duelStatsModel";
import {
  DIFFICULTY_LINES,
  FORMAT_LINES,
  pickQuickBuild,
} from "../../../../src/scenes/duel/duelSetupModel";
import { getShipDefinition } from "../../../../src/data/ShipDefinitions";
import { getEquippableLoadouts } from "../../../../src/data/ShipLoadouts";
import { flownSquadCost } from "../../../../src/core/squadTypes";

const NO_BONUS: StatBonuses = { hull: 0, shld: 0, atk: 0, agi: 0 };

describe("sidePoints", () => {
  it("prices a ship on its chosen build as flown (hull + pilot + cards)", () => {
    const shipId = "confed_sparrow";
    const build = getEquippableLoadouts(shipId)[0]!;
    expect(sidePoints([shipId], [build.id])).toBe(build.pointCost);
    expect(sidePoints([shipId], [build.id])).toBe(
      flownSquadCost([shipId], { "0": build.id }),
    );
  });

  it("sums every ship of a side", () => {
    const ships = ["confed_sparrow", "terran_viper"];
    expect(sidePoints(ships, [null, null])).toBe(flownSquadCost(ships));
  });

  it("is zero for an empty side", () => {
    expect(sidePoints([], [])).toBe(0);
  });
});

describe("pointsStrip", () => {
  it("calls a gap within the even threshold an even duel", () => {
    const strip = pointsStrip(50, 50 + EVEN_GAP_POINTS);
    expect(strip.verdict).toBe("even");
    expect(strip.caption).toContain("Even");
  });

  it("says how many points the player is up", () => {
    const strip = pointsStrip(60, 40);
    expect(strip.verdict).toBe("up");
    expect(strip.gap).toBe(20);
    expect(strip.caption).toBe("You fly 20 pt more than the enemy");
  });

  it("says how many points the player is down", () => {
    const strip = pointsStrip(40, 60);
    expect(strip.verdict).toBe("down");
    expect(strip.caption).toBe("The enemy flies 20 pt more than you");
  });

  it("splits the bar by share of the total and clamps empty sides", () => {
    expect(pointsStrip(30, 90).youShare).toBeCloseTo(0.25);
    expect(pointsStrip(0, 0).youShare).toBe(0.5);
  });
});

describe("compareStats", () => {
  const viper = getShipDefinition("terran_viper")!;
  const sparrow = getShipDefinition("confed_sparrow")!;

  it("lists hull, shields, attack, agility and speed rows with both values", () => {
    const rows = compareStats(sparrow, NO_BONUS, viper, NO_BONUS);
    expect(rows.map((row) => row.label)).toEqual([
      "HULL",
      "SHIELDS",
      "ATTACK",
      "AGILITY",
      "SPEED",
    ]);
    expect(rows[0]!.you).toBe(sparrow.baseStats.hull);
    expect(rows[0]!.enemy).toBe(viper.baseStats.hull);
  });

  it("folds build bonuses into the value", () => {
    const rows = compareStats(
      sparrow,
      { ...NO_BONUS, atk: 2 },
      viper,
      NO_BONUS,
    );
    const attack = rows.find((row) => row.label === "ATTACK")!;
    expect(attack.you).toBe(sparrow.baseStats.attack + 2);
  });

  it("marks the better side and leaves ties unmarked", () => {
    const rows = compareStats(sparrow, NO_BONUS, sparrow, NO_BONUS);
    expect(rows.every((row) => row.better === "tie")).toBe(true);
    const lead = compareStats(sparrow, { ...NO_BONUS, hull: 3 }, sparrow, NO_BONUS);
    expect(lead.find((row) => row.label === "HULL")!.better).toBe("you");
  });
});

describe("setup texts", () => {
  it("explains every difficulty in a sentence", () => {
    for (const level of ["easy", "normal", "hard", "brutal"] as const) {
      expect(DIFFICULTY_LINES[level].length).toBeGreaterThan(30);
    }
  });

  it("explains both formats", () => {
    expect(FORMAT_LINES.best_of_3).toContain("two");
    expect(FORMAT_LINES.best_of_5).toContain("three");
  });
});

describe("pickQuickBuild", () => {
  const shipId = "confed_sparrow";
  const [first, second] = getEquippableLoadouts(shipId);

  it("sets the chosen build of one ship", () => {
    const next = pickQuickBuild(
      { shipIds: [shipId], loadoutIds: [first!.id] },
      0,
      second!.id,
    );
    expect(next.loadoutIds).toEqual([second!.id]);
  });

  it("ignores a build the ship does not offer", () => {
    const selection = { shipIds: [shipId], loadoutIds: [first!.id] };
    expect(pickQuickBuild(selection, 0, "no_such_build")).toBe(selection);
  });

  it("accepts the bare hull (null)", () => {
    const next = pickQuickBuild(
      { shipIds: [shipId], loadoutIds: [first!.id] },
      0,
      null,
    );
    expect(next.loadoutIds).toEqual([null]);
  });
});
