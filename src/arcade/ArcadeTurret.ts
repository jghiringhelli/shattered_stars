/**
 * Arcade Turret System
 *
 * Maps ship loadout turret upgrades to real-time auto-targeting slots.
 * Turrets auto-rotate toward the nearest in-range enemy and fire on cooldown.
 * All arcade turrets have 360° coverage — directional arcs are turn-based only.
 * Pure functions — no Phaser dependency.
 */

import { getShipLoadouts } from "../data/ShipLoadouts";
import { UPGRADE_DEFINITIONS } from "../systems/UpgradeSystem";

/** A single turret mounted on an arcade ship. */
export interface ArcadeTurretSlot {
  /** Upgrade definition ID (e.g. 'light_laser_turret') */
  readonly definitionId: string;
  /** Human-readable name for HUD */
  readonly name: string;
  /** Damage dealt per hit */
  readonly damage: number;
  /** Maximum engagement range in pixels */
  readonly range: number;
  /** Cooldown between shots in ms */
  readonly cooldownMax: number;
  /** Stress (0–1 scale) inflicted on the target by each hit. */
  readonly stressOnHit: number;
  /** Ms remaining until next shot */
  cooldownRemaining: number;
  /**
   * Current turret aim direction — absolute angle in degrees.
   * Updated every frame by auto-targeting or manual gunner control.
   */
  turretFacing: number;
}

/** Engagement range for a turret card that does not state one, in pixels. */
const DEFAULT_TURRET_RANGE_PX = 350;

// ============================================
// Public API
// ============================================

/**
 * Build the turret slot from the first turret card in a list of upgrades.
 *
 * @param upgradeIds - Equipped upgrade ids, in loadout order.
 * @returns Ready-to-use turret slot, or null if none equipped.
 */
export function buildTurretSlot(
  upgradeIds: ReadonlyArray<string>,
): ArcadeTurretSlot | null {
  for (const upgradeId of upgradeIds) {
    const upgrade = UPGRADE_DEFINITIONS[upgradeId];
    if (upgrade?.slotType !== "turret" || !upgrade.weapon) continue;
    const { weapon } = upgrade;
    return {
      definitionId: upgradeId,
      name: upgrade.name,
      damage: weapon.damage,
      range: weapon.rangePx ?? DEFAULT_TURRET_RANGE_PX,
      cooldownMax: weapon.cooldownMs,
      stressOnHit: weapon.stressOnHit ?? 0,
      cooldownRemaining: 0,
      turretFacing: 0,
    };
  }
  return null;
}

/**
 * Extract the first turret upgrade from a ship's loadout, if any.
 * Ships without a turret slot in their loadout return null.
 *
 * @param definitionId - Ship definition ID.
 * @param loadoutId - Chosen loadout ID (null = no loadout).
 * @returns Ready-to-use turret slot, or null if none equipped.
 */
export function extractTurretSlot(
  definitionId: string,
  loadoutId: string | null | undefined,
): ArcadeTurretSlot | null {
  if (!loadoutId) return null;
  const loadout = getShipLoadouts(definitionId).find((l) => l.id === loadoutId);
  return loadout ? buildTurretSlot(loadout.upgrades) : null;
}
/**
 * Advance turret cooldown by deltaMs.
 * Mutates slot in place — called every frame.
 *
 * @param slot - Turret slot to tick.
 * @param deltaMs - Frame time in milliseconds.
 */
export function tickTurretCooldown(
  slot: ArcadeTurretSlot,
  deltaMs: number,
): void {
  if (slot.cooldownRemaining > 0) {
    slot.cooldownRemaining = Math.max(0, slot.cooldownRemaining - deltaMs);
  }
}

/**
 * Whether the turret can fire right now.
 *
 * @param slot - Turret slot to check.
 * @returns True when cooldown has fully expired.
 */
export function canFireTurret(slot: ArcadeTurretSlot): boolean {
  return slot.cooldownRemaining === 0;
}

/**
 * Start cooldown after firing a turret shot.
 *
 * @param slot - Turret slot to consume a shot from.
 */
export function consumeTurretShot(slot: ArcadeTurretSlot): void {
  slot.cooldownRemaining = slot.cooldownMax;
}
