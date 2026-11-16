/**
 * AceStrikeGlue — the ace hit-and-run mechanics (AceStrike, Disengage) as a
 * Skirmish battle runs them: the battle's book of aces (a plain Map the
 * online snapshot and state hash capture), the strike window a flown dash
 * opens, the disengage reward with its boost refund, and the flags a shot
 * carries into DiceAttack.
 *
 * Pure: no Phaser. Mutates the book and the rewarded ships' controls.
 */

import {
  createAceStrikeBook,
  enlistAce,
  forgetAce,
  noteFlightEvents,
  takeShotFlags,
  type AceShotFlags,
  type AceStrikeBook,
} from "../../arcade/systems/AceStrike";
import { refundBoost, updateDisengage } from "../../arcade/systems/Disengage";
import type { FlightEvent } from "../../arcade/systems/PilotFlightTypes";
import type { SquadMarks } from "../../arcade/systems/SquadMark";
import { teamKey } from "../../arcade/teams";
import { BATTLEFIELD_SIZE } from "../../config";
import type { ArcadeShip } from "./arcadeShipFactory";


export class AceStrikeGlue {
  /** Every living ace's state, by ship id (snapshot and hash read this). */
  readonly book: AceStrikeBook = createAceStrikeBook();

  /**
   * A ship flew a frame: an ace that dashed opens its strike window.
   * @param ship - The ship.
   * @param events - Its flight events this frame.
   * @param nowMs - Battle time (ms).
   */
  noteFlight(
    ship: ArcadeShip,
    events: readonly FlightEvent[],
    nowMs: number,
  ): void {
    if (!ship.isAce) return;
    enlistAce(this.book, ship.id);
    noteFlightEvents(this.book, ship.id, events, nowMs);
  }

  /**
   * Every ace that got clear of the enemy's guns (or mark) is rewarded: the
   * evasion window opens and its boost recharge is part refunded.
   * @param ships - Every ship of the battle.
   * @param marks - The sides' squad marks.
   * @param nowMs - Battle time (ms).
   */
  updateDisengage(
    ships: ReadonlyMap<string, ArcadeShip>,
    marks: SquadMarks,
    nowMs: number,
  ): void {
    const all = [...ships.values()];
    if (!all.some((ship) => ship.isAce)) return;
    const rewarded = updateDisengage(this.book, {
      ships: all.map((ship) => ({
        id: ship.id,
        side: teamKey(ship.team),
        x: ship.x,
        y: ship.y,
        angle: ship.angle,
        firingArcDeg: ship.combatStats.firingArc,
        weaponRange: ship.combatStats.weaponRange,
        alive: ship.hull > 0,
      })),
      marks,
      nowMs,
      worldSize: BATTLEFIELD_SIZE,
    });
    for (const id of rewarded) {
      const ace = ships.get(id)!;
      ace.control = refundBoost(ace.control);
    }
  }

  /**
   * The shot's ace flags; a strike spends the window's shot.
   * @param attacker - The shooter.
   * @param target - Its target.
   * @param nowMs - Battle time (ms).
   * @returns Whether the shot is a strike, and whether the target evades.
   */
  takeShotFlags(
    attacker: ArcadeShip,
    target: ArcadeShip,
    nowMs: number,
  ): AceShotFlags {
    return takeShotFlags(this.book, attacker.id, target.id, nowMs);
  }

  /** @param shipId - A destroyed ship. */
  forget(shipId: string): void {
    forgetAce(this.book, shipId);
  }
}
