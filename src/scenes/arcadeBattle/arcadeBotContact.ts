/**
 * arcadeBotContact — a Skirmish ship as the AI layer sees it (BotContact).
 *
 * Every ship in the battle is described to the bots and squad commands
 * through this one builder. Weapon envelope: the ship's mode combat stats
 * (range and firing arc), exactly what its primary weapon fires within —
 * the same envelope every battle mode's bots plan with.
 *
 * Pure: no Phaser.
 */

import type { BotContact } from "../../arcade/ai/BotView";
import { teamKey, type TeamId } from "../../arcade/teams";

/** What the AI reads of a Skirmish ship record. */
export interface BotContactSource {
  readonly id: string;
  readonly team: TeamId;
  readonly definitionId: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
  readonly control: { readonly speed: number };
  readonly stress: { readonly isStressed: boolean };
  readonly combatStats: {
    readonly firingArc: number;
    readonly weaponRange: number;
  };
}

/**
 * @param ship - A Skirmish ship record (its team is its side, never its faction).
 * @returns The ship as BotPilot / SquadCommand see it.
 */
export function toBotContact(ship: BotContactSource): BotContact {
  return {
    id: ship.id,
    side: teamKey(ship.team),
    definitionId: ship.definitionId,
    x: ship.x,
    y: ship.y,
    angle: ship.angle,
    alive: ship.hull > 0,
    hull: Math.max(0, ship.hull),
    maxHull: ship.maxHull,
    shields: Math.max(0, ship.shields),
    maxShields: ship.maxShields,
    firingArcDeg: ship.combatStats.firingArc,
    weaponRange: ship.combatStats.weaponRange,
    speed: ship.control.speed,
    isStressed: ship.stress.isStressed,
  };
}
