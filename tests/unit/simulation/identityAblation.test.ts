/**
 * Identity ablation — a ship flown without its faction's identity levers
 * (src/data/factionIdentity.ts) leaves its identity cards in the hangar,
 * an ace faction's named pilot loses its ability, and it projects no aura.
 */

import { describe, it, expect } from "vitest";
import {
  strippedEquipment,
  equipWithoutIdentity,
} from "../../../src/simulation/identityAblation";
import {
  FACTION_IDENTITIES,
  isIdentityCard,
} from "../../../src/data/factionIdentity";
import { spawnArenaShip } from "../../../src/simulation/skill/ArenaShip";
import { BotPilot } from "../../../src/arcade/ai/BotPilot";
import { projectionScaleFor } from "../../../src/systems/aura/FactionAuras";
import { auraShipOf } from "../../../src/systems/aura/AllyAuraRepair";
import { getLoadoutById } from "../../../src/data/ShipLoadouts";

const POSE = { x: 100, y: 100, angle: 0 };

function arenaShip(definitionId: string, loadoutId: string, strip: boolean) {
  return spawnArenaShip({
    id: "s",
    side: "A",
    definitionId,
    pose: POSE,
    pilot: new BotPilot("average", { random: () => 0.5 }),
    loadoutId,
    ...(strip ? { withoutIdentity: true } : {}),
  });
}

describe("faction identity cards", () => {
  it("treats a card of an identity slot type as an identity card", () => {
    const corsairs = FACTION_IDENTITIES.void_corsairs;
    expect(isIdentityCard(corsairs, "hot_wired_engines", "illicit")).toBe(true);
  });

  it("does not treat another faction's identity slot as this faction's", () => {
    const hegemony = FACTION_IDENTITIES.terran_hegemony;
    expect(isIdentityCard(hegemony, "hot_wired_engines", "illicit")).toBe(
      false,
    );
  });
});

describe("strippedEquipment", () => {
  it("leaves the Confederation's rigger in the hangar", () => {
    const { upgradeIds } = strippedEquipment(
      "confed_falcon",
      "falcon_defender",
    );
    expect(upgradeIds).not.toContain("repair_astromech");
    expect(upgradeIds).toContain("shield_upgrade");
  });

  it("drops an ace faction's named pilot ability", () => {
    const { abilityId } = strippedEquipment(
      "terran_centurion",
      "centurion_assault",
    );
    expect(abilityId).toBeUndefined();
  });

  it("keeps a named pilot's ability when aces are not the faction's identity", () => {
    const { abilityId } = strippedEquipment(
      "ascendant_inquisitor",
      "inquisitor_hunter",
    );
    expect(abilityId).toBe("force_fury");
  });
});

describe("a ship spawned without its identity", () => {
  it("arms only the cards it kept", () => {
    const ship = arenaShip("confed_eagle", "eagle_striker", true);
    expect(ship.upgradeIds).not.toContain("proton_torpedo");
    expect(ship.upgradeIds).not.toContain("targeting_astromech");
  });

  it("flies its full quick build otherwise", () => {
    const ship = arenaShip("confed_eagle", "eagle_striker", false);
    expect(ship.upgradeIds).toEqual(getLoadoutById("eagle_striker")!.upgrades);
  });

  it("keeps the stat bonus of the cards it kept", () => {
    const target = {
      hull: 36,
      maxHull: 36,
      shields: 24,
      maxShields: 24,
      definitionId: "corsair_tender",
    };
    equipWithoutIdentity(target, "tender_supply_master");
    expect(target.maxShields).toBe(36);
  });

  it("projects no faction aura", () => {
    const ship = arenaShip("synth_relay_node", "relay_coordinator", true);
    const snapshot = auraShipOf({
      id: ship.id,
      definitionId: ship.definitionId,
      faction: "synthetic_collective",
      x: ship.x,
      y: ship.y,
      hull: ship.hull,
      shields: ship.shields,
      maxShields: ship.maxShields,
      loadoutId: ship.loadoutId,
      auraSuppressed: ship.auraSuppressed,
    });
    expect(projectionScaleFor(snapshot)).toBeNull();
  });
});
