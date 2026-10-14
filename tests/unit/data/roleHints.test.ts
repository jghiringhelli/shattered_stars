/**
 * Spec: role / synergy hints (P2-1) — every pilot ability, upgrade card,
 * quick build, survival relic and campaign armory mod gets a one-line role
 * ("Flanker — strikes from behind") and a "best with" line, derived from
 * the effect data (never authored per card).
 */

import { describe, it, expect } from "vitest";
import {
  armoryHint,
  pilotAbilityHint,
  quickBuildHint,
  relicHint,
  shipHint,
  upgradeHint,
  type RoleHint,
} from "../../../src/data/roleHints";
import { relicCard } from "../../../src/ui/survival/choiceViewModels";
import { UPGRADE_DEFINITIONS } from "../../../src/systems/UpgradeSystem";
import { PILOT_ABILITIES } from "../../../src/systems/PilotAbilities";
import { PILOT_ABILITY_REALTIME } from "../../../src/data/pilotAbilityEffects";
import { SHIP_LOADOUTS } from "../../../src/data/ShipLoadouts";
import {
  getShipDefinition,
  SHIP_DEFINITIONS,
} from "../../../src/data/ShipDefinitions";
import { ALL_RELICS } from "../../../src/data/survival/relicCatalog";
import { ARMORY_MODS } from "../../../src/data/campaign/armory";

/** A tooltip line must fit one row of the widest card. */
const MAX_LINE = 90;

function oneLine(hint: RoleHint): void {
  for (const line of [hint.role, hint.bestWith]) {
    expect(line.length).toBeGreaterThan(0);
    expect(line.length).toBeLessThanOrEqual(MAX_LINE);
    expect(line).not.toContain("\n");
  }
  expect(hint.role).toContain(" — ");
}

describe("upgradeHint", () => {
  it("covers every upgrade card with a one-line role and best-with", () => {
    for (const card of Object.values(UPGRADE_DEFINITIONS))
      oneLine(upgradeHint(card));
  });

  it("reads the playstyle from the effect knobs", () => {
    expect(upgradeHint(UPGRADE_DEFINITIONS.predator!).playstyle).toBe("hunter");
    expect(upgradeHint(UPGRADE_DEFINITIONS.daredevil!).playstyle).toBe(
      "interceptor",
    );
  });

  it("missiles read as bombers and turrets as gunners", () => {
    const bySlot = (slot: string) =>
      Object.values(UPGRADE_DEFINITIONS).find(
        (c) => c.slotType === slot && c.weapon,
      )!;
    expect(upgradeHint(bySlot("missile")).playstyle).toBe("bomber");
    expect(upgradeHint(bySlot("turret")).playstyle).toBe("gunner");
  });

  it("never pairs a card with itself", () => {
    for (const card of Object.values(UPGRADE_DEFINITIONS))
      expect(upgradeHint(card).pairsWith).not.toContain(card.name);
  });

  it("names up to two partner cards from the catalogue", () => {
    const names = new Set(
      Object.values(UPGRADE_DEFINITIONS).map((c) => c.name),
    );
    const hint = upgradeHint(UPGRADE_DEFINITIONS.predator!);
    expect(hint.pairsWith.length).toBeGreaterThan(0);
    expect(hint.pairsWith.length).toBeLessThanOrEqual(2);
    for (const name of hint.pairsWith) expect(names.has(name)).toBe(true);
  });

  it("is deterministic", () => {
    const card = UPGRADE_DEFINITIONS.marksman!;
    expect(upgradeHint(card)).toEqual(upgradeHint(card));
  });
});

describe("pilotAbilityHint", () => {
  it("covers every pilot ability (catalogue and real-time table)", () => {
    const ids = new Set([
      ...Object.keys(PILOT_ABILITIES),
      ...Object.keys(PILOT_ABILITY_REALTIME),
    ]);
    for (const id of ids) oneLine(pilotAbilityHint(id));
  });

  it("reads ambush as a flanker and healing aura as support", () => {
    expect(pilotAbilityHint("ambush").role).toBe(
      "Flanker — strikes from behind",
    );
    expect(pilotAbilityHint("healing_aura").playstyle).toBe("support");
    expect(pilotAbilityHint("afterburners").playstyle).toBe("interceptor");
  });
});

describe("quickBuildHint", () => {
  it("covers every quick build, led by the ship's role", () => {
    for (const loadout of Object.values(SHIP_LOADOUTS).flat()) {
      const hint = quickBuildHint(loadout);
      oneLine(hint);
      const role = getShipDefinition(loadout.shipId)?.role ?? "";
      const label = role.replace("_", " ");
      expect(hint.role.toLowerCase().startsWith(label)).toBe(true);
    }
  });
});

describe("shipHint", () => {
  it("covers every ship, led by its hull role", () => {
    for (const def of Object.values(SHIP_DEFINITIONS)) {
      const hint = shipHint(def.id);
      oneLine(hint);
      expect(
        hint.role.toLowerCase().startsWith(def.role.replace("_", " ")),
      ).toBe(true);
    }
  });

  it("reads the ship's signature (first) quick build", () => {
    const loadout = Object.values(SHIP_LOADOUTS).flat()[0]!;
    expect(shipHint(loadout.shipId).playstyle).toBe(
      quickBuildHint(loadout).playstyle,
    );
  });
});

describe("relicHint", () => {
  it("covers every relic and pairs only with other relics", () => {
    const names = new Set(ALL_RELICS.map((r) => r.name));
    for (const relic of ALL_RELICS) {
      const hint = relicHint(relic);
      oneLine(hint);
      expect(hint.pairsWith).not.toContain(relic.name);
      for (const name of hint.pairsWith) expect(names.has(name)).toBe(true);
    }
  });

  it("rides on the relic choice card as its hover tooltip", () => {
    const relic = ALL_RELICS[0]!;
    const hint = relicHint(relic);
    expect(relicCard(relic, []).tip).toMatchObject({
      role: hint.role,
      bestWith: hint.bestWith,
      playstyle: hint.playstyle,
    });
  });
});

describe("armoryHint", () => {
  it("covers every armory mod", () => {
    for (const mod of ARMORY_MODS) oneLine(armoryHint(mod));
  });

  it("reads hull mods as tank and weapon mods as striker", () => {
    const mod = (id: string) => ARMORY_MODS.find((m) => m.id === id)!;
    expect(armoryHint(mod("reinforced_bulkheads")).playstyle).toBe("tank");
    expect(armoryHint(mod("overcharged_cannons")).playstyle).toBe("striker");
  });

  it("pairs a defensive mod with an offensive one in another slot", () => {
    const mod = (id: string) => ARMORY_MODS.find((m) => m.id === id)!;
    const [pair] = armoryHint(mod("reinforced_bulkheads")).pairsWith;
    const partner = ARMORY_MODS.find((m) => m.name === pair)!;
    expect(partner.slot).not.toBe("hull");
    expect(armoryHint(partner).playstyle).toBe("striker");
  });
});

describe("quick build role line", () => {
  it("names both the hull and the style when they differ", () => {
    for (const loadout of Object.values(SHIP_LOADOUTS).flat()) {
      const hint = quickBuildHint(loadout);
      const role = getShipDefinition(loadout.shipId)?.role ?? "";
      const label = role.replace("_", " ");
      if (hint.playstyle !== role) {
        expect(hint.role.toLowerCase()).not.toBe(label);
        expect(hint.role).toMatch(/ · .+ — /);
      }
    }
  });
});
