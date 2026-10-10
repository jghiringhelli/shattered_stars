/**
 * Arcade upgrade effects — turns a ship's equipped upgrades into the
 * real-time modifier sheet and applies the parts that are fixed at spawn
 * (maneuver recharge times, ordnance reloads/charges, turret rate of fire).
 *
 * Per-hit and per-frame effects (laser bonuses, damage taken, stress, shield
 * regen, aura projection) are read from the sheet by the battle scene at their
 * consumption points. Pure functions — no Phaser dependency.
 */

import type { ShipControlState } from "../core/ArcadeControls";
import {
  combineEffects,
  type CombatModifiers,
  type RealtimeEffect,
} from "../core/CombatModifiers";
import { getShipLoadouts } from "../data/ShipLoadouts";
import { UPGRADE_DEFINITIONS } from "../systems/UpgradeSystem";
import type { ArcadeOrdnanceSlot } from "./ArcadeOrdnance";
import type { ArcadeTurretSlot } from "./ArcadeTurret";

/**
 * Upgrade ids equipped by a loadout (empty for the bare ship or an unknown id).
 *
 * @param definitionId - Ship definition id.
 * @param loadoutId - Chosen loadout id, or null/undefined for the bare ship.
 * @returns The loadout's upgrade ids.
 */
export function loadoutUpgradeIds(
  definitionId: string,
  loadoutId: string | null | undefined,
): ReadonlyArray<string> {
  if (!loadoutId) return [];
  const loadout = getShipLoadouts(definitionId).find((l) => l.id === loadoutId);
  return loadout?.upgrades ?? [];
}

/**
 * Fold the real-time effects of a list of upgrades into one modifier sheet.
 *
 * @param upgradeIds - Equipped upgrade ids (unknown ids are ignored).
 * @returns The combined modifier sheet.
 */
export function resolveUpgradeModifiers(
  upgradeIds: ReadonlyArray<string>,
): CombatModifiers {
  const effects: RealtimeEffect[] = [];
  for (const id of upgradeIds) {
    const realtime = UPGRADE_DEFINITIONS[id]?.realtime;
    if (realtime) effects.push(realtime);
  }
  return combineEffects(effects);
}

/**
 * Scale the maneuver recharge times on a ship's control state.
 *
 * @param control - Control state as created for the bare hull.
 * @param modifiers - The ship's modifier sheet.
 * @returns Control state with upgraded recharge times.
 */
export function applyControlModifiers(
  control: ShipControlState,
  modifiers: CombatModifiers,
): ShipControlState {
  return {
    ...control,
    boostCooldownMax:
      control.boostCooldownMax * modifiers.boostCooldownMultiplier,
    barrelRollCooldownMax:
      control.barrelRollCooldownMax * modifiers.barrelRollCooldownMultiplier,
    kturnCooldownMax:
      control.kturnCooldownMax * modifiers.kturnCooldownMultiplier,
  };
}

/**
 * Apply reload, extra-charge and homing modifiers to ordnance slots.
 *
 * @param slots - Slots built from the loadout's ordnance cards.
 * @param modifiers - The ship's modifier sheet.
 * @returns New slots with the modifiers baked in.
 */
export function applyOrdnanceModifiers(
  slots: ReadonlyArray<ArcadeOrdnanceSlot>,
  modifiers: CombatModifiers,
): ArcadeOrdnanceSlot[] {
  return slots.map((slot) => {
    const charges = slot.maxCharges + modifiers.ordnanceBonusCharges;
    return {
      ...slot,
      cooldownMax: slot.cooldownMax * modifiers.ordnanceCooldownMultiplier,
      homingTurnBudget: slot.isHoming
        ? slot.homingTurnBudget + modifiers.homingTurnBonus
        : slot.homingTurnBudget,
      charges,
      maxCharges: charges,
    };
  });
}

/**
 * Apply the rate-of-fire modifier to a turret slot.
 *
 * @param slot - Turret built from the loadout's turret card (or null).
 * @param modifiers - The ship's modifier sheet.
 * @returns A new turret slot, or null when the ship has no turret.
 */
export function applyTurretModifiers(
  slot: ArcadeTurretSlot | null,
  modifiers: CombatModifiers,
): ArcadeTurretSlot | null {
  if (!slot) return null;
  return {
    ...slot,
    cooldownMax: slot.cooldownMax * modifiers.turretCooldownMultiplier,
  };
}
