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
import { PILOT_ABILITY_REALTIME } from "../data/pilotAbilityEffects";
import { PILOT_CARDS } from "../systems/SquadBuilder";
import { UPGRADE_DEFINITIONS } from "../systems/UpgradeSystem";

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
 * Real-time effects of a list of upgrades (unknown ids are ignored).
 * @param upgradeIds - Equipped upgrade ids.
 * @returns Each upgrade's effect.
 */
function upgradeEffects(upgradeIds: ReadonlyArray<string>): RealtimeEffect[] {
  return upgradeIds
    .map((id) => UPGRADE_DEFINITIONS[id]?.realtime)
    .filter((effect): effect is RealtimeEffect => effect !== undefined);
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
  return combineEffects(upgradeEffects(upgradeIds));
}

/**
 * The full modifier sheet a quick build flies with: its upgrades plus its
 * pilot's signature ability (pilotAbilityEffects).
 *
 * @param definitionId - Ship definition id.
 * @param loadoutId - Chosen loadout id, or null/undefined for the bare ship.
 * @returns The combined modifier sheet.
 */
export function resolveLoadoutModifiers(
  definitionId: string,
  loadoutId: string | null | undefined,
): CombatModifiers {
  const loadout = loadoutId
    ? getShipLoadouts(definitionId).find((l) => l.id === loadoutId)
    : undefined;
  if (!loadout) return combineEffects([]);
  const abilityId = PILOT_CARDS[loadout.pilotId]?.abilityId;
  const ability = abilityId ? PILOT_ABILITY_REALTIME[abilityId] : undefined;
  const effects = upgradeEffects(loadout.upgrades);
  return combineEffects(ability ? [...effects, ability] : effects);
}

/**
 * Scale the maneuver recharge times and raise the top speed on a ship's
 * control state.
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
    maxSpeed: control.maxSpeed + modifiers.maxSpeedBonus,
    boostCooldownMax:
      control.boostCooldownMax * modifiers.boostCooldownMultiplier,
    barrelRollCooldownMax:
      control.barrelRollCooldownMax * modifiers.barrelRollCooldownMultiplier,
    kturnCooldownMax:
      control.kturnCooldownMax * modifiers.kturnCooldownMultiplier,
  };
}
