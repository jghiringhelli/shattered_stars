/**
 * Loadout legality — does a build actually fit on its ship?
 *
 * A loadout is legal when every upgrade card takes one free slot of its own
 * category from the ship's slot bar (a second copy needs a second slot) and
 * meets the card's faction, size, role and uniqueness requirements.
 */

import type { ShipDefinition } from "../core/types";
import type { UpgradeSlotType } from "../core/upgradeTypes";
import { UPGRADE_DEFINITIONS, canEquipUpgrade } from "../systems/UpgradeSystem";

/** Why one card in a loadout does not fit. */
export interface LoadoutViolation {
  readonly upgradeId: string;
  readonly reason: string;
}

/**
 * List every card in a loadout that does not fit the ship.
 *
 * @param upgradeIds - The loadout's upgrade ids, in order.
 * @param ship - The ship the loadout is built on.
 * @param slots - The ship's slot bar.
 * @returns One violation per card that does not fit (empty when legal).
 */
export function findLoadoutViolations(
  upgradeIds: ReadonlyArray<string>,
  ship: ShipDefinition,
  slots: ReadonlyArray<UpgradeSlotType>,
): LoadoutViolation[] {
  const freeSlots = [...slots];
  const placed: string[] = [];
  const violations: LoadoutViolation[] = [];
  for (const upgradeId of upgradeIds) {
    const card = UPGRADE_DEFINITIONS[upgradeId];
    if (!card) {
      violations.push({ upgradeId, reason: "Unknown upgrade" });
      continue;
    }
    const check = canEquipUpgrade(card, {
      size: ship.baseStats.size,
      role: ship.role,
      faction: ship.faction,
      availableSlots: freeSlots,
      equippedUpgrades: placed,
    });
    if (!check.valid) {
      violations.push({ upgradeId, reason: check.reason ?? "Does not fit" });
      continue;
    }
    freeSlots.splice(freeSlots.indexOf(card.slotType), 1);
    placed.push(upgradeId);
  }
  return violations;
}

/** Real-time knobs that only matter when the ship carries ordnance. */
const ORDNANCE_KNOBS = new Set([
  "ordnanceCooldownMultiplier",
  "ordnanceBonusCharges",
  "homingTurnBonus",
]);

/** Real-time knobs that only matter when the ship carries a turret. */
const TURRET_KNOBS = new Set(["turretCooldownMultiplier"]);

/** Slot types whose cards are arcade ordnance. */
const ORDNANCE_SLOT_TYPES = new Set(["missile", "torpedo", "bomb"]);

/** Roles that project their faction aura on their own, without crew. */
const SELF_PROJECTING_ROLES = new Set(["capital", "support"]);

/**
 * Whether one real-time knob of a card does anything on this build.
 * @param knob - The CombatModifiers key the card sets.
 * @param ship - The ship the loadout is built on.
 * @param slotTypes - Slot types of every card in the loadout.
 * @returns True when the knob has a target on this build.
 */
function knobApplies(
  knob: string,
  ship: ShipDefinition,
  slotTypes: ReadonlySet<string>,
): boolean {
  if (ORDNANCE_KNOBS.has(knob)) {
    return [...ORDNANCE_SLOT_TYPES].some((type) => slotTypes.has(type));
  }
  if (TURRET_KNOBS.has(knob)) return slotTypes.has("turret");
  if (knob === "projectsAura") return !SELF_PROJECTING_ROLES.has(ship.role);
  return true;
}

/**
 * List cards in a loadout that do nothing for this ship: ordnance boosters
 * without ordnance, turret boosters without a turret, aura cards on ships
 * that already project the aura by role.
 *
 * @param upgradeIds - The loadout's upgrade ids.
 * @param ship - The ship the loadout is built on.
 * @returns Ids of the cards that have no effect on this build.
 */
export function findDeadCards(
  upgradeIds: ReadonlyArray<string>,
  ship: ShipDefinition,
): string[] {
  const cards = upgradeIds.map((id) => UPGRADE_DEFINITIONS[id]);
  const slotTypes = new Set(cards.map((card) => card?.slotType ?? ""));
  return upgradeIds.filter((id) => {
    const card = UPGRADE_DEFINITIONS[id];
    if (
      !card ||
      card.weapon ||
      card.effects?.hullBonus ||
      card.effects?.shieldBonus
    ) {
      return false;
    }
    const knobs = Object.keys(card.realtime ?? {});
    return (
      knobs.length > 0 &&
      !knobs.some((knob) => knobApplies(knob, ship, slotTypes))
    );
  });
}
