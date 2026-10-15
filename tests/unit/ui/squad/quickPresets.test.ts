import { describe, expect, it } from "vitest";
import { getShipDefinition, getShipsByFaction } from "../../../../src/data/ShipDefinitions";
import {
  QUICK_PRESETS,
  presetShip,
} from "../../../../src/ui/squad/quickPresets";
import type { FactionId } from "../../../../src/config";

const FACTIONS: FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

describe("quick-start presets", () => {
  it("offers BALANCED, ACES and SWARM", () => {
    expect(QUICK_PRESETS.map((p) => p.id)).toEqual(["balanced", "aces", "swarm"]);
  });

  it("picks a flyable non-capital ship of the faction for every preset", () => {
    for (const faction of FACTIONS) {
      for (const preset of QUICK_PRESETS) {
        const id = presetShip(faction, preset);
        const def = id ? getShipDefinition(id) : undefined;
        expect(def, `${faction}/${preset.id}`).toBeDefined();
        expect(def?.faction).toBe(faction);
        expect(def?.role).not.toBe("capital");
      }
    }
  });

  it("picks the preset's role when the faction has it", () => {
    const aces = QUICK_PRESETS.find((p) => p.id === "aces")!;
    const id = presetShip("terran_hegemony", aces)!;
    expect(getShipDefinition(id)?.role).toBe("interceptor");
  });

  it("picks the cheapest ship of the role", () => {
    const swarm = QUICK_PRESETS.find((p) => p.id === "swarm")!;
    const id = presetShip("terran_hegemony", swarm)!;
    const cheapestLight = Math.min(
      ...getShipsByFaction("terran_hegemony")
        .filter((s) => s.role === "light_fighter")
        .map((s) => s.baseStats.pointCost),
    );
    expect(getShipDefinition(id)?.baseStats.pointCost).toBe(cheapestLight);
  });
});
