/**
 * Spec: the Skirmish WINGMEN choice. Every non-custom type fills the squad
 * that flies with the player within the point budget and the squad rules
 * (faction roster, no capitals, at most MAX_SQUAD_SHIPS, unique pilots once,
 * reinforcement quotas), deterministically from a seed.
 */

import { describe, expect, it } from "vitest";
import type { FactionId } from "../../../../src/config";
import { assignQuickBuilds } from "../../../../src/arcade/systems/QuickBuildEquip";
import { rulesFor } from "../../../../src/arcade/reinforcements";
import { MAX_SQUAD_SHIPS, flownSquadCost } from "../../../../src/core/squadTypes";
import { SHIP_DEFINITIONS, getShipsByFaction } from "../../../../src/data/ShipDefinitions";
import { getEquippableLoadouts } from "../../../../src/data/ShipLoadouts";
import { uniquePilotOf } from "../../../../src/data/squadRules";
import {
  DEFAULT_WINGMEN,
  WINGMEN_TYPES,
  isWingmenType,
  planWingmen,
  wingmenSeed,
  type WingmenRequest,
  type WingmenType,
} from "../../../../src/systems/setup/wingmen";

const FACTIONS: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];
const AUTO_TYPES = WINGMEN_TYPES.filter((type) => type !== "custom");
const FIGHTER_ROLES = ["light_fighter", "heavy_fighter", "interceptor"];
const STRIKER_ROLES = ["gunship", "bomber"];
const FLYABLE = (faction: FactionId) =>
  getShipsByFaction(faction).filter((s) => s.role !== "capital" && s.baseStats.size !== "huge");

function requestFor(
  faction: FactionId,
  shipId: string,
  type: WingmenType,
  extra: Partial<WingmenRequest> = {},
): WingmenRequest {
  return {
    faction,
    shipId,
    loadoutId: null,
    type,
    gameMode: "arcade",
    pointLimit: 200,
    seed: 7,
    ...extra,
  };
}

function roleOf(id: string): string {
  return SHIP_DEFINITIONS[id]!.role;
}

describe("wingmen types", () => {
  it("offers auto, same role, fighters, strikers, support-heavy and custom", () => {
    expect(WINGMEN_TYPES).toEqual(["auto", "same_role", "fighters", "strikers", "support_heavy", "custom"]);
    expect(DEFAULT_WINGMEN).toBe("auto");
  });

  it("recognises only known ids", () => {
    expect(isWingmenType("strikers")).toBe(true);
    expect(isWingmenType("swarm")).toBe(false);
    expect(isWingmenType(3)).toBe(false);
  });
});

describe("planWingmen", () => {
  for (const faction of FACTIONS) {
    describe(faction, () => {
      for (const type of AUTO_TYPES) {
        it(`${type}: stays inside the roster, budget and squad rules for every flagship`, () => {
          for (const ship of FLYABLE(faction)) {
            const request = requestFor(faction, ship.id, type);
            const plan = planWingmen(request);
            const label = `${ship.id} / ${type}`;
            expect(plan.ships[0], label).toBe(ship.id);
            expect(plan.ships.length, label).toBeLessThanOrEqual(MAX_SQUAD_SHIPS);
            for (const id of plan.ships) {
              expect(SHIP_DEFINITIONS[id]!.faction, label).toBe(faction);
              expect(roleOf(id), label).not.toBe("capital");
              expect(SHIP_DEFINITIONS[id]!.baseStats.size, label).not.toBe("huge");
            }
            expect(plan.pointsUsed, label).toBe(flownSquadCost(plan.ships, plan.loadoutChoices));
            const own = flownSquadCost([ship.id]);
            expect(plan.pointsUsed, label).toBeLessThanOrEqual(Math.max(request.pointLimit, own));
            const builds = assignQuickBuilds(
              plan.ships,
              plan.ships.map((_, i) => plan.loadoutChoices[String(i)]),
            );
            const pilots = builds.map((id) => uniquePilotOf(id)).filter((p): p is string => p !== null);
            expect(new Set(pilots).size, `${label} unique pilots`).toBe(pilots.length);
          }
        });
      }

      it("same_role: every wingman flies the role of the flagship", () => {
        for (const ship of FLYABLE(faction)) {
          const plan = planWingmen(requestFor(faction, ship.id, "same_role"));
          for (const id of plan.ships.slice(1)) expect(roleOf(id), ship.id).toBe(ship.role);
        }
      });

      it("fighters: wingmen are light, heavy or interceptor", () => {
        for (const ship of FLYABLE(faction)) {
          const plan = planWingmen(requestFor(faction, ship.id, "fighters"));
          for (const id of plan.ships.slice(1)) expect(FIGHTER_ROLES, ship.id).toContain(roleOf(id));
        }
      });

      it("strikers: wingmen are gunships or bombers", () => {
        for (const ship of FLYABLE(faction)) {
          const plan = planWingmen(requestFor(faction, ship.id, "strikers"));
          for (const id of plan.ships.slice(1)) expect(STRIKER_ROLES, ship.id).toContain(roleOf(id));
        }
      });

      it("support_heavy: the first wingman is a support ship", () => {
        const flagship = FLYABLE(faction).find((s) => s.role === "heavy_fighter")!;
        const plan = planWingmen(requestFor(faction, flagship.id, "support_heavy"));
        expect(roleOf(plan.ships[1]!)).toBe("support");
      });

      it("auto: spreads the wingmen over several roles", () => {
        const flagship = FLYABLE(faction).find((s) => s.role === "heavy_fighter")!;
        const plan = planWingmen(requestFor(faction, flagship.id, "auto"));
        const roles = new Set(plan.ships.map(roleOf));
        expect(roles.size).toBeGreaterThanOrEqual(3);
      });
    });
  }

  it("is deterministic for a seed and differs between seeds", () => {
    const a = planWingmen(requestFor("terran_hegemony", "terran_gladius", "auto", { seed: 11 }));
    const b = planWingmen(requestFor("terran_hegemony", "terran_gladius", "auto", { seed: 11 }));
    expect(b).toEqual(a);
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
      planWingmen(requestFor("terran_hegemony", "terran_gladius", "auto", { seed })).ships.join(","),
    );
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it("keeps the flagship's chosen build and prices it as flown", () => {
    const build = getEquippableLoadouts("terran_gladius")[0]!;
    const plan = planWingmen(requestFor("terran_hegemony", "terran_gladius", "auto", { loadoutId: build.id }));
    expect(plan.loadoutChoices["0"]).toBe(build.id);
    expect(plan.pointsUsed).toBe(flownSquadCost(plan.ships, plan.loadoutChoices));
  });

  it("adds no wingmen when the flagship already uses the whole limit", () => {
    const own = flownSquadCost(["terran_gladius"]);
    const plan = planWingmen(requestFor("terran_hegemony", "terran_gladius", "auto", { pointLimit: own }));
    expect(plan.ships).toEqual(["terran_gladius"]);
    expect(plan.pointsUsed).toBe(own);
  });

  it("respects the reinforcement field cap and bomber quota", () => {
    const rules = rulesFor("skirmish");
    for (const faction of FACTIONS) {
      const flagship = FLYABLE(faction).find((s) => s.role === "bomber")!;
      const plan = planWingmen(
        requestFor(faction, flagship.id, "strikers", {
          pointLimit: 400,
          rules: { quotas: rules.quotas, fieldCapPoints: rules.fieldCapPoints },
        }),
      );
      expect(plan.pointsUsed, faction).toBeLessThanOrEqual(rules.fieldCapPoints);
      const bombers = plan.ships.filter((id) => roleOf(id) === "bomber").length;
      expect(bombers, faction).toBeLessThanOrEqual(5);
    }
  });

  it("limits aces (unique pilots) to the reinforcement quota", () => {
    const quotas = [{ category: "ace" as const, maxOnField: 1, maxPerMatch: 9 }];
    for (const faction of FACTIONS) {
      const flagship = FLYABLE(faction).find((s) => s.role === "heavy_fighter")!;
      const plan = planWingmen(requestFor(faction, flagship.id, "auto", { rules: { quotas, fieldCapPoints: 250 } }));
      const builds = assignQuickBuilds(plan.ships, plan.ships.map((_, i) => plan.loadoutChoices[String(i)]));
      const aces = builds.filter((id) => uniquePilotOf(id) !== null).length;
      expect(aces, faction).toBeLessThanOrEqual(1);
    }
  });

  it("custom: keeps the picked wingmen and drops the ones over the limit", () => {
    const wingmen = ["terran_gladius", "terran_gladius", "terran_gladius", "terran_gladius", "terran_gladius"];
    const limit = flownSquadCost(["terran_gladius", "terran_gladius", "terran_gladius"]);
    const plan = planWingmen(requestFor("terran_hegemony", "terran_gladius", "custom", { custom: wingmen, pointLimit: limit }));
    expect(plan.ships[0]).toBe("terran_gladius");
    expect(plan.pointsUsed).toBeLessThanOrEqual(limit);
    expect(plan.ships.length).toBeGreaterThan(1);
    expect(plan.ships.length).toBeLessThan(wingmen.length + 1);
  });

  it("custom without a list keeps the flagship alone", () => {
    const plan = planWingmen(requestFor("terran_hegemony", "terran_gladius", "custom"));
    expect(plan.ships).toEqual(["terran_gladius"]);
  });
});

describe("planWingmen across budgets", () => {
  it("never goes over 100, 150, 200 or 300 points for any faction and type", () => {
    for (const faction of FACTIONS) {
      const flagship = FLYABLE(faction).find((s) => s.role === "heavy_fighter")!;
      const own = flownSquadCost([flagship.id]);
      for (const type of AUTO_TYPES) {
        for (const pointLimit of [100, 150, 200, 300]) {
          const plan = planWingmen(requestFor(faction, flagship.id, type, { pointLimit, seed: pointLimit }));
          expect(plan.pointsUsed, `${faction} ${type} ${pointLimit}`).toBeLessThanOrEqual(Math.max(pointLimit, own));
        }
      }
    }
  });

  it("fills more of a larger budget than of a smaller one", () => {
    const small = planWingmen(requestFor("terran_hegemony", "terran_gladius", "auto", { pointLimit: 100 }));
    const large = planWingmen(requestFor("terran_hegemony", "terran_gladius", "auto", { pointLimit: 300 }));
    expect(large.pointsUsed).toBeGreaterThan(small.pointsUsed);
  });
});

describe("wingmenSeed", () => {
  it("is stable for the same inputs and changes with the reroll count", () => {
    const a = wingmenSeed("terran_hegemony", "terran_gladius", "auto", 200, 0);
    expect(wingmenSeed("terran_hegemony", "terran_gladius", "auto", 200, 0)).toBe(a);
    expect(wingmenSeed("terran_hegemony", "terran_gladius", "auto", 200, 1)).not.toBe(a);
    expect(wingmenSeed("terran_hegemony", "terran_gladius", "fighters", 200, 0)).not.toBe(a);
  });
});
