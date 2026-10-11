/**
 * SelfRepair — which of a ship's own cards gets credit for the repairs its
 * modifier sheet performs (the sheet itself is a merged number, so the
 * provenance is read back from the fitted upgrade cards).
 *
 * The credited kind picks the visual: an astromech sends one drone, a
 * mechanic crew two, plain shield regeneration only shimmers. Pure.
 */

import { UPGRADE_CATALOG } from "../../../data/upgrades";
import type { RepairSourceKind } from "./RepairEvents";

/** Credited source per repaired channel. */
export interface SelfRepairProfile {
  readonly shield: RepairSourceKind;
  readonly hull: RepairSourceKind;
}

/** A ship with no repair card: its own regeneration gets the credit. */
const DEFAULT_PROFILE: SelfRepairProfile = {
  shield: "self_regen",
  hull: "self_regen",
};

/** Credit priority when several cards repair the same channel. */
const SOURCE_PRIORITY: readonly RepairSourceKind[] = [
  "mechanic_crew",
  "astromech",
  "self_regen",
];

/**
 * The source kind a single card is credited as.
 * @param slotType - The card's slot.
 * @returns mechanic_crew for crew, astromech for droids, else self_regen.
 */
function kindForSlot(slotType: string): RepairSourceKind {
  if (slotType === "crew") return "mechanic_crew";
  if (slotType === "astromech") return "astromech";
  return "self_regen";
}

/**
 * Pick the higher-priority of two credited kinds.
 * @param a - One kind.
 * @param b - Another kind.
 * @returns Whichever ranks first in {@link SOURCE_PRIORITY}.
 */
function preferred(a: RepairSourceKind, b: RepairSourceKind): RepairSourceKind {
  return SOURCE_PRIORITY.indexOf(a) <= SOURCE_PRIORITY.indexOf(b) ? a : b;
}

/**
 * Which fitted card is credited for a ship's own shield and hull repairs.
 *
 * @param upgradeIds - The ship's equipped upgrade ids (unknown ids ignored).
 * @returns The credited source kind per channel.
 */
export function selfRepairProfile(
  upgradeIds: ReadonlyArray<string>,
): SelfRepairProfile {
  let shield = DEFAULT_PROFILE.shield;
  let hull = DEFAULT_PROFILE.hull;
  for (const id of upgradeIds) {
    const card = UPGRADE_CATALOG[id];
    if (!card?.realtime) continue;
    const kind = kindForSlot(card.slotType);
    if ((card.realtime.shieldRegenPerSecond ?? 0) > 0) {
      shield = preferred(shield, kind);
    }
    if ((card.realtime.hullRepairPerSecond ?? 0) > 0) {
      hull = preferred(hull, kind);
    }
  }
  return { shield, hull };
}
