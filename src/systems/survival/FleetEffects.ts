/**
 * Survival roguelite — static fleet effects (pure): everything that is
 * folded into a player ship's CombatModifiers sheet at spawn — relic and
 * set-bonus statics, mutation statics, ship upgrades, and the Drive branch
 * ("speed" powers) re-wired as a real flight effect for the whole fleet.
 */

import type { RealtimeEffect } from "../../core/CombatModifiers";
import { DURABILITY_SCALE } from "../../config";
import {
  UPGRADE_HULL_POINTS,
  UPGRADE_LASER_DAMAGE,
} from "../../data/survival/economy";
import { getMutation, type Mutation } from "../../data/survival/mutations";
import {
  activeArchetypeSets,
  relicsOf,
} from "../../data/survival/relicCatalog";
import type { FleetScope, RelicEffect } from "../../data/survival/relics";

/** Which of the player's ships a ship is. */
export type FleetRole = "flagship" | "escort";

/** Boost recharge multiplier per Drive point beyond the first. */
export const DRIVE_BOOST_STEP = 0.85;
/** Floor on Drive's boost recharge multiplier (matches MIN_COOLDOWN_MULTIPLIER). */
export const DRIVE_BOOST_FLOOR = 0.4;

/**
 * The Drive branch ("speed" powers: Thruster Tuning +1, Afterburners +3,
 * Formation Drills +1) as flight: the first point is one extra top-speed
 * notch (maxSpeedBonus — combineEffects caps it one notch above the dial);
 * every further point multiplies the boost recharge by DRIVE_BOOST_STEP,
 * never below DRIVE_BOOST_FLOOR. Applied identically to every ship of the
 * player's fleet (flagship and bot-flown escorts) through runFlightEquip.
 *
 * @param speed - The run's accumulated speed bonus (hull amplification can
 *   make it fractional).
 * @returns The fleet-wide flight effect (empty at 0).
 */
export function driveEffect(speed: number): RealtimeEffect {
  if (speed <= 0) return {};
  const extra = Math.max(0, speed - 1);
  if (extra === 0) return { maxSpeedBonus: 1 };
  return {
    maxSpeedBonus: 1,
    boostCooldownMultiplier: Math.max(
      DRIVE_BOOST_FLOOR,
      DRIVE_BOOST_STEP ** extra,
    ),
  };
}

/**
 * @param level - A ship's upgrade level.
 * @returns Its upgrade effect (+laser damage per level).
 */
export function upgradeEffect(level: number): RealtimeEffect {
  return level > 0 ? { laserDamageBonus: UPGRADE_LASER_DAMAGE * level } : {};
}

/**
 * @param level - A ship's upgrade level.
 * @returns Extra real-time hull points it grants.
 */
export function upgradeHull(level: number): number {
  return Math.max(0, level) * UPGRADE_HULL_POINTS * DURABILITY_SCALE;
}

/**
 * @param scope - An effect's scope.
 * @param role - A ship's role.
 * @returns True when the effect applies to that ship.
 */
export function scopeIncludes(scope: FleetScope, role: FleetRole): boolean {
  if (scope === "fleet") return true;
  return scope === "flagship" ? role === "flagship" : role === "escort";
}

/** The run choices that shape fleet effects. */
export interface FleetLoadout {
  readonly relicIds: readonly string[];
  readonly mutationIds: readonly string[];
  /** Accumulated "speed" bonus from Drive powers. */
  readonly speed: number;
}

/**
 * @param loadout - Relics, mutations and Drive investment.
 * @returns Every relic and set-bonus effect, flattened.
 */
export function relicEffectsOf(loadout: FleetLoadout): RelicEffect[] {
  return [
    ...relicsOf(loadout.relicIds).flatMap((relic) => relic.effects),
    ...activeArchetypeSets(loadout.relicIds).flatMap((set) => set.effects),
  ];
}

/**
 * @param loadout - Relics, mutations and Drive investment.
 * @returns The installed mutations.
 */
export function mutationsOf(loadout: FleetLoadout): Mutation[] {
  return loadout.mutationIds.flatMap((id) => {
    const mutation = getMutation(id);
    return mutation ? [mutation] : [];
  });
}

/**
 * @param loadout - Relics, mutations and Drive investment.
 * @param role - The ship's role.
 * @param upgrades - The ship's upgrade level.
 * @returns The static effects to fold into its base modifier sheet at
 *   spawn. Drive is NOT included: the scene layers it on (and re-applies it)
 *   through runFlightEquip so it never stacks.
 */
export function staticEffectsFor(
  loadout: FleetLoadout,
  role: FleetRole,
  upgrades: number,
): RealtimeEffect[] {
  const relicStatics = relicEffectsOf(loadout).flatMap((e) =>
    e.kind === "static" && scopeIncludes(e.scope, role) ? [e.effect] : [],
  );
  const mutationStatics =
    role === "flagship"
      ? mutationsOf(loadout).flatMap((m) =>
          m.rules.staticEffect ? [m.rules.staticEffect] : [],
        )
      : [];
  return [upgradeEffect(upgrades), ...relicStatics, ...mutationStatics];
}

/**
 * @param loadout - Relics, mutations and Drive investment.
 * @param role - The ship's role.
 * @returns Its max-hull multiplier from mutations (flagship only).
 */
export function maxHullMultiplier(
  loadout: FleetLoadout,
  role: FleetRole,
): number {
  if (role !== "flagship") return 1;
  return mutationsOf(loadout).reduce(
    (m, mut) => m * (mut.rules.maxHullMultiplier ?? 1),
    1,
  );
}
