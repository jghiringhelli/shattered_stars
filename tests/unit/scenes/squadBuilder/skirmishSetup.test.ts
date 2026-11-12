/**
 * Spec: launching Skirmish builds two squads — the player's flagship with
 * the wingmen of the chosen type, and an AI opponent of another faction
 * matched to the same point limit. The remembered builder maps to and from
 * squads, carrying the WINGMEN choice.
 */

import { describe, expect, it } from "vitest";
import { flownSquadCost } from "../../../../src/core/squadTypes";
import { SHIP_DEFINITIONS } from "../../../../src/data/ShipDefinitions";
import { planWingmen } from "../../../../src/systems/setup/wingmen";
import type { BuilderMemory } from "../../../../src/systems/setup/setupMemory";
import {
  builderMemoryOf,
  sharedPlayerSquad,
  squadsFromMemory,
} from "../../../../src/scenes/squadBuilder/builderMemory";
import { skirmishSquads } from "../../../../src/scenes/squadBuilder/skirmishLaunch";

const PLAN = planWingmen({
  faction: "terran_hegemony",
  shipId: "terran_gladius",
  loadoutId: null,
  type: "auto",
  gameMode: "arcade",
  pointLimit: 200,
  seed: 3,
});

describe("skirmishSquads", () => {
  const squads = skirmishSquads({ factionId: "terran_hegemony", shipId: "terran_gladius", loadoutId: null }, PLAN, "arcade", 200);

  it("flies the planned squad as team 1's player", () => {
    expect(squads[0]).toMatchObject({ teamId: 1, controller: "player", factionId: "terran_hegemony", ships: PLAN.ships });
    expect(squads[0]!.pointsUsed).toBe(PLAN.pointsUsed);
  });

  it("matches an AI opponent of another faction to the point limit", () => {
    const enemy = squads[1]!;
    expect(enemy).toMatchObject({ teamId: 2, controller: "ai" });
    expect(enemy.factionId).not.toBe("terran_hegemony");
    expect(enemy.ships.length).toBeGreaterThan(0);
    expect(enemy.pointsUsed).toBe(flownSquadCost(enemy.ships, enemy.loadoutChoices));
    expect(enemy.pointsUsed).toBeLessThanOrEqual(200);
    for (const id of enemy.ships) expect(SHIP_DEFINITIONS[id]!.faction).toBe(enemy.factionId);
  });
});

describe("builder memory", () => {
  const squads = skirmishSquads({ factionId: "terran_hegemony", shipId: "terran_gladius", loadoutId: null }, PLAN, "arcade", 200);

  it("keeps the wingmen choice and the custom wingmen", () => {
    const memory = builderMemoryOf({
      pointLimit: 200,
      aiDifficulty: "hard",
      simpleMode: true,
      mapTheme: "random",
      wingmen: "strikers",
      customWingmen: ["terran_gladius"],
      squads,
    });
    expect(memory.wingmen).toBe("strikers");
    expect(memory.customWingmen).toEqual(["terran_gladius"]);
    expect(memory.squads).toHaveLength(2);
  });

  it("maps remembered squads back and skips ones with retired ships", () => {
    const memory: BuilderMemory = builderMemoryOf({
      pointLimit: 200,
      aiDifficulty: "normal",
      simpleMode: true,
      mapTheme: "random",
      wingmen: "auto",
      customWingmen: [],
      squads,
    });
    const restored = squadsFromMemory(memory);
    expect(restored?.map((s) => s.ships)).toEqual(squads.map((s) => s.ships));
    const broken = { ...memory, squads: [{ ...memory.squads[0]!, ships: ["no_such_ship"] }] };
    expect(squadsFromMemory(broken)).toBeNull();
    expect(squadsFromMemory(null)).toBeNull();
  });

  it("shares the player's squad with the wingmen choice", () => {
    expect(sharedPlayerSquad(squads, "fighters")).toMatchObject({ factionId: "terran_hegemony", ships: PLAN.ships, wingmen: "fighters" });
    expect(sharedPlayerSquad([{ ...squads[1]! }], "auto")).toBeNull();
  });
});
