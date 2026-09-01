import { describe, it, expect } from "vitest";
import {
  SHIP_DEFINITIONS,
  SHIP_DIALS,
  getShipsByFaction,
  getShipDefinition,
} from "../../../src/data/ShipDefinitions";

const ALL_FACTIONS = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
] as const;

describe("ShipDefinitions", () => {
  describe("SHIP_DEFINITIONS", () => {
    it("every ship has all required fields", () => {
      for (const [id, def] of Object.entries(SHIP_DEFINITIONS)) {
        expect(def.id, `${id}.id`).toBe(id);
        expect(def.name, `${id}.name`).toBeTruthy();
        expect(def.faction, `${id}.faction`).toBeTruthy();
        expect(def.role, `${id}.role`).toBeTruthy();
        expect(def.spriteKey, `${id}.spriteKey`).toBeTruthy();
        expect(def.baseStats.hull, `${id}.hull`).toBeGreaterThan(0);
        expect(def.baseStats.attack, `${id}.attack`).toBeGreaterThan(0);
        expect(def.baseStats.pointCost, `${id}.pointCost`).toBeGreaterThan(0);
      }
    });

    it("all ship IDs are unique", () => {
      const ids = Object.values(SHIP_DEFINITIONS).map((d) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("synth_gestalt is defined with correct stats", () => {
      const def = SHIP_DEFINITIONS["synth_gestalt"];
      expect(def).toBeDefined();
      expect(def!.name).toBe("Gestalt Colossus");
      expect(def!.faction).toBe("synthetic_collective");
      expect(def!.role).toBe("capital");
      expect(def!.baseStats.size).toBe("huge");
      expect(def!.baseStats.hull).toBe(48);
      expect(def!.baseStats.shields).toBe(36);
      expect(def!.baseStats.armor).toBe(1);
      expect(def!.baseStats.attack).toBe(6);
      expect(def!.baseStats.agility).toBe(0);
      expect(def!.baseStats.pointCost).toBe(145);
    });

    it('all huge ships have role "capital"', () => {
      const hugeShips = Object.values(SHIP_DEFINITIONS).filter(
        (d) => d.baseStats.size === "huge",
      );
      expect(hugeShips.length).toBeGreaterThan(0);
      for (const ship of hugeShips) {
        expect(ship.role, `${ship.id} should be capital`).toBe("capital");
      }
    });

    it("each faction has ships defined", () => {
      for (const faction of ALL_FACTIONS) {
        const ships = getShipsByFaction(faction);
        expect(ships.length, `${faction} should have ships`).toBeGreaterThan(0);
      }
    });
  });

  describe("SHIP_DIALS", () => {
    it("has a maneuver dial for every ship in SHIP_DEFINITIONS", () => {
      for (const id of Object.keys(SHIP_DEFINITIONS)) {
        const dial = SHIP_DIALS[id];
        expect(dial, `SHIP_DIALS missing entry for ${id}`).toBeDefined();
        expect(
          dial!.length,
          `${id} dial should have maneuvers`,
        ).toBeGreaterThan(0);
      }
    });

    it("synth_gestalt dial contains only low-speed capital maneuvers", () => {
      const dial = SHIP_DIALS["synth_gestalt"]!;
      for (const maneuver of dial) {
        expect(maneuver.speed).toBeLessThanOrEqual(2);
      }
    });
  });

  describe("getShipsByFaction", () => {
    it("includes synth_gestalt in synthetic_collective ships", () => {
      const ships = getShipsByFaction("synthetic_collective");
      const gestalt = ships.find((s) => s.id === "synth_gestalt");
      expect(gestalt).toBeDefined();
    });

    it("does not include synth_gestalt for other factions", () => {
      for (const faction of ALL_FACTIONS.filter(
        (f) => f !== "synthetic_collective",
      )) {
        const ships = getShipsByFaction(faction);
        expect(ships.find((s) => s.id === "synth_gestalt")).toBeUndefined();
      }
    });
  });

  describe("getShipDefinition", () => {
    it("returns the definition for a known ship", () => {
      const def = getShipDefinition("synth_gestalt");
      expect(def).toBeDefined();
      expect(def!.id).toBe("synth_gestalt");
    });

    it("returns undefined for an unknown ship ID", () => {
      expect(getShipDefinition("ghost_ship_404")).toBeUndefined();
    });
  });
});
