/**
 * Arcade Ordnance System
 *
 * Maps ship loadout upgrades to real-time ordnance slots.
 * Handles charges, per-weapon cooldowns, and homing parameters.
 * Pure functions — no Phaser dependency.
 */

import { ORDNANCE_DAMAGE_SCALE } from "../config";
import { getShipLoadouts } from "../data/ShipLoadouts";
import { UPGRADE_DEFINITIONS } from "../systems/UpgradeSystem";

/** Arcade ordnance types grouped by behavior. */
export type ArcadeOrdnanceClass = "missile" | "torpedo" | "bomb";

/** A single equipped ordnance weapon ready for arcade use. */
export interface ArcadeOrdnanceSlot {
  /** Key index: 0=key1, 1=key2, 2=key3 */
  readonly slotIndex: number;
  /** Human-readable name for HUD */
  readonly name: string;
  readonly ordnanceClass: ArcadeOrdnanceClass;
  /** Damage dealt per hit */
  readonly damage: number;
  /** Whether the projectile homes in on the nearest enemy */
  readonly isHoming: boolean;
  /** Degrees per second turn rate for homing (0 for bombs) */
  readonly homingTurnRate: number;
  /**
   * Total degrees of steering a fired projectile begins with.
   * Once exhausted the missile flies straight. 0 for non-homing weapons.
   */
  readonly homingTurnBudget: number;
  /** Stress (0–1 scale) inflicted on the target by each hit. */
  readonly stressOnHit: number;
  /** Cooldown between shots in ms */
  readonly cooldownMax: number;
  /** Ms remaining before next shot */
  cooldownRemaining: number;
  /** Shots remaining */
  charges: number;
  /** Max charges (for HUD) */
  readonly maxCharges: number;
}

/** Upgrade slot types that become arcade ordnance, and their weapon class. */
const ORDNANCE_CLASS_BY_SLOT: Readonly<Record<string, ArcadeOrdnanceClass>> = {
  missile: "missile",
  torpedo: "torpedo",
  bomb: "bomb",
};

/** Charges an ordnance card carries when it does not state its own. */
const DEFAULT_ORDNANCE_CHARGES = 2;

/** Maximum ordnance slots a ship can bind to the 1/2/3 keys. */
const MAX_ORDNANCE_SLOTS = 3;

// ============================================
// Public API
// ============================================

/**
 * Build one arcade slot from an ordnance upgrade card.
 *
 * @param upgradeId - Upgrade catalog id.
 * @param slotIndex - Key binding index for the slot.
 * @returns The ready slot, or null when the card is not arcade ordnance.
 */
function buildOrdnanceSlot(
  upgradeId: string,
  slotIndex: number,
): ArcadeOrdnanceSlot | null {
  const upgrade = UPGRADE_DEFINITIONS[upgradeId];
  const ordnanceClass = upgrade && ORDNANCE_CLASS_BY_SLOT[upgrade.slotType];
  if (!upgrade?.weapon || !ordnanceClass) return null;
  const { weapon } = upgrade;
  const charges = upgrade.effects?.chargesAdded ?? DEFAULT_ORDNANCE_CHARGES;
  return {
    slotIndex,
    name: upgrade.name,
    ordnanceClass,
    damage: weapon.damage * ORDNANCE_DAMAGE_SCALE,
    isHoming: ordnanceClass !== "bomb",
    homingTurnRate: weapon.homingTurnRate ?? 0,
    homingTurnBudget: weapon.homingTurnBudget ?? 0,
    stressOnHit: weapon.stressOnHit ?? 0,
    cooldownMax: weapon.cooldownMs,
    cooldownRemaining: 0,
    charges,
    maxCharges: charges,
  };
}

/**
 * Build ordnance slots for a list of equipped upgrade ids.
 * Returns up to 3 slots (1/2/3 keys) for missile/torpedo/bomb upgrades.
 *
 * @param upgradeIds - Equipped upgrade ids, in loadout order.
 * @returns Array of ready-to-use ordnance slots.
 */
export function buildOrdnanceSlots(
  upgradeIds: ReadonlyArray<string>,
): ArcadeOrdnanceSlot[] {
  const slots: ArcadeOrdnanceSlot[] = [];
  for (const upgradeId of upgradeIds) {
    if (slots.length >= MAX_ORDNANCE_SLOTS) break;
    const slot = buildOrdnanceSlot(upgradeId, slots.length);
    if (slot) slots.push(slot);
  }
  return slots;
}

/**
 * Build ordnance slots for a ship based on its loadout.
 * Returns up to 3 slots (1/2/3 keys) for missile/torpedo/bomb upgrades.
 *
 * @param definitionId - Ship definition ID.
 * @param loadoutId - Chosen loadout ID (may be undefined for no loadout).
 * @returns Array of ready-to-use ordnance slots.
 */
export function extractOrdnanceSlots(
  definitionId: string,
  loadoutId: string | null | undefined,
): ArcadeOrdnanceSlot[] {
  if (!loadoutId) return [];
  const loadout = getShipLoadouts(definitionId).find((l) => l.id === loadoutId);
  return loadout ? buildOrdnanceSlots(loadout.upgrades) : [];
}

/**
 * Advance all ordnance cooldown timers by deltaMs.
 * Mutates slots in place — called every frame.
 *
 * @param slots - Ship's ordnance slots.
 * @param deltaMs - Frame time in milliseconds.
 */
export function tickOrdnanceCooldowns(
  slots: ArcadeOrdnanceSlot[],
  deltaMs: number,
): void {
  for (const slot of slots) {
    if (slot.cooldownRemaining > 0) {
      slot.cooldownRemaining = Math.max(0, slot.cooldownRemaining - deltaMs);
    }
  }
}

/**
 * Whether a slot can be fired right now.
 *
 * @param slot - Ordnance slot to check.
 * @returns True if charges remain and cooldown has expired.
 */
export function canFireOrdnance(slot: ArcadeOrdnanceSlot): boolean {
  return slot.charges > 0 && slot.cooldownRemaining === 0;
}

/**
 * Decrement charges and start cooldown after firing.
 *
 * @param slot - Slot to consume a charge from.
 */
export function consumeOrdnanceCharge(slot: ArcadeOrdnanceSlot): void {
  slot.charges = Math.max(0, slot.charges - 1);
  slot.cooldownRemaining = slot.cooldownMax;
}

/**
 * Refill all ordnance charges to max (between waves / mission start).
 *
 * @param slots - Ship's ordnance slots.
 */
export function reloadAllOrdnance(slots: ArcadeOrdnanceSlot[]): void {
  for (const slot of slots) {
    slot.charges = slot.maxCharges;
    slot.cooldownRemaining = 0;
  }
}
