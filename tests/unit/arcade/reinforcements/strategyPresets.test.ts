import { describe, expect, it } from "vitest";
import type { FactionId } from "../../../../src/config";
import { getShipDefinition } from "../../../../src/data/ShipDefinitions";
import {
  STRATEGY_IDS,
  STRATEGY_TUNING,
  buildReserve,
  strategyRotation,
  MAX_RESERVE_ENTRIES,
} from "../../../../src/arcade/reinforcements/strategyPresets";
import { toDeployOptions } from "../../../../src/arcade/reinforcements/shipOptions";

const FACTIONS: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

const meanCost = (
  faction: FactionId,
  strategy: (typeof STRATEGY_IDS)[number],
) => {
  const options = toDeployOptions(
    strategyRotation(faction, strategy, "skirmish"),
  );
  return options.reduce((sum, o) => sum + o.cost, 0) / options.length;
};

describe("strategy presets", () => {
  it("offers Balanced, Swarm, Aces and Heavy-Bombers", () => {
    expect(STRATEGY_IDS).toEqual(["balanced", "swarm", "aces", "heavy"]);
  });

  for (const faction of FACTIONS) {
    it(`${faction}: every strategy plans own-faction ships, no capitals in Skirmish`, () => {
      for (const strategy of STRATEGY_IDS) {
        const rotation = strategyRotation(faction, strategy, "skirmish");
        expect(rotation.length).toBeGreaterThan(0);
        for (const entry of rotation) {
          const def = getShipDefinition(entry.definitionId)!;
          expect(def.faction).toBe(faction);
          expect(def.role).not.toBe("capital");
          expect(def.baseStats.size).not.toBe("huge");
        }
      }
    });

    it(`${faction}: swarm fields cheaper ships than heavy`, () => {
      expect(meanCost(faction, "swarm")).toBeLessThan(
        meanCost(faction, "heavy"),
      );
    });

    it(`${faction}: heavy is mostly bombers and gunships; aces fly unique pilots`, () => {
      const heavy = toDeployOptions(
        strategyRotation(faction, "heavy", "skirmish"),
      );
      const heavyShare =
        heavy.filter((o) => o.role === "bomber" || o.role === "gunship")
          .length / heavy.length;
      expect(heavyShare).toBeGreaterThanOrEqual(0.5);
      const aces = toDeployOptions(
        strategyRotation(faction, "aces", "skirmish"),
      );
      expect(aces.some((o) => o.uniquePilotId !== null)).toBe(true);
    });
  }

  it("Epic heavy plans include a capital ship", () => {
    const rotation = toDeployOptions(
      strategyRotation("terran_hegemony", "heavy", "epic"),
    );
    expect(rotation.some((o) => o.categories.includes("capital"))).toBe(true);
  });

  it("a reserve covers the budget by repeating the rotation", () => {
    const reserve = buildReserve("void_corsairs", "balanced", 800, "skirmish");
    const total = toDeployOptions(reserve).reduce((s, o) => s + o.cost, 0);
    expect(total).toBeGreaterThanOrEqual(800);
    expect(reserve.length).toBeLessThanOrEqual(MAX_RESERVE_ENTRIES);
  });

  it("brings the planned number of support hulls in every non-Balanced rotation, none extra in Balanced", () => {
    const supports = (strategy: "balanced" | "swarm" | "aces" | "heavy") =>
      toDeployOptions(
        strategyRotation("terran_hegemony", strategy, "skirmish"),
      ).filter((o) => o.role === "support").length;
    for (const strategy of ["swarm", "aces", "heavy"] as const)
      expect(supports(strategy)).toBe(STRATEGY_TUNING.supportPerRotation);
    const previous = STRATEGY_TUNING.supportPerRotation;
    STRATEGY_TUNING.supportPerRotation = 0;
    try {
      for (const strategy of ["swarm", "aces", "heavy"] as const)
        expect(supports(strategy)).toBe(0);
    } finally {
      STRATEGY_TUNING.supportPerRotation = previous;
    }
  });

  it("is deterministic", () => {
    expect(buildReserve("ascendant_empire", "aces", 800, "skirmish")).toEqual(
      buildReserve("ascendant_empire", "aces", 800, "skirmish"),
    );
  });

  it("an empty budget plans an empty reserve", () => {
    expect(buildReserve("terran_hegemony", "swarm", 0, "skirmish")).toEqual([]);
  });
});
