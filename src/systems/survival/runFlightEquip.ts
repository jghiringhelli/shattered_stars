/**
 * Survival — the run's Drive bonus through the equipment path (pure).
 *
 * A player ship keeps a BASE modifier sheet (quick build + relics +
 * mutations + upgrades). `fleetModifiers` layers the run's Drive effect on
 * it, and `reequipFlight` rebuilds the flight's speed / recharge fields from
 * the hull's unmodified control state before applying the sheet once — so
 * applying the bonuses any number of times (every wave, after every draft)
 * gives the same flight: no stacking. Flagship and bot-flown escorts go
 * through the same two functions, so they get Drive identically.
 */

import {
  combineEffects,
  type CombatModifiers,
} from "../../core/CombatModifiers";
import { applyControlModifiers } from "../../arcade/ArcadeUpgradeEffects";
import {
  createShipControl,
  type CycleFlightState,
} from "../../arcade/systems/CycleFlight";
import { driveEffect } from "./FleetEffects";

/**
 * @param base - The ship's base sheet (everything but Drive).
 * @param speed - The run's accumulated speed bonus.
 * @returns The sheet the ship flies and fights with.
 */
export function fleetModifiers(
  base: CombatModifiers,
  speed: number,
): CombatModifiers {
  const drive = driveEffect(speed);
  return Object.keys(drive).length === 0 ? base : combineEffects([base, drive]);
}

/**
 * Re-applies a modifier sheet to a flight: top speed and action recharges
 * start again from the hull's own values, then the sheet is applied once.
 * The maneuver in progress, pose, cooldowns running and stress are kept;
 * the throttle is clamped to the new top speed.
 *
 * @param flight - The ship's current flight state.
 * @param definitionId - Its ship definition (the unmodified base).
 * @param modifiers - Its full modifier sheet.
 * @returns The re-equipped flight.
 */
export function reequipFlight(
  flight: CycleFlightState,
  definitionId: string,
  modifiers: CombatModifiers,
): CycleFlightState {
  const base = createShipControl(definitionId, flight.motion);
  const reset = {
    ...flight.motion.control,
    maxSpeed: base.maxSpeed,
    boostCooldownMax: base.boostCooldownMax,
    barrelRollCooldownMax: base.barrelRollCooldownMax,
    kturnCooldownMax: base.kturnCooldownMax,
  };
  const control = applyControlModifiers(reset, modifiers);
  return {
    ...flight,
    motion: {
      ...flight.motion,
      control: { ...control, speed: Math.min(control.speed, control.maxSpeed) },
    },
  };
}
