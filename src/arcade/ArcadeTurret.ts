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
  /** Ms remaining until next shot */
  cooldownRemaining: number;
  /**
   * Current turret aim direction — absolute angle in degrees.
   * Updated every frame by auto-targeting or manual gunner control.
   */
  turretFacing: number;
}

// ============================================
// Arcade stats per turret upgrade ID
// ============================================

const TURRET_PROPS: Readonly<
  Record<string, Pick<ArcadeTurretSlot, "damage" | "range" | "cooldownMax">>
> = {
  light_laser_turret: { damage: 1, range: 350, cooldownMax: 1500 },
  twin_laser_turret: { damage: 2, range: 400, cooldownMax: 2000 },
  ion_turret: { damage: 2, range: 300, cooldownMax: 2500 },
  quad_laser_turret: { damage: 3, range: 350, cooldownMax: 2000 },
};

// ============================================
// Public API
// ============================================

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
  if (!loadout) return null;

  for (const upgradeId of loadout.upgrades) {
    const upg = UPGRADE_DEFINITIONS[upgradeId];
    if (!upg || upg.slotType !== "turret") continue;

    const props = TURRET_PROPS[upgradeId];
    if (!props) continue;

    return {
      definitionId: upgradeId,
      name: upg.name,
      ...props,
      cooldownRemaining: 0,
      turretFacing: 0,
    };
  }

  return null;
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
