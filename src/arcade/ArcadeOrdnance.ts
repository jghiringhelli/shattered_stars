/**
 * Arcade Ordnance System
 *
 * Maps ship loadout upgrades to real-time ordnance slots.
 * Handles charges, per-weapon cooldowns, and homing parameters.
 * Pure functions — no Phaser dependency.
 */

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
  /** Cooldown between shots in ms */
  readonly cooldownMax: number;
  /** Ms remaining before next shot */
  cooldownRemaining: number;
  /** Shots remaining */
  charges: number;
  /** Max charges (for HUD) */
  readonly maxCharges: number;
}

// ============================================
// Arcade stats per upgrade slot type
// ============================================

/** Base arcade properties keyed by upgrade slotType. */
const SLOT_TYPE_PROPS: Record<
  string,
  Omit<
    ArcadeOrdnanceSlot,
    "slotIndex" | "name" | "charges" | "maxCharges" | "cooldownRemaining"
  >
> = {
  missile: {
    ordnanceClass: "missile",
    damage: 3,
    isHoming: true,
    homingTurnRate: 90,
    cooldownMax: 4000,
  },
  torpedo: {
    ordnanceClass: "torpedo",
    damage: 5,
    isHoming: true,
    homingTurnRate: 50,
    cooldownMax: 6000,
  },
  bomb: {
    ordnanceClass: "bomb",
    damage: 4,
    isHoming: false,
    homingTurnRate: 0,
    cooldownMax: 8000,
  },
  mine: {
    ordnanceClass: "bomb",
    damage: 4,
    isHoming: false,
    homingTurnRate: 0,
    cooldownMax: 10000,
  },
};

// ============================================
// Public API
// ============================================

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
  if (!loadout) return [];

  const slots: ArcadeOrdnanceSlot[] = [];

  for (const upgradeId of loadout.upgrades) {
    if (slots.length >= 3) break;

    const upg = UPGRADE_DEFINITIONS[upgradeId];
    if (!upg) continue;

    const props = SLOT_TYPE_PROPS[upg.slotType];
    if (!props) continue;

    const charges = upg.effects?.chargesAdded ?? 2;
    slots.push({
      slotIndex: slots.length,
      name: upg.name,
      ...props,
      charges,
      maxCharges: charges,
      cooldownRemaining: 0,
    });
  }

  return slots;
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
