/**
 * Gate: a Skirmish launch must be a points-fair fight.
 *
 * The simple flow lets the player pick a single flagship. Before
 * fillSquadWingmen existed, that ship launched alone — a 28pt Stiletto
 * against a 198pt three-ship AI squad. These tests pin the squad that gets
 * built around the player's pick.
 */

import { describe, it, expect } from "vitest";
import {
  makeSquad,
  autoFillSquad,
  fillSquadWingmen,
  pickOpponentFaction,
  MAX_SQUAD_SHIPS,
  type SquadEntry,
} from "../../../src/core/squadTypes";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";
import {
  getLoadoutById,
  getEquippableLoadouts,
} from "../../../src/data/ShipLoadouts";
import { assignQuickBuilds } from "../../../src/arcade/systems/QuickBuildEquip";
import { getQuickBuild, toSimSpecs } from "../../../src/data/SquadronPresets";
import type { FactionId } from "../../../src/config";

const ALL_FACTIONS: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

const POINT_LIMIT = 200;

/**
 * Total point cost of a squad as it flies: every ship on its chosen quick
 * build, else the default one the battle scene equips (assignQuickBuilds),
 * priced at that build's cost.
 */
function costOf(squad: SquadEntry): number {
  const builds = assignQuickBuilds(
    squad.ships,
    squad.ships.map((_, i) => squad.loadoutChoices[String(i)]),
  );
  return squad.ships.reduce((sum, id, i) => {
    const build = builds[i] ? getLoadoutById(builds[i]!) : undefined;
    return (
      sum + (build?.pointCost ?? SHIP_DEFINITIONS[id]!.baseStats.pointCost)
    );
  }, 0);
}

/** The cheapest non-capital ship in a faction — what a new player picks. */
function cheapestShip(faction: FactionId): string {
  return Object.values(SHIP_DEFINITIONS)
    .filter(
      (s) =>
        s.faction === faction &&
        s.role !== "capital" &&
        s.baseStats.size !== "huge",
    )
    .sort((a, b) => a.baseStats.pointCost - b.baseStats.pointCost)[0]!.id;
}

/** Build the player squad exactly as the simple Skirmish flow does. */
function playerSquadWithFlagship(
  faction: FactionId,
  flagshipId: string,
): SquadEntry {
  const squad = makeSquad(1, 0, "player");
  squad.factionId = faction;
  squad.ships = [flagshipId];
  squad.pointsUsed = SHIP_DEFINITIONS[flagshipId]!.baseStats.pointCost;
  fillSquadWingmen(squad, "arcade", POINT_LIMIT);
  return squad;
}

describe("fillSquadWingmen", () => {
  it("keeps the player's flagship as the first ship", () => {
    const squad = playerSquadWithFlagship("terran_hegemony", "terran_stiletto");
    expect(squad.ships[0]).toBe("terran_stiletto");
  });

  it("adds wingmen to a squad that only has a flagship", () => {
    const squad = playerSquadWithFlagship("terran_hegemony", "terran_stiletto");
    expect(squad.ships.length).toBeGreaterThan(1);
  });

  it("never exceeds the point limit", () => {
    for (const faction of ALL_FACTIONS) {
      const squad = playerSquadWithFlagship(faction, cheapestShip(faction));
      expect(squad.pointsUsed).toBeLessThanOrEqual(POINT_LIMIT);
    }
  });

  it("reports pointsUsed that matches the ships it actually chose", () => {
    for (const faction of ALL_FACTIONS) {
      const squad = playerSquadWithFlagship(faction, cheapestShip(faction));
      expect(squad.pointsUsed).toBe(costOf(squad));
    }
  });

  it("charges the player's chosen quick build, not the bare hull", () => {
    const flagship = "terran_viper";
    const priciest = [...getEquippableLoadouts(flagship)].sort(
      (a, b) => b.pointCost - a.pointCost,
    )[0]!;
    const squad = makeSquad(1, 0, "player");
    squad.factionId = "terran_hegemony";
    squad.ships = [flagship];
    squad.loadoutChoices = { "0": priciest.id };
    fillSquadWingmen(squad, "arcade", POINT_LIMIT);
    expect(squad.pointsUsed).toBe(costOf(squad));
    expect(squad.pointsUsed).toBeLessThanOrEqual(POINT_LIMIT);
  });

  it("never exceeds the squad size cap", () => {
    for (const faction of ALL_FACTIONS) {
      const squad = playerSquadWithFlagship(faction, cheapestShip(faction));
      expect(squad.ships.length).toBeLessThanOrEqual(MAX_SQUAD_SHIPS);
    }
  });

  it("does not duplicate the flagship", () => {
    const squad = playerSquadWithFlagship("terran_hegemony", "terran_stiletto");
    const flagshipCount = squad.ships.filter(
      (id) => id === "terran_stiletto",
    ).length;
    expect(flagshipCount).toBe(1);
  });

  it("leaves a squad alone when the flagship already spends the budget", () => {
    const priciest = Object.values(SHIP_DEFINITIONS)
      .filter(
        (s) =>
          s.faction === "terran_hegemony" &&
          s.role !== "capital" &&
          s.baseStats.size !== "huge",
      )
      .sort((a, b) => b.baseStats.pointCost - a.baseStats.pointCost)[0]!;
    const squad = makeSquad(1, 0, "player");
    squad.factionId = "terran_hegemony";
    squad.ships = [priciest.id];
    squad.pointsUsed = priciest.baseStats.pointCost;
    fillSquadWingmen(squad, "arcade", priciest.baseStats.pointCost);
    expect(squad.ships).toEqual([priciest.id]);
  });

  it("is a no-op for a squad with no faction", () => {
    const squad = makeSquad(1, 0, "player");
    squad.factionId = null;
    fillSquadWingmen(squad, "arcade", POINT_LIMIT);
    expect(squad.ships).toEqual([]);
  });

  it("excludes capitals and huge ships outside epic mode", () => {
    for (const faction of ALL_FACTIONS) {
      const squad = playerSquadWithFlagship(faction, cheapestShip(faction));
      for (const id of squad.ships) {
        const def = SHIP_DEFINITIONS[id]!;
        expect(def.role).not.toBe("capital");
        expect(def.baseStats.size).not.toBe("huge");
      }
    }
  });
});

describe("Skirmish launch is a fair fight", () => {
  it("gives the player a squad within 25% of the AI squad's points", () => {
    for (const faction of ALL_FACTIONS) {
      const player = playerSquadWithFlagship(faction, cheapestShip(faction));

      const opponent = makeSquad(2, 0, "ai");
      opponent.factionId = pickOpponentFaction(faction);
      autoFillSquad(opponent, "arcade", POINT_LIMIT);

      // The old bug launched 28pt vs 198pt — a 7x deficit. Greedy fill can't
      // hit the limit exactly (ship costs are lumpy), so allow a 25% spread.
      const ratio = player.pointsUsed / opponent.pointsUsed;
      expect(ratio).toBeGreaterThan(0.75);
    }
  });
});

describe("autoFillSquad", () => {
  it("fields the faction's curated quick-build squad when one matches the budget", () => {
    for (const faction of ALL_FACTIONS) {
      const preset = getQuickBuild(faction, POINT_LIMIT)!;
      const squad = makeSquad(2, 0, "ai");
      squad.factionId = faction;
      autoFillSquad(squad, "arcade", POINT_LIMIT);
      expect(squad.ships).toEqual(toSimSpecs(preset).map((s) => s.shipId));
      expect(
        squad.ships.map((_, i) => squad.loadoutChoices[String(i)]),
      ).toEqual(preset.ships.map((s) => s.loadoutId));
      expect(squad.pointsUsed).toBe(preset.totalCost);
    }
  });

  it("falls back to the greedy fill when no preset matches the budget", () => {
    const squad = makeSquad(2, 0, "ai");
    squad.factionId = "terran_hegemony";
    autoFillSquad(squad, "arcade", 250);
    expect(squad.ships.length).toBeGreaterThan(0);
    expect(squad.loadoutChoices).toEqual({});
    expect(costOf(squad)).toBeLessThanOrEqual(250);
  });

  it("prices the AI squad at the quick builds it flies, within the limit", () => {
    for (const faction of ALL_FACTIONS) {
      const squad = makeSquad(2, 0, "ai");
      squad.factionId = faction;
      autoFillSquad(squad, "arcade", POINT_LIMIT);
      expect(squad.pointsUsed).toBe(costOf(squad));
      expect(costOf(squad)).toBeLessThanOrEqual(POINT_LIMIT);
    }
  });

  it("rebuilds from scratch instead of accumulating onto existing ships", () => {
    const fresh = makeSquad(1, 0, "ai");
    fresh.factionId = "terran_hegemony";
    autoFillSquad(fresh, "arcade", POINT_LIMIT);

    const prefilled = makeSquad(1, 0, "ai");
    prefilled.factionId = "terran_hegemony";
    prefilled.ships = ["terran_stiletto"];
    prefilled.pointsUsed =
      SHIP_DEFINITIONS["terran_stiletto"]!.baseStats.pointCost;
    autoFillSquad(prefilled, "arcade", POINT_LIMIT);

    // Auto-Fill in the advanced builder means "rebuild from scratch", so a
    // squad that already had ships must land on the same result as an empty one.
    expect(prefilled.ships).toEqual(fresh.ships);
    expect(prefilled.pointsUsed).toBe(costOf(prefilled));
  });
});
