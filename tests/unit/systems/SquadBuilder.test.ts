import { describe, it, expect } from "vitest";
import {
  PILOT_CARDS,
  SQUAD_POINT_LIMITS,
  createSquad,
  addUnitToSquad,
  removeUnitFromSquad,
  equipUpgradeToUnit,
  removeUpgradeFromUnit,
  calculateUnitCost,
  calculateSquadCost,
  validateSquad,
  getPilotsForFaction,
  getPilotsForShip,
  getAvailableUpgradesForUnit,
  getUnitDetails,
  cloneSquad,
  exportSquad,
  importSquad,
  getSquadForScene,
  getPilotSceneConfig,
} from "../../../src/systems/SquadBuilder";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";

describe("SquadBuilder", () => {
  describe("PILOT_CARDS", () => {
    it("should have pilots for all 18 ships", () => {
      const shipIds = Object.keys(SHIP_DEFINITIONS);
      for (const shipId of shipIds) {
        const pilots = getPilotsForShip(shipId);
        expect(pilots.length).toBeGreaterThan(0);
      }
    });

    it("should have unique pilots with appropriate costs", () => {
      const uniquePilots = Object.values(PILOT_CARDS).filter((p) => p.isUnique);
      expect(uniquePilots.length).toBeGreaterThan(0);

      for (const pilot of uniquePilots) {
        // Unique pilots should have initiative >= 3 (support/utility pilots can be 3)
        expect(pilot.initiative).toBeGreaterThanOrEqual(3);
        // Unique pilots should have ability text
        expect(pilot.abilityText).toBeDefined();
      }
    });

    it("should have pilots for each faction", () => {
      const factions = [
        "terran_hegemony",
        "free_confederation",
        "synthetic_collective",
        "void_corsairs",
        "ascendant_empire",
      ] as const;
      for (const faction of factions) {
        const pilots = getPilotsForFaction(faction);
        expect(pilots.length).toBeGreaterThan(0);
      }
    });

    it("should have valid ship references", () => {
      for (const pilot of Object.values(PILOT_CARDS)) {
        expect(SHIP_DEFINITIONS[pilot.shipId]).toBeDefined();
      }
    });
  });

  describe("createSquad", () => {
    it("should create an empty squad with correct faction", () => {
      const squad = createSquad("Test Squad", "terran_hegemony");
      expect(squad.name).toBe("Test Squad");
      expect(squad.faction).toBe("terran_hegemony");
      expect(squad.units.length).toBe(0);
      expect(squad.format).toBe("standard");
    });

    it("should support different game formats", () => {
      const extended = createSquad("Extended", "void_corsairs", "extended");
      expect(extended.format).toBe("extended");

      const epic = createSquad("Epic", "synthetic_collective", "epic");
      expect(epic.format).toBe("epic");
    });
  });

  describe("addUnitToSquad", () => {
    it("should add a pilot to the squad", () => {
      const squad = createSquad("Test", "terran_hegemony");
      const result = addUnitToSquad(squad, "viper_cadet");

      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.units.length).toBe(1);
        expect(result.units[0]!.pilotId).toBe("viper_cadet");
        expect(result.units[0]!.shipId).toBe("terran_viper");
      }
    });

    it("should reject pilots from wrong faction", () => {
      const squad = createSquad("Test", "terran_hegemony");
      const result = addUnitToSquad(squad, "sparrow_rookie"); // Free Confederation pilot

      expect("error" in result).toBe(true);
    });

    it("should reject duplicate unique pilots", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const result1 = addUnitToSquad(squad, "whisper_null");
      expect("error" in result1).toBe(false);

      if (!("error" in result1)) {
        const result2 = addUnitToSquad(result1, "whisper_null");
        expect("error" in result2).toBe(true);
      }
    });

    it("should allow multiple generic pilots", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const result1 = addUnitToSquad(squad, "viper_cadet");
      expect("error" in result1).toBe(false);

      if (!("error" in result1)) {
        const result2 = addUnitToSquad(result1, "viper_cadet");
        expect("error" in result2).toBe(false);
        if (!("error" in result2)) {
          expect(result2.units.length).toBe(2);
        }
      }
    });
  });

  describe("removeUnitFromSquad", () => {
    it("should remove a unit from the squad", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const addResult = addUnitToSquad(squad, "viper_cadet");
      expect("error" in addResult).toBe(false);

      if (!("error" in addResult)) {
        const unitId = addResult.units[0]!.id;
        const removed = removeUnitFromSquad(addResult, unitId);
        expect(removed.units.length).toBe(0);
      }
    });
  });

  describe("calculateUnitCost", () => {
    it("charges the bare ship plus the pilot surcharge", () => {
      const squad = createSquad("Test", "terran_hegemony");
      const result = addUnitToSquad(squad, "viper_ace");

      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        const cost = calculateUnitCost(result.units[0]!);
        expect(cost).toBe(
          SHIP_DEFINITIONS.terran_viper!.baseStats.pointCost +
            PILOT_CARDS.viper_ace!.pointCost,
        );
      }
    });

    it("charges a rookie exactly the bare ship price", () => {
      const squad = createSquad("Test", "terran_hegemony");
      const result = addUnitToSquad(squad, "viper_cadet");

      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(calculateUnitCost(result.units[0]!)).toBe(
          SHIP_DEFINITIONS.terran_viper!.baseStats.pointCost,
        );
      }
    });
  });

  describe("calculateSquadCost", () => {
    it("should sum all unit costs", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const result1 = addUnitToSquad(squad, "viper_cadet");
      if (!("error" in result1)) {
        const result2 = addUnitToSquad(result1, "gladius_pilot");
        if (!("error" in result2)) {
          const cost = calculateSquadCost(result2);
          const expected =
            SHIP_DEFINITIONS.terran_viper!.baseStats.pointCost +
            SHIP_DEFINITIONS.terran_gladius!.baseStats.pointCost +
            PILOT_CARDS.gladius_pilot!.pointCost;
          expect(cost).toBe(expected);
        }
      }
    });
  });

  describe("validateSquad", () => {
    it("should validate empty squad with warning", () => {
      const squad = createSquad("Test", "terran_hegemony");
      const validation = validateSquad(squad);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings.some((w) => w.type === "no_ships")).toBe(true);
    });

    it("should detect over-points", () => {
      let squad = createSquad("Test", "terran_hegemony");
      // Add enough expensive ships to exceed 200 points
      for (let i = 0; i < 10; i++) {
        const result = addUnitToSquad(squad, "whisper_null");
        if (!("error" in result)) {
          squad = result;
        } else {
          const result2 = addUnitToSquad(squad, "commander_striker");
          if (!("error" in result2)) {
            squad = result2;
          }
        }
      }

      const validation = validateSquad(squad);
      if (validation.totalPoints > SQUAD_POINT_LIMITS.standard) {
        expect(validation.errors.some((e) => e.type === "over_points")).toBe(
          true,
        );
      }
    });
  });

  describe("exportSquad / importSquad", () => {
    it("should export and import a squad", () => {
      let squad = createSquad("Export Test", "free_confederation");
      const addResult = addUnitToSquad(squad, "sparrow_rookie");

      if (!("error" in addResult)) {
        const exported = exportSquad(addResult);
        expect(typeof exported).toBe("string");

        const imported = importSquad(exported, "Imported Squad");
        expect("error" in imported).toBe(false);

        if (!("error" in imported)) {
          expect(imported.faction).toBe("free_confederation");
          expect(imported.units.length).toBe(1);
          expect(imported.units[0]!.pilotId).toBe("sparrow_rookie");
        }
      }
    });

    it("should return error for invalid (non-base64) data", () => {
      const result = importSquad("!!!invalid-not-base64!!!", "Bad Import");
      expect("error" in result).toBe(true);
    });

    it("should return error for malformed JSON after base64 decode", () => {
      // btoa('not valid json {')
      const badData = btoa("not valid json {");
      const result = importSquad(badData, "Bad Import");
      expect("error" in result).toBe(true);
    });

    it("should preserve upgrades on import", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r1 = addUnitToSquad(squad, "viper_cadet");
      if ("error" in r1) throw new Error(r1.error);

      // Import with explicit squad unit having upgrades (build it manually via unit override)
      const squadWithUpgrade = {
        ...r1,
        units: [{ ...r1.units[0]!, equippedUpgrades: ["hull_upgrade"] }],
      };
      const exported = exportSquad(squadWithUpgrade);
      const imported = importSquad(exported, "With Upgrades");

      if ("error" in imported) throw new Error(imported.error);
      expect(imported.units[0]!.equippedUpgrades).toContain("hull_upgrade");
    });

    it("should return error when imported unit pilot does not match squad faction", () => {
      // Manually construct a squad JSON with a pilot from the wrong faction
      // terran_hegemony squad but using sparrow_rookie (free_confederation pilot)
      const badData = btoa(
        JSON.stringify({
          v: 1,
          f: "terran_hegemony",
          m: "standard",
          u: [{ p: "sparrow_rookie", g: [] }],
        }),
      );
      const result = importSquad(badData, "Bad Faction");
      expect("error" in result).toBe(true);
    });

    it("should return error for unsupported format version", () => {
      const futureVersionData = btoa(
        JSON.stringify({
          v: 999,
          f: "terran_hegemony",
          m: "standard",
          u: [],
        }),
      );
      const result = importSquad(futureVersionData, "Future Version");
      expect("error" in result).toBe(true);
    });

    it("rejects a code whose units are not a list of pilot ids", () => {
      const shapes = [
        { v: 1, f: "terran_hegemony", m: "standard", u: "nope" },
        { v: 1, f: "terran_hegemony", m: "standard", u: [{ p: 7 }] },
        { v: 1, f: "terran_hegemony", m: "standard", u: [{ p: "x", g: [1] }] },
        { v: 1, f: 3, m: "standard", u: [] },
        { v: 1, f: "terran_hegemony", m: "no_such_format", u: [] },
      ];
      for (const shape of shapes) {
        const result = importSquad(btoa(JSON.stringify(shape)), "Bad shape");
        expect("error" in result, JSON.stringify(shape)).toBe(true);
      }
    });

    it("rejects a code carrying an absurd number of units", () => {
      const units = Array.from({ length: 500 }, () => ({
        p: "viper_cadet",
        g: [],
      }));
      const code = btoa(
        JSON.stringify({ v: 1, f: "terran_hegemony", m: "standard", u: units }),
      );
      expect("error" in importSquad(code, "Huge")).toBe(true);
    });

    it("accepts a code pasted with surrounding whitespace", () => {
      const squad = createSquad("Test", "terran_hegemony");
      const added = addUnitToSquad(squad, "viper_cadet");
      if ("error" in added) throw new Error(added.error);
      const result = importSquad(`  ${exportSquad(added)}\n`, "Padded");
      expect("error" in result).toBe(false);
    });
  });

  describe("epic format validation", () => {
    it("should reject capital ship in standard squad", () => {
      const squad = createSquad("Test", "terran_hegemony", "standard");
      const result = addUnitToSquad(squad, "imperator_crew"); // huge capital ship
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("epic format");
      }
    });

    it("should allow capital ship in epic squad", () => {
      const squad = createSquad("Epic Test", "terran_hegemony", "epic");
      const result = addUnitToSquad(squad, "imperator_crew");
      expect("error" in result).toBe(false);
    });

    it("should reject capital ship in extended squad", () => {
      const squad = createSquad("Test", "terran_hegemony", "extended");
      const result = addUnitToSquad(squad, "grand_admiral_nero");
      expect("error" in result).toBe(true);
    });

    it("should not restrict non-capital ships in standard squad", () => {
      const squad = createSquad("Test", "terran_hegemony", "standard");
      const result = addUnitToSquad(squad, "viper_cadet"); // small fighter, fine
      expect("error" in result).toBe(false);
    });

    it("validateSquad should flag capital ships in non-epic squads", () => {
      // Bypass addUnitToSquad check by directly constructing a squad unit
      const fakeSquad = {
        id: "fake",
        name: "Fake",
        faction: "terran_hegemony" as const,
        format: "standard" as const,
        units: [
          {
            id: "u1",
            pilotId: "imperator_crew",
            shipId: "terran_imperator",
            equippedUpgrades: [],
          },
        ],
        createdAt: 0,
        updatedAt: 0,
      };
      const validation = validateSquad(fakeSquad);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.type === "invalid_format")).toBe(
        true,
      );
    });

    it("validateSquad should pass capital ships in epic squad", () => {
      const squad = createSquad("Epic", "terran_hegemony", "epic");
      const result = addUnitToSquad(squad, "imperator_crew");
      if ("error" in result) throw new Error(result.error);
      const validation = validateSquad(result);
      expect(validation.errors.some((e) => e.type === "invalid_format")).toBe(
        false,
      );
    });
  });

  describe("getSquadForScene", () => {
    it("should return one config per unit", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r1 = addUnitToSquad(squad, "viper_cadet");
      if ("error" in r1) throw new Error(r1.error);
      const r2 = addUnitToSquad(r1, "viper_ace");
      if ("error" in r2) throw new Error(r2.error);

      const configs = getSquadForScene(r2);
      expect(configs).toHaveLength(2);
    });

    it("should populate pilotSkill from PILOT_CARDS initiative", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r = addUnitToSquad(squad, "whisper_null"); // initiative 6
      if ("error" in r) throw new Error(r.error);

      const [config] = getSquadForScene(r);
      expect(config!.pilotSkill).toBe(PILOT_CARDS["whisper_null"]!.initiative);
      expect(config!.pilotSkill).toBe(6);
    });

    it("should set pilotName from PILOT_CARDS", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r = addUnitToSquad(squad, "whisper_null");
      if ("error" in r) throw new Error(r.error);

      const [config] = getSquadForScene(r);
      expect(config!.pilotName).toBe("Whisper Null");
    });

    it("should sort configs by descending pilotSkill", () => {
      let squad = createSquad("Test", "terran_hegemony");
      let s = squad;
      for (const id of ["viper_cadet", "viper_ace", "whisper_null"]) {
        const r = addUnitToSquad(s, id);
        if ("error" in r) throw new Error(r.error);
        s = r;
      }

      const configs = getSquadForScene(s);
      for (let i = 1; i < configs.length; i++) {
        expect(configs[i]!.pilotSkill).toBeLessThanOrEqual(
          configs[i - 1]!.pilotSkill,
        );
      }
    });

    it("should include equippedUpgrades", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r = addUnitToSquad(squad, "viper_cadet");
      if ("error" in r) throw new Error(r.error);

      const unit = r.units[0]!;
      // Manually set upgrades for testing (unit is immutable so we rebuild)
      const squadWithUpgrade = {
        ...r,
        units: [{ ...unit, equippedUpgrades: ["stealth_device"] }],
      };
      const [config] = getSquadForScene(squadWithUpgrade);
      expect(config!.equippedUpgrades).toContain("stealth_device");
    });

    it("should return empty array for squad with no units", () => {
      const empty = createSquad("Empty", "void_corsairs");
      expect(getSquadForScene(empty)).toHaveLength(0);
    });

    it("should include faction from the squad", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r = addUnitToSquad(squad, "viper_cadet");
      if ("error" in r) throw new Error(r.error);

      const [config] = getSquadForScene(r);
      expect(config!.faction).toBe("terran_hegemony");
    });
  });

  describe("getPilotSceneConfig", () => {
    it("should return config for a valid pilotId", () => {
      const config = getPilotSceneConfig("viper_cadet");
      expect(config).not.toBeNull();
      expect(config!.pilotId).toBe("viper_cadet");
      expect(config!.shipId).toBe("terran_viper");
      expect(config!.pilotSkill).toBe(1);
    });

    it("should return null for unknown pilotId", () => {
      const config = getPilotSceneConfig("nonexistent_pilot_xyz");
      expect(config).toBeNull();
    });

    it("should include provided upgrades in config", () => {
      const config = getPilotSceneConfig("viper_ace", ["hull_upgrade"]);
      expect(config!.equippedUpgrades).toContain("hull_upgrade");
    });

    it("should default to empty upgrades when none provided", () => {
      const config = getPilotSceneConfig("viper_cadet");
      expect(config!.equippedUpgrades).toHaveLength(0);
    });

    it("should reflect isUnique from PILOT_CARDS", () => {
      const ace = getPilotSceneConfig("whisper_null"); // unique pilot
      expect(ace!.isUnique).toBe(true);

      const cadet = getPilotSceneConfig("viper_cadet"); // non-unique
      expect(cadet!.isUnique).toBe(false);
    });
  });

  describe("cloneSquad", () => {
    it("should create a new squad object (not the same reference)", () => {
      const squad = createSquad("Test", "terran_hegemony");
      const clone = cloneSquad(squad);
      expect(clone).not.toBe(squad); // different object identity
    });

    it("should preserve faction and format", () => {
      const squad = createSquad("Test", "void_corsairs", "epic");
      const clone = cloneSquad(squad);
      expect(clone.faction).toBe("void_corsairs");
      expect(clone.format).toBe("epic");
    });

    it('should append "(Copy)" to name when no new name given', () => {
      const squad = createSquad("Alpha Squad", "terran_hegemony");
      const clone = cloneSquad(squad);
      expect(clone.name).toBe("Alpha Squad (Copy)");
    });

    it("should use provided name when given", () => {
      const squad = createSquad("Alpha", "terran_hegemony");
      const clone = cloneSquad(squad, "Beta");
      expect(clone.name).toBe("Beta");
    });

    it("should clone units with new ids", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r = addUnitToSquad(squad, "viper_cadet");
      if ("error" in r) throw new Error(r.error);
      const clone = cloneSquad(r);
      expect(clone.units.length).toBe(1);
      expect(clone.units[0]!.id).not.toBe(r.units[0]!.id);
      expect(clone.units[0]!.pilotId).toBe("viper_cadet");
    });

    it("should not mutate original squad when clone is modified", () => {
      const squad = createSquad("Test", "terran_hegemony");
      const clone = cloneSquad(squad, "Clone");
      expect(squad.name).toBe("Test");
      expect(clone.name).toBe("Clone");
    });
  });

  describe("equipUpgradeToUnit", () => {
    it("should equip a valid upgrade to a unit", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r = addUnitToSquad(squad, "viper_cadet");
      if ("error" in r) throw new Error(r.error);
      const unitId = r.units[0]!.id;

      const result = equipUpgradeToUnit(
        r,
        unitId,
        "hull_upgrade",
        SHIP_DEFINITIONS,
      );
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.units[0]!.equippedUpgrades).toContain("hull_upgrade");
      }
    });

    it("should return error for unknown upgrade id", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r = addUnitToSquad(squad, "viper_cadet");
      if ("error" in r) throw new Error(r.error);
      const unitId = r.units[0]!.id;

      const result = equipUpgradeToUnit(
        r,
        unitId,
        "nonexistent_upgrade_xyz",
        SHIP_DEFINITIONS,
      );
      expect("error" in result).toBe(true);
    });

    it("should return error for unknown unit id", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r = addUnitToSquad(squad, "viper_cadet");
      if ("error" in r) throw new Error(r.error);

      const result = equipUpgradeToUnit(
        r,
        "nonexistent_unit_id",
        "hull_upgrade",
        SHIP_DEFINITIONS,
      );
      expect("error" in result).toBe(true);
    });

    it("should return error when upgrade cannot fit (wrong size)", () => {
      let squad = createSquad("Test", "free_confederation");
      const r = addUnitToSquad(squad, "sparrow_rookie"); // small ship
      if ("error" in r) throw new Error(r.error);
      const unitId = r.units[0]!.id;

      // veteran_gunner requires medium or large
      const result = equipUpgradeToUnit(
        r,
        unitId,
        "veteran_gunner",
        SHIP_DEFINITIONS,
      );
      expect("error" in result).toBe(true);
    });
  });

  describe("removeUpgradeFromUnit", () => {
    it("should remove an equipped upgrade from a unit", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r = addUnitToSquad(squad, "viper_cadet");
      if ("error" in r) throw new Error(r.error);
      const unitId = r.units[0]!.id;

      const equipped = equipUpgradeToUnit(
        r,
        unitId,
        "hull_upgrade",
        SHIP_DEFINITIONS,
      );
      if ("error" in equipped) throw new Error(equipped.error);
      expect(equipped.units[0]!.equippedUpgrades).toContain("hull_upgrade");

      const removed = removeUpgradeFromUnit(equipped, unitId, "hull_upgrade");
      expect(removed.units[0]!.equippedUpgrades).not.toContain("hull_upgrade");
    });

    it("should return unchanged squad for unknown unit id", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r = addUnitToSquad(squad, "viper_cadet");
      if ("error" in r) throw new Error(r.error);

      const result = removeUpgradeFromUnit(
        r,
        "unknown_unit_id",
        "hull_upgrade",
      );
      expect(result).toBe(r); // same reference (no change)
    });

    it("should not affect other upgrades when removing one", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r = addUnitToSquad(squad, "viper_cadet");
      if ("error" in r) throw new Error(r.error);
      const unitId = r.units[0]!.id;

      // Equip hull first, then predator (talent)
      const eq1 = equipUpgradeToUnit(
        r,
        unitId,
        "hull_upgrade",
        SHIP_DEFINITIONS,
      );
      if ("error" in eq1) throw new Error(eq1.error);
      const eq2 = equipUpgradeToUnit(eq1, unitId, "predator", SHIP_DEFINITIONS);
      if ("error" in eq2) throw new Error(eq2.error);
      expect(eq2.units[0]!.equippedUpgrades.length).toBe(2);

      const removed = removeUpgradeFromUnit(eq2, unitId, "hull_upgrade");
      expect(removed.units[0]!.equippedUpgrades).not.toContain("hull_upgrade");
      expect(removed.units[0]!.equippedUpgrades).toContain("predator");
    });
  });

  describe("getAvailableUpgradesForUnit", () => {
    it("should return upgrades for a valid unit", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r = addUnitToSquad(squad, "viper_cadet");
      if ("error" in r) throw new Error(r.error);
      const unit = r.units[0]!;

      const upgrades = getAvailableUpgradesForUnit(unit, r, SHIP_DEFINITIONS);
      expect(upgrades.length).toBeGreaterThan(0);
    });

    it("should return empty array for invalid unit (bad pilotId)", () => {
      const fakeUnit = {
        id: "u1",
        pilotId: "nonexistent_pilot",
        shipId: "terran_viper",
        equippedUpgrades: [],
      };
      const squad = createSquad("Test", "terran_hegemony");
      const upgrades = getAvailableUpgradesForUnit(
        fakeUnit,
        squad,
        SHIP_DEFINITIONS,
      );
      expect(upgrades).toHaveLength(0);
    });

    it("should exclude upgrades whose slot is already filled", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r = addUnitToSquad(squad, "viper_cadet");
      if ("error" in r) throw new Error(r.error);
      const unit = r.units[0]!;
      const unitId = unit.id;

      // Equip hull_upgrade (uses modification slot)
      const equipped = equipUpgradeToUnit(
        r,
        unitId,
        "hull_upgrade",
        SHIP_DEFINITIONS,
      );
      if ("error" in equipped) throw new Error(equipped.error);
      const equippedUnit = equipped.units[0]!;

      const beforeUpgrades = getAvailableUpgradesForUnit(
        unit,
        r,
        SHIP_DEFINITIONS,
      );
      const afterUpgrades = getAvailableUpgradesForUnit(
        equippedUnit,
        equipped,
        SHIP_DEFINITIONS,
      );

      // After equipping a modification, fewer modification slots are available
      expect(afterUpgrades.length).toBeLessThanOrEqual(beforeUpgrades.length);
    });
  });

  describe("getUnitDetails", () => {
    it("should return details for a valid unit", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r = addUnitToSquad(squad, "viper_cadet");
      if ("error" in r) throw new Error(r.error);
      const unit = r.units[0]!;

      const details = getUnitDetails(unit, SHIP_DEFINITIONS);
      expect(details).not.toBeNull();
      expect(details!.pilot.id).toBe("viper_cadet");
      expect(details!.ship.id).toBe("terran_viper");
    });

    it("should return null for invalid unit (bad pilotId)", () => {
      const fakeUnit = {
        id: "u1",
        pilotId: "nonexistent_pilot",
        shipId: "terran_viper",
        equippedUpgrades: [],
      };
      const details = getUnitDetails(fakeUnit, SHIP_DEFINITIONS);
      expect(details).toBeNull();
    });

    it("should include totalPointCost", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r = addUnitToSquad(squad, "viper_cadet");
      if ("error" in r) throw new Error(r.error);
      const unit = r.units[0]!;

      const details = getUnitDetails(unit, SHIP_DEFINITIONS)!;
      expect(typeof details.totalPointCost).toBe("number");
      expect(details.totalPointCost).toBeGreaterThan(0);
    });

    it("should include availableSlots and usedSlots", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r = addUnitToSquad(squad, "viper_cadet");
      if ("error" in r) throw new Error(r.error);
      const unit = r.units[0]!;

      const details = getUnitDetails(unit, SHIP_DEFINITIONS)!;
      expect(Array.isArray(details.availableSlots)).toBe(true);
      expect(Array.isArray(details.usedSlots)).toBe(true);
      expect(details.usedSlots).toHaveLength(0); // no upgrades equipped
    });

    it("should reflect equipped upgrades in usedSlots", () => {
      let squad = createSquad("Test", "terran_hegemony");
      const r = addUnitToSquad(squad, "viper_cadet");
      if ("error" in r) throw new Error(r.error);
      const unitId = r.units[0]!.id;

      const equipped = equipUpgradeToUnit(
        r,
        unitId,
        "hull_upgrade",
        SHIP_DEFINITIONS,
      );
      if ("error" in equipped) throw new Error(equipped.error);
      const equippedUnit = equipped.units[0]!;

      const details = getUnitDetails(equippedUnit, SHIP_DEFINITIONS)!;
      expect(details.usedSlots).toContain("modification");
      expect(details.upgrades.length).toBe(1);
    });
  });
});
