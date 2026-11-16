/**
 * ArenaAce — the ace hit-and-run mechanics (AceStrike, Disengage) as the
 * skill arena runs them: the battle's book of aces, the strike window opened
 * by a flown dash, the disengage reward with its boost refund, and the flags
 * a shot carries into DiceAttack.
 *
 * Mutates the combat state's book and the rewarded ships' flights. Pure: no
 * Phaser.
 */

import {
  createAceStrikeBook,
  enlistAce,
  noteFlightEvents,
  takeShotFlags,
  type AceShotFlags,
  type AceStrikeBook,
} from "../../arcade/systems/AceStrike";
import { refundBoost, updateDisengage } from "../../arcade/systems/Disengage";
import type { FlightEvent } from "../../arcade/systems/PilotFlightTypes";
import type { CombatState } from "./ArenaCombatState";
import type { ArenaShip } from "./ArenaShip";


/**
 * @param state - Combat state.
 * @returns The battle's book of aces, created on first use with every
 *   living ace of the roster enlisted (reinforcements join on later calls).
 */
export function aceBookOf(state: CombatState): AceStrikeBook {
  state.aceStrike ??= createAceStrikeBook();
  for (const ship of state.ships) {
    if (ship.isAce && ship.alive) enlistAce(state.aceStrike, ship.id);
  }
  return state.aceStrike;
}

/**
 * A ship flew a frame: an ace that dashed opens its strike window.
 * @param state - Combat state.
 * @param ship - The ship.
 * @param events - Its flight events this frame.
 * @param nowMs - Arena time (ms, flight clock).
 */
export function noteArenaFlight(
  state: CombatState,
  ship: ArenaShip,
  events: readonly FlightEvent[],
  nowMs: number,
): void {
  if (!ship.isAce) return;
  noteFlightEvents(aceBookOf(state), ship.id, events, nowMs);
}

/**
 * Every ace that got clear of the enemy's guns (or mark) is rewarded: the
 * evasion window opens and its boost recharge is part refunded.
 * @param state - Combat state (ships' flights mutated).
 * @param nowMs - Arena time (ms, flight clock).
 */
export function updateArenaDisengage(state: CombatState, nowMs: number): void {
  if (!state.ships.some((ship) => ship.isAce)) return;
  const rewarded = updateDisengage(aceBookOf(state), {
    ships: state.ships.map((ship) => ({
      id: ship.id,
      side: ship.side,
      x: ship.x,
      y: ship.y,
      angle: ship.angle,
      firingArcDeg: ship.combatStats.firingArc,
      weaponRange: ship.combatStats.weaponRange,
      alive: ship.alive,
    })),
    marks: state.marks,
    nowMs,
    worldSize: state.worldSize,
  });
  for (const id of rewarded) {
    const ship = state.ships.find((candidate) => candidate.id === id)!;
    const motion = ship.flight.motion;
    ship.flight = {
      ...ship.flight,
      motion: { ...motion, control: refundBoost(motion.control) },
    };
  }
}

/**
 * The shot's ace flags; a strike spends the window's shot.
 * @param state - Combat state.
 * @param attacker - The shooter.
 * @param target - Its target.
 * @param nowMs - Arena time (ms).
 * @returns Whether the shot is a strike, and whether the target evades.
 */
export function takeAceShotFlags(
  state: CombatState,
  attacker: ArenaShip,
  target: ArenaShip,
  nowMs: number,
): AceShotFlags {
  if (!state.aceStrike) return { attackerStrike: false, targetEvading: false };
  return takeShotFlags(state.aceStrike, attacker.id, target.id, nowMs);
}
