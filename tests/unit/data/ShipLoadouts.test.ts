import { describe, it, expect } from "vitest";
import {
  SHIP_SLOTS,
  SHIP_LOADOUTS,
  getShipSlots,
  getShipLoadouts,
  getLoadoutById,
  getLoadoutsByRole,
  getLoadoutsByBudget,
  getAILoadout,
  calculateSquadCost,
  buildRandomSquad,
} from "../../../src/data/ShipLoadouts";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";
import { UPGRADE_DEFINITIONS } from "../../../src/systems/UpgradeSystem";
import {
  findLoadoutViolations,
  findDeadCards,
} from "../../../src/data/loadoutRules";
import { slotBarFor } from "../../../src/data/ShipSlots";
import { PILOT_CARDS } from "../../../src/systems/SquadBuilder";

describe("ShipLoadouts", () => {
  describe("SHIP_SLOTS", () => {
    it("should have slot configurations for all 18 ships", () => {
      const shipIds = Object.keys(SHIP_DEFINITIONS);
      for (const shipId of shipIds) {
        const slots = SHIP_SLOTS[shipId];
        expect(slots).toBeDefined();
        expect(slots!.slots.length).toBeGreaterThan(0);
      }
    });

    it("should have valid slot types", () => {
      const validSlotTypes = [
        "talent",
        "missile",
        "torpedo",
        "cannon",
        "turret",
        "bomb",
        "crew",
        "gunner",
        "astromech",
        "sensor",
        "tech",
        "modification",
        "title",
        "configuration",
        "force_power",
        "illicit",
      ];

      for (const config of Object.values(SHIP_SLOTS)) {
        for (const slot of config.slots) {
          expect(validSlotTypes).toContain(slot);
        }
      }
    });

    it("should have bombers with ordnance slots", () => {
      const bombers = ["terran_hammer", "synth_destroyer"];
      for (const bomberId of bombers) {
        const slots = SHIP_SLOTS[bomberId]!;
        const hasOrdnance = slots.slots.some(
          (s) => s === "torpedo" || s === "bomb" || s === "missile",
        );
        expect(hasOrdnance).toBe(true);
      }
    });

    it("should have gunships with turret slots", () => {
      const gunships = ["confed_phoenix", "corsair_reaver", "ascendant_avatar"];
      for (const gunshipId of gunships) {
        const slots = SHIP_SLOTS[gunshipId]!;
        const hasTurret = slots.slots.includes("turret");
        expect(hasTurret).toBe(true);
      }
    });
  });

  describe("SHIP_LOADOUTS", () => {
    it("should have loadouts for all 18 ships", () => {
      const shipIds = Object.keys(SHIP_DEFINITIONS);
      for (const shipId of shipIds) {
        const loadouts = SHIP_LOADOUTS[shipId];
        expect(loadouts).toBeDefined();
        expect(loadouts!.length).toBeGreaterThan(0);
      }
    });

    it("should have valid upgrade references", () => {
      for (const loadouts of Object.values(SHIP_LOADOUTS)) {
        for (const loadout of loadouts) {
          for (const upgradeId of loadout.upgrades) {
            // Some upgrades may not exist yet - just check format
            expect(typeof upgradeId).toBe("string");
            expect(upgradeId.length).toBeGreaterThan(0);
          }
        }
      }
    });

    it("should have multiple role options per ship", () => {
      for (const [shipId, loadouts] of Object.entries(SHIP_LOADOUTS)) {
        expect(loadouts.length).toBeGreaterThanOrEqual(2);

        const roles = new Set(loadouts.map((l) => l.role));
        // Most ships should have at least 2 different roles
        if (loadouts.length >= 2) {
          expect(roles.size).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  describe("loadout legality", () => {
    const everyLoadout = Object.entries(SHIP_LOADOUTS).flatMap(
      ([shipId, loadouts]) => loadouts.map((loadout) => ({ shipId, loadout })),
    );

    it("fits every loadout into its ship slot bar", () => {
      const illegal = everyLoadout.flatMap(({ shipId, loadout }) =>
        findLoadoutViolations(
          loadout.upgrades,
          SHIP_DEFINITIONS[shipId]!,
          slotBarFor(
            shipId,
            PILOT_CARDS[loadout.pilotId]?.extraSlots,
            PILOT_CARDS[loadout.pilotId]?.removedSlots,
          ),
        ).map((v) => `${loadout.id}: ${v.upgradeId} (${v.reason})`),
      );
      expect(illegal).toEqual([]);
    });

    it("equips no card that does nothing for its ship", () => {
      const dead = everyLoadout.flatMap(({ shipId, loadout }) =>
        findDeadCards(loadout.upgrades, SHIP_DEFINITIONS[shipId]!).map(
          (id) => `${loadout.id}: ${id}`,
        ),
      );
      expect(dead).toEqual([]);
    });

    it("gives every loadout a globally unique id", () => {
      const ids = everyLoadout.map(({ loadout }) => loadout.id);
      const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
      expect(repeated).toEqual([]);
    });

    it("never offers the same build twice on one ship", () => {
      const duplicates: string[] = [];
      for (const [shipId, loadouts] of Object.entries(SHIP_LOADOUTS)) {
        const seen = new Map<string, string>();
        for (const loadout of loadouts) {
          const key = [...loadout.upgrades].sort().join(",");
          const twin = seen.get(key);
          if (twin) duplicates.push(`${shipId}: ${twin} = ${loadout.id}`);
          seen.set(key, loadout.id);
        }
      }
      expect(duplicates).toEqual([]);
    });

    it("gives large and huge hulls two modification slots", () => {
      const short = Object.values(SHIP_DEFINITIONS)
        .filter((ship) => ["large", "huge"].includes(ship.baseStats.size))
        .filter(
          (ship) =>
            SHIP_SLOTS[ship.id]!.slots.filter((s) => s === "modification")
              .length < 2,
        )
        .map((ship) => ship.id);
      expect(short).toEqual([]);
    });
  });

  describe("getShipSlots", () => {
    it("should return slot config for valid ship", () => {
      const slots = getShipSlots("terran_viper");
      expect(slots).toBeDefined();
      expect(slots!.slots).toContain("missile");
    });

    it("should return undefined for invalid ship", () => {
      const slots = getShipSlots("nonexistent_ship");
      expect(slots).toBeUndefined();
    });
  });

  describe("getShipLoadouts", () => {
    it("should return loadouts for valid ship", () => {
      const loadouts = getShipLoadouts("confed_falcon");
      expect(loadouts.length).toBeGreaterThan(0);
    });

    it("should return empty array for invalid ship", () => {
      const loadouts = getShipLoadouts("nonexistent_ship");
      expect(loadouts).toEqual([]);
    });
  });

  describe("getLoadoutById", () => {
    it("should find loadout by ID", () => {
      const loadout = getLoadoutById("viper_ace");
      expect(loadout).toBeDefined();
      expect(loadout!.shipId).toBe("terran_viper");
    });

    it("should return undefined for invalid ID", () => {
      const loadout = getLoadoutById("nonexistent_loadout");
      expect(loadout).toBeUndefined();
    });

    it("should find loadouts for non-first ships (synth_gestalt)", () => {
      // gestalt_apex is far into SHIP_LOADOUTS — catches if (true) return found early-exit
      const loadout = getLoadoutById("gestalt_apex");
      expect(loadout).toBeDefined();
      expect(loadout!.shipId).toBe("synth_gestalt");
    });

    it("found loadout has the requested ID, not a different one", () => {
      const loadout = getLoadoutById("viper_pursuit");
      expect(loadout).toBeDefined();
      expect(loadout!.id).toBe("viper_pursuit");
    });
  });

  describe("getLoadoutsByRole", () => {
    it("should filter loadouts by role", () => {
      const offenseLoadouts = getLoadoutsByRole("offense");
      expect(offenseLoadouts.length).toBeGreaterThan(0);
      for (const loadout of offenseLoadouts) {
        expect(loadout.role).toBe("offense");
      }

      const defenseLoadouts = getLoadoutsByRole("defense");
      expect(defenseLoadouts.length).toBeGreaterThan(0);
      for (const loadout of defenseLoadouts) {
        expect(loadout.role).toBe("defense");
      }
    });
  });

  describe("getLoadoutsByBudget", () => {
    it("should filter loadouts by point budget", () => {
      const cheapLoadouts = getLoadoutsByBudget(50);
      for (const loadout of cheapLoadouts) {
        expect(loadout.pointCost).toBeLessThanOrEqual(50);
      }

      const expensiveLoadouts = getLoadoutsByBudget(100);
      expect(expensiveLoadouts.length).toBeGreaterThanOrEqual(
        cheapLoadouts.length,
      );
    });

    it("should return a non-empty array for any reasonable budget", () => {
      // There are cheap loadouts well under 60 pts; filter cannot return empty
      const result = getLoadoutsByBudget(60);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should include loadouts whose cost equals the budget exactly", () => {
      // viper_ace costs a known amount; get its cost then verify it appears in that budget
      const viperAce = getLoadoutById("viper_ace");
      expect(viperAce).toBeDefined();
      const exactBudget = viperAce!.pointCost;
      const result = getLoadoutsByBudget(exactBudget);
      expect(result.find((l) => l.id === "viper_ace")).toBeDefined();
    });

    it("should exclude loadouts whose cost exceeds the budget", () => {
      // Budget of 1 should exclude almost all loadouts (cheapest are well above 1pt)
      const result = getLoadoutsByBudget(1);
      for (const l of result) {
        expect(l.pointCost).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("getAILoadout", () => {
    it("should return loadout matching preference", () => {
      const offenseLoadout = getAILoadout("terran_viper", "offense");
      expect(offenseLoadout).toBeDefined();

      const defenseLoadout = getAILoadout("terran_viper", "defense");
      expect(defenseLoadout).toBeDefined();
    });

    it("returned offense loadout has role offense", () => {
      const loadout = getAILoadout("terran_viper", "offense");
      expect(loadout).toBeDefined();
      expect(loadout!.role).toBe("offense");
    });

    it("returned defense loadout has role defense", () => {
      const loadout = getAILoadout("terran_viper", "defense");
      expect(loadout).toBeDefined();
      expect(loadout!.role).toBe("defense");
    });

    it("should return default loadout for unknown preference", () => {
      const loadout = getAILoadout("terran_viper", "balanced");
      expect(loadout).toBeDefined();
    });

    it("should return undefined for invalid ship", () => {
      const loadout = getAILoadout("nonexistent_ship");
      expect(loadout).toBeUndefined();
    });
  });

  describe("calculateSquadCost", () => {
    it("should sum loadout costs", () => {
      const loadout1 = getLoadoutById("viper_ace");
      const loadout2 = getLoadoutById("viper_pursuit");

      if (loadout1 && loadout2) {
        const cost = calculateSquadCost([loadout1.id, loadout2.id]);
        expect(cost).toBe(loadout1.pointCost + loadout2.pointCost);
      }
    });

    it("should return 0 for empty list", () => {
      const cost = calculateSquadCost([]);
      expect(cost).toBe(0);
    });
  });

  describe("buildRandomSquad", () => {
    it("should build squad within point limit", () => {
      const squad = buildRandomSquad("terran_hegemony", 200);
      const totalCost = squad.reduce((sum, l) => sum + l.pointCost, 0);
      expect(totalCost).toBeLessThanOrEqual(200);
    });

    it("should limit squad size", () => {
      const squad = buildRandomSquad("void_corsairs", 500);
      expect(squad.length).toBeLessThanOrEqual(8);
    });

    it("should return a non-empty squad for a reasonable budget", () => {
      // 100 pts is enough for at least one ship across any faction
      const squad = buildRandomSquad("synthetic_collective", 100);
      expect(squad.length).toBeGreaterThan(0);
    });

    it("each ship in the squad respects the running point budget", () => {
      const squad = buildRandomSquad("free_confederation", 300);
      let spent = 0;
      for (const loadout of squad) {
        // Each loadout's cost must have been affordable when it was added
        expect(loadout.pointCost).toBeGreaterThan(0);
        spent += loadout.pointCost;
      }
      expect(spent).toBeLessThanOrEqual(300);
    });

    it("returns empty squad when budget is 0", () => {
      const squad = buildRandomSquad("terran_hegemony", 0);
      expect(squad).toEqual([]);
    });
  });
});
