/**
 * Ship slot bars — which upgrade categories each ship can carry.
 *
 * The single source of truth for slots (docs/specs/upgrades-and-slots.md).
 * Same-chassis variants across factions differ here as much as in their stats:
 * the slot bar decides which loadouts a hull can field. Every pre-built loadout
 * must fit its ship's bar (tested in ShipLoadouts.test.ts).
 *
 * Structural rule: large and huge hulls carry two modification slots.
 */

import type { UpgradeSlotType } from "../core/upgradeTypes";

/** A ship's slot bar and its base ordnance charges. */
export interface ShipSlotConfig {
  readonly slots: readonly UpgradeSlotType[];
  /** Base charges for ordnance (turn-based AI ships). */
  readonly charges?: number;
}

/** Slot bar for every ship, keyed by ship definition id. */
export const SHIP_SLOTS: Readonly<Record<string, ShipSlotConfig>> = {
  // Terran Hegemony
  terran_stiletto: { slots: ["talent", "modification"] },
  terran_raptor: { slots: ["talent", "missile", "sensor", "modification"] },
  terran_viper: {
    slots: ["talent", "missile", "modification", "configuration"],
  },
  terran_centurion: { slots: ["talent", "cannon", "sensor", "modification"] },
  terran_gladius: { slots: ["talent", "torpedo", "sensor", "modification"] },
  terran_legionnaire: {
    slots: ["talent", "missile", "sensor", "modification"],
  },
  terran_praetorian: {
    slots: ["talent", "cannon", "crew", "modification", "configuration"],
  },
  terran_hammer: {
    slots: [
      "torpedo",
      "bomb",
      "bomb",
      "gunner",
      "crew",
      "modification",
      "configuration",
    ],
    charges: 4,
  },
  terran_javelin: {
    slots: ["torpedo", "torpedo", "sensor", "modification"],
    charges: 3,
  },
  terran_thunderbolt: {
    slots: [
      "torpedo",
      "torpedo",
      "bomb",
      "bomb",
      "gunner",
      "crew",
      "modification",
    ],
    charges: 5,
  },
  terran_bastion: {
    slots: ["turret", "cannon", "missile", "gunner", "crew", "modification"],
    charges: 2,
  },
  terran_bulwark: {
    slots: [
      "turret",
      "turret",
      "cannon",
      "missile",
      "gunner",
      "crew",
      "modification",
      "modification",
    ],
    charges: 3,
  },
  terran_vindicator: {
    slots: ["turret", "cannon", "missile", "gunner", "modification"],
    charges: 2,
  },
  terran_guardian: {
    slots: ["crew", "crew", "sensor", "tech", "modification"],
  },
  terran_harbinger: { slots: ["talent", "sensor", "tech", "modification"] },
  terran_sentinel: {
    slots: ["talent", "crew", "crew", "sensor", "tech", "modification"],
  },
  terran_consul: {
    slots: [
      "crew",
      "crew",
      "crew",
      "sensor",
      "sensor",
      "tech",
      "modification",
      "modification",
      "title",
    ],
  },
  terran_dominator: {
    slots: [
      "turret",
      "cannon",
      "gunner",
      "crew",
      "crew",
      "crew",
      "sensor",
      "modification",
      "modification",
      "title",
    ],
    charges: 3,
  },
  terran_executor: {
    slots: [
      "turret",
      "turret",
      "cannon",
      "gunner",
      "crew",
      "modification",
      "modification",
      "title",
    ],
    charges: 3,
  },
  terran_imperator: {
    slots: [
      "turret",
      "turret",
      "cannon",
      "cannon",
      "gunner",
      "crew",
      "crew",
      "sensor",
      "modification",
      "modification",
      "title",
    ],
    charges: 4,
  },

  // Free Confederation
  confed_finch: { slots: ["sensor", "modification"] },
  confed_sparrow: { slots: ["talent", "missile", "modification"] },
  confed_wasp: { slots: ["talent", "modification"] },
  confed_kestrel: {
    slots: ["talent", "missile", "modification", "configuration"],
  },
  confed_owl: {
    slots: ["talent", "tech", "sensor", "modification", "configuration"],
  },
  confed_raven: {
    slots: ["talent", "tech", "missile", "modification", "configuration"],
  },
  confed_condor: { slots: ["talent", "cannon", "crew", "modification"] },
  confed_eagle: {
    slots: ["talent", "torpedo", "sensor", "astromech", "modification"],
  },
  confed_falcon: {
    slots: ["talent", "torpedo", "astromech", "modification", "configuration"],
  },
  confed_hawk: { slots: ["talent", "cannon", "missile", "modification"] },
  confed_albatross: {
    slots: [
      "torpedo",
      "torpedo",
      "bomb",
      "gunner",
      "crew",
      "modification",
      "modification",
    ],
    charges: 4,
  },
  confed_pelican: {
    slots: ["torpedo", "bomb", "gunner", "modification"],
    charges: 3,
  },
  confed_harrier: {
    slots: ["turret", "cannon", "missile", "gunner", "modification"],
    charges: 2,
  },
  confed_phoenix: {
    slots: [
      "talent",
      "turret",
      "cannon",
      "missile",
      "crew",
      "gunner",
      "modification",
    ],
    charges: 2,
  },
  confed_thunderbird: {
    slots: [
      "turret",
      "turret",
      "cannon",
      "missile",
      "gunner",
      "crew",
      "modification",
      "modification",
    ],
    charges: 3,
  },
  confed_crane: { slots: ["crew", "crew", "sensor", "tech", "modification"] },
  confed_heron: {
    slots: [
      "crew",
      "crew",
      "sensor",
      "tech",
      "modification",
      "modification",
      "title",
    ],
  },
  confed_defiance: {
    slots: [
      "turret",
      "turret",
      "cannon",
      "gunner",
      "crew",
      "modification",
      "modification",
      "title",
    ],
    charges: 3,
  },
  confed_independence: {
    slots: [
      "turret",
      "gunner",
      "crew",
      "crew",
      "crew",
      "sensor",
      "modification",
      "modification",
      "title",
    ],
    charges: 2,
  },
  confed_liberty: {
    slots: [
      "turret",
      "cannon",
      "gunner",
      "crew",
      "crew",
      "sensor",
      "modification",
      "modification",
      "title",
    ],
    charges: 3,
  },

  // Synthetic Collective
  synth_drone: { slots: ["cannon", "modification", "configuration"] },
  synth_heavy_drone: { slots: ["cannon", "sensor", "modification"] },
  synth_scout_drone: { slots: ["sensor", "modification"] },
  synth_interceptor_drone: {
    slots: ["cannon", "modification", "configuration"],
  },
  synth_stalker: {
    slots: ["cannon", "sensor", "tech", "modification", "configuration"],
  },
  synth_hunter: {
    slots: ["cannon", "sensor", "tech", "modification", "configuration"],
  },
  synth_predator: { slots: ["cannon", "missile", "sensor", "modification"] },
  synth_ravager: { slots: ["cannon", "cannon", "sensor", "modification"] },
  synth_annihilator: {
    slots: ["torpedo", "torpedo", "cannon", "cannon", "sensor", "modification"],
    charges: 5,
  },
  synth_bomber_drone: {
    slots: ["torpedo", "bomb", "modification"],
    charges: 2,
  },
  synth_destroyer: {
    slots: ["torpedo", "torpedo", "cannon", "sensor", "tech", "modification"],
    charges: 4,
  },
  synth_devastator: {
    slots: ["turret", "cannon", "cannon", "missile", "sensor", "modification"],
    charges: 2,
  },
  synth_eradicator: {
    slots: [
      "turret",
      "turret",
      "cannon",
      "missile",
      "sensor",
      "modification",
      "modification",
    ],
    charges: 3,
  },
  synth_carrier: {
    slots: [
      "crew",
      "crew",
      "gunner",
      "turret",
      "sensor",
      "tech",
      "modification",
      "modification",
      "title",
    ],
    charges: 3,
  },
  synth_relay_node: { slots: ["sensor", "sensor", "tech", "modification"] },
  synth_repair_node: { slots: ["crew", "sensor", "tech", "modification"] },
  synth_conduit: {
    slots: [
      "turret",
      "cannon",
      "sensor",
      "sensor",
      "tech",
      "modification",
      "modification",
      "title",
    ],
    charges: 3,
  },
  synth_gestalt: {
    slots: [
      "turret",
      "turret",
      "cannon",
      "cannon",
      "gunner",
      "sensor",
      "modification",
      "modification",
      "title",
    ],
    charges: 5,
  },
  synth_nexus: {
    slots: [
      "turret",
      "cannon",
      "crew",
      "crew",
      "sensor",
      "sensor",
      "tech",
      "modification",
      "modification",
      "title",
    ],
    charges: 4,
  },
  synth_overmind: {
    slots: [
      "turret",
      "crew",
      "crew",
      "crew",
      "sensor",
      "tech",
      "modification",
      "modification",
      "title",
    ],
    charges: 3,
  },
  synth_terminus: {
    slots: [
      "turret",
      "turret",
      "cannon",
      "cannon",
      "sensor",
      "modification",
      "modification",
      "title",
    ],
    charges: 4,
  },

  // Void Corsairs — raiders and smugglers carry an illicit slot (black-market
  // gear: a strong effect paid for with a drawback).
  corsair_venom: { slots: ["talent", "modification", "illicit"] },
  corsair_blade: {
    slots: ["talent", "missile", "modification", "configuration", "illicit"],
  },
  corsair_fang: {
    slots: ["talent", "modification", "configuration", "illicit"],
  },
  corsair_phantom: {
    slots: ["talent", "tech", "modification", "configuration"],
  },
  corsair_shadow: {
    slots: ["talent", "tech", "cannon", "modification", "configuration"],
  },
  corsair_specter: {
    slots: ["talent", "tech", "crew", "modification", "configuration"],
  },
  corsair_talon: { slots: ["talent", "missile", "modification"] },
  corsair_cutlass: {
    slots: ["talent", "cannon", "missile", "modification", "illicit"],
  },
  corsair_marauder: {
    slots: ["talent", "cannon", "missile", "gunner", "modification", "illicit"],
    charges: 2,
  },
  corsair_saber: {
    slots: ["talent", "cannon", "modification", "configuration"],
  },
  corsair_scimitar: { slots: ["talent", "cannon", "torpedo", "modification"] },
  corsair_bomber: {
    slots: ["torpedo", "bomb", "gunner", "modification", "illicit"],
    charges: 3,
  },
  corsair_torpedo_boat: {
    slots: ["torpedo", "torpedo", "modification"],
    charges: 3,
  },
  corsair_pillager: {
    slots: [
      "turret",
      "turret",
      "cannon",
      "missile",
      "gunner",
      "crew",
      "modification",
      "modification",
    ],
    charges: 3,
  },
  corsair_ravager: {
    slots: [
      "turret",
      "cannon",
      "cannon",
      "missile",
      "gunner",
      "modification",
      "modification",
    ],
    charges: 2,
  },
  corsair_reaver: {
    slots: [
      "talent",
      "turret",
      "turret",
      "cannon",
      "missile",
      "gunner",
      "crew",
      "modification",
    ],
    charges: 3,
  },
  corsair_tender: {
    slots: [
      "crew",
      "crew",
      "sensor",
      "tech",
      "modification",
      "modification",
      "illicit",
    ],
  },
  corsair_dreadnought: {
    slots: [
      "turret",
      "turret",
      "cannon",
      "cannon",
      "gunner",
      "crew",
      "crew",
      "modification",
      "modification",
      "title",
    ],
    charges: 4,
  },
  corsair_frigate: {
    slots: [
      "turret",
      "cannon",
      "gunner",
      "crew",
      "modification",
      "modification",
      "title",
    ],
    charges: 2,
  },
  corsair_galleon: {
    slots: [
      "turret",
      "cannon",
      "gunner",
      "crew",
      "crew",
      "modification",
      "modification",
      "title",
    ],
    charges: 3,
  },

  // Ascendant Empire
  ascendant_cherub: { slots: ["talent", "modification"] },
  ascendant_herald: { slots: ["talent", "sensor", "modification"] },
  ascendant_seraph: {
    slots: ["talent", "talent", "sensor", "modification", "configuration"],
  },
  ascendant_virtue: {
    slots: ["talent", "missile", "modification", "configuration"],
  },
  ascendant_crusader: {
    slots: ["talent", "cannon", "cannon", "sensor", "modification"],
  },
  ascendant_inquisitor: { slots: ["talent", "cannon", "tech", "modification"] },
  ascendant_paladin: {
    slots: ["talent", "cannon", "crew", "modification", "configuration"],
  },
  ascendant_templar: {
    slots: ["talent", "torpedo", "cannon", "sensor", "modification"],
  },
  ascendant_purifier: {
    slots: [
      "torpedo",
      "torpedo",
      "bomb",
      "gunner",
      "crew",
      "modification",
      "modification",
    ],
    charges: 4,
  },
  ascendant_smiter: {
    slots: ["torpedo", "bomb", "gunner", "modification"],
    charges: 3,
  },
  ascendant_avatar: {
    slots: [
      "talent",
      "turret",
      "cannon",
      "cannon",
      "missile",
      "crew",
      "gunner",
      "modification",
      "modification",
      "title",
    ],
    charges: 3,
  },
  ascendant_judgment: {
    slots: [
      "turret",
      "turret",
      "cannon",
      "missile",
      "gunner",
      "crew",
      "modification",
      "modification",
    ],
    charges: 3,
  },
  ascendant_wrath: {
    slots: ["turret", "cannon", "cannon", "missile", "gunner", "modification"],
    charges: 2,
  },
  ascendant_acolyte: { slots: ["crew", "sensor", "tech", "modification"] },
  ascendant_oracle: {
    slots: [
      "talent",
      "crew",
      "crew",
      "sensor",
      "tech",
      "modification",
      "title",
    ],
  },
  ascendant_prophet: {
    slots: ["crew", "crew", "crew", "sensor", "tech", "modification", "title"],
  },
  ascendant_bastion: {
    slots: [
      "turret",
      "turret",
      "cannon",
      "gunner",
      "crew",
      "modification",
      "modification",
      "title",
    ],
    charges: 3,
  },
  ascendant_divine: {
    slots: [
      "turret",
      "turret",
      "cannon",
      "cannon",
      "gunner",
      "crew",
      "crew",
      "sensor",
      "modification",
      "modification",
      "title",
    ],
    charges: 5,
  },
  ascendant_glory: {
    slots: [
      "turret",
      "turret",
      "cannon",
      "gunner",
      "crew",
      "crew",
      "modification",
      "modification",
      "title",
    ],
    charges: 4,
  },
  ascendant_sanctum: {
    slots: [
      "turret",
      "cannon",
      "crew",
      "crew",
      "crew",
      "sensor",
      "modification",
      "modification",
      "title",
    ],
    charges: 3,
  },
};

/**
 * Get the slot bar for a ship.
 *
 * @param shipId - Ship definition id.
 * @returns The ship's slot configuration, or undefined for an unknown ship.
 */
export function getShipSlots(shipId: string): ShipSlotConfig | undefined {
  return SHIP_SLOTS[shipId];
}

/**
 * A ship's slot bar as flown by a particular pilot: the ship's own slots plus
 * any the pilot card adds, minus any it removes.
 *
 * @param shipId - Ship definition id.
 * @param extraSlots - Slots the pilot card adds.
 * @param removedSlots - Slots the pilot card removes.
 * @returns The slots the pilot can fill (empty for an unknown ship).
 */
export function slotBarFor(
  shipId: string,
  extraSlots: ReadonlyArray<UpgradeSlotType> = [],
  removedSlots: ReadonlyArray<UpgradeSlotType> = [],
): UpgradeSlotType[] {
  const slots = [...(SHIP_SLOTS[shipId]?.slots ?? []), ...extraSlots];
  for (const removed of removedSlots) {
    const index = slots.indexOf(removed);
    if (index !== -1) slots.splice(index, 1);
  }
  return slots;
}
