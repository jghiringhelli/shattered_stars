/**
 * QuickBuildEquip — every battle mode flies quick builds: each ship gets a
 * loadout (the chosen one, or a default that respects unique pilots), and
 * equipping it applies stat bonuses, the modifier sheet (upgrades + pilot
 * ability) and the action-recharge / top-speed changes to its flight.
 *
 * Pure except {@link equipQuickBuild}, which bumps the ship's stats in place
 * like applyLoadoutEffects (called right after the ship is built).
 */

import {
  MAX_STRESS_RELIEF_TIERS,
  type CombatModifiers,
} from "../../core/CombatModifiers";
import { getEquippableLoadouts } from "../../data/ShipLoadouts";
import { uniquePilotOf } from "../../data/squadRules";
import {
  applyLoadoutEffects,
  type LoadoutTarget,
} from "../../systems/BattleHelpers";
import {
  applyControlModifiers,
  resolveLoadoutModifiers,
} from "../ArcadeUpgradeEffects";
import type { ActiveAura } from "../../systems/SupportAura";
import type { CycleFlightState, StressModifiers } from "./CycleFlight";

/** Milliseconds per second (rate conversion). */
const MS_PER_SECOND = 1000;

/**
 * Loadouts for a squad: chosen ones are kept; every other ship gets its
 * first quick build whose unique pilot is not already flying in the squad.
 *
 * @param shipIds - Ship definition ids, in squad order.
 * @param chosen - Loadout ids already chosen (by index), if any.
 * @returns One loadout id per ship, or null when the ship has none.
 */
export function assignQuickBuilds(
  shipIds: readonly string[],
  chosen: readonly (string | null | undefined)[] = [],
): (string | null)[] {
  const flying = new Set<string>();
  const claim = (loadoutId: string | null): string | null => {
    const pilot = uniquePilotOf(loadoutId);
    if (pilot) flying.add(pilot);
    return loadoutId;
  };
  chosen.forEach((id) => claim(id ?? null));
  return shipIds.map((shipId, index) => {
    const picked = chosen[index];
    if (picked) return picked;
    const free = getEquippableLoadouts(shipId).find((loadout) => {
      const pilot = uniquePilotOf(loadout.id);
      return pilot === null || !flying.has(pilot);
    });
    return claim(free?.id ?? null);
  });
}

/**
 * Equip a quick build on a freshly built ship: stat bonuses go onto the
 * ship (hull, shields, dice) and its modifier sheet is returned.
 *
 * @param ship - The new ship (stats bumped in place).
 * @param loadoutId - Its loadout, or null for the bare hull.
 * @returns The ship's modifier sheet (upgrades + pilot ability).
 */
export function equipQuickBuild(
  ship: LoadoutTarget,
  loadoutId: string | null,
): CombatModifiers {
  applyLoadoutEffects(ship, loadoutId);
  return resolveLoadoutModifiers(ship.definitionId, loadoutId);
}

/**
 * The equipped ship's flight: faster action recharges and top speed.
 *
 * @param flight - Flight state as created for the bare hull.
 * @param modifiers - The ship's modifier sheet.
 * @returns Flight state with the equipment applied.
 */
export function equipFlight(
  flight: CycleFlightState,
  modifiers: CombatModifiers,
): CycleFlightState {
  const control = applyControlModifiers(flight.motion.control, modifiers);
  return { ...flight, motion: { ...flight.motion, control } };
}

/**
 * The part of a modifier sheet (plus the faction aura covering the ship)
 * that shapes cycle stress.
 *
 * @param modifiers - The ship's modifier sheet.
 * @param aura - The aura covering the ship this frame (omitted = none):
 *   its stress-relief tiers add to the sheet's, capped at
 *   MAX_STRESS_RELIEF_TIERS.
 * @returns Relief tiers and stress-rate multiplier for tickCycleFlight.
 */
export function stressModifiersOf(
  modifiers: CombatModifiers,
  aura?: ActiveAura,
): StressModifiers {
  return {
    reliefTiers: Math.min(
      MAX_STRESS_RELIEF_TIERS,
      modifiers.stressReliefTiers + (aura?.stressReliefTiers ?? 0),
    ),
    rateMultiplier: modifiers.stressRateMultiplier,
  };
}

/**
 * Shields after regenerating for a frame (the sheet's rate is real-time
 * shield HP per second, applied as is).
 *
 * @param shields - Current shields.
 * @param maxShields - Shield cap.
 * @param modifiers - The ship's modifier sheet.
 * @param deltaMs - Frame length (ms).
 * @returns New shields (fractional), never above the cap.
 */
export function regenerateShields(
  shields: number,
  maxShields: number,
  modifiers: CombatModifiers,
  deltaMs: number,
): number {
  if (modifiers.shieldRegenPerSecond <= 0 || shields >= maxShields) {
    return shields;
  }
  return Math.min(
    maxShields,
    shields + (modifiers.shieldRegenPerSecond * deltaMs) / MS_PER_SECOND,
  );
}
