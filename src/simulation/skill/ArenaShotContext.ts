/**
 * ArenaShotContext — the situation of one shot, as the lever rules read it:
 * where the attacker sits around its target, wingmen on either side, focus
 * fire and crossfire by allies within the cycle, cover by the target's
 * allies, and the attacking squad's mark.
 *
 * Torus-aware. Pure reads, except {@link recordRecentHit}.
 */

import { CYCLE_DURATION_MS } from "../../config";
import { WINGMAN_RADIUS_PX } from "../../arcade/ShotConditions";
import { isMarkedBy } from "../../arcade/systems/SquadMark";
import type { CombatState, RecentHit } from "./ArenaCombatState";
import {
  arcPositionOf,
  inFiringArc,
  offNoseDeg,
  signedAngle,
  torusOffset,
} from "../../arcade/ai/AiGeometry";
import { CROSSFIRE_MIN_SEPARATION_DEG, type ShotContext } from "./ArenaRules";
import type { ArenaShip } from "./ArenaShip";

/**
 * @param ship - The ship asking.
 * @param state - Combat state.
 * @returns Whether another living ally flies within wingman range.
 */
export function fliesWithWingman(ship: ArenaShip, state: CombatState): boolean {
  return state.ships.some(
    (ally) =>
      ally.alive &&
      ally.id !== ship.id &&
      ally.side === ship.side &&
      torusOffset(ship, ally, state.worldSize).distance <= WINGMAN_RADIUS_PX,
  );
}

/**
 * @param target - The target.
 * @param attacker - The shooter.
 * @param worldSize - Torus edge (px).
 * @returns World bearing from the target to the attacker (°).
 */
function bearingFrom(
  target: ArenaShip,
  attacker: ArenaShip,
  worldSize: number,
): number {
  return offNoseDeg(
    { x: target.x, y: target.y, angle: 0 },
    attacker,
    worldSize,
  );
}

/** Teamwork conditions of a shot. */
interface Teamwork {
  readonly focusFire: boolean;
  readonly crossfire: boolean;
}

/**
 * @param attacker - The shooter.
 * @param target - Its target.
 * @param state - Combat state.
 * @param nowMs - Arena time (ms).
 * @returns Whether an ally of the attacker hit this target within a cycle,
 *   and whether one did so from a different enough bearing (crossfire).
 */
export function teamworkOf(
  attacker: ArenaShip,
  target: ArenaShip,
  state: CombatState,
  nowMs: number,
): Teamwork {
  const hits = state.recentHits.get(target.id);
  if (!hits) return { focusFire: false, crossfire: false };
  const mine = bearingFrom(target, attacker, state.worldSize);
  let focusFire = false;
  let crossfire = false;
  for (const [attackerId, hit] of hits) {
    if (attackerId === attacker.id || nowMs - hit.atMs > CYCLE_DURATION_MS)
      continue;
    if (state.ships.find((s) => s.id === attackerId)?.side !== attacker.side)
      continue;
    focusFire = true;
    if (
      Math.abs(signedAngle(hit.bearingDeg - mine)) >=
      CROSSFIRE_MIN_SEPARATION_DEG
    )
      crossfire = true;
  }
  return { focusFire, crossfire };
}

/**
 * @param attacker - The shooter.
 * @param target - Its target.
 * @param state - Combat state.
 * @returns Whether one of the target's allies has the attacker in its arc and range.
 */
function isCovered(
  attacker: ArenaShip,
  target: ArenaShip,
  state: CombatState,
): boolean {
  return state.ships.some(
    (ally) =>
      ally.alive &&
      ally.id !== target.id &&
      ally.side === target.side &&
      inFiringArc(
        {
          ...ally,
          firingArcDeg: ally.combatStats.firingArc,
          weaponRange: ally.combatStats.weaponRange,
        },
        attacker,
        state.worldSize,
      ),
  );
}

/**
 * @param attacker - The shooter.
 * @param target - Its target.
 * @param state - Combat state.
 * @param nowMs - Arena time (ms).
 * @returns Dice and situation of the shot, for the lever rules.
 */
export function shotContextOf(
  attacker: ArenaShip,
  target: ArenaShip,
  state: CombatState,
  nowMs: number,
): ShotContext {
  return {
    attackDice: attacker.combatStats.attackDice,
    agilityDice: target.combatStats.agilityDice,
    position: arcPositionOf(
      attacker,
      { ...target, firingArcDeg: target.combatStats.firingArc },
      state.worldSize,
    ),
    attackerHasWingman: fliesWithWingman(attacker, state),
    targetHasWingman: fliesWithWingman(target, state),
    ...teamworkOf(attacker, target, state, nowMs),
    covered: isCovered(attacker, target, state),
    marked: isMarkedBy(state.marks, attacker.side, target.id, nowMs),
  };
}

/**
 * Remember a hit for the focus-fire / crossfire levers.
 * @param state - Combat state (mutated).
 * @param attacker - Who hit.
 * @param target - Who was hit.
 * @param nowMs - When (ms).
 */
export function recordRecentHit(
  state: CombatState,
  attacker: ArenaShip,
  target: ArenaShip,
  nowMs: number,
): void {
  const hits = state.recentHits.get(target.id) ?? new Map<string, RecentHit>();
  hits.set(attacker.id, {
    atMs: nowMs,
    bearingDeg: bearingFrom(target, attacker, state.worldSize),
  });
  state.recentHits.set(target.id, hits);
}
