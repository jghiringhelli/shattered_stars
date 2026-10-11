/**
 * arcadeBotContact — a Skirmish ship as the AI layer sees it (BotContact).
 *
 * Every ship in the battle is described to the bots and squad commands
 * through this one builder. Weapon envelope: this scene's lasers are real
 * projectiles, fired by the AI inside its firing cone and reach
 * (aiFiringSolution), so that is the arc and range the bots plan with.
 *
 * Pure: no Phaser.
 */

import type { BotContact } from "../../arcade/ai/BotView";
import { AI_AIM_CONE_DEG, AI_MAX_FIRE_RANGE_PX } from "./aiFiringSolution";

/** Full firing arc a Skirmish ship is described with (°): the AI's aim cone, both sides. */
export const SKIRMISH_FIRING_ARC_DEG = AI_AIM_CONE_DEG * 2;

/** Primary reach a Skirmish ship is described with (px): the AI's firing range. */
export const SKIRMISH_WEAPON_RANGE_PX = AI_MAX_FIRE_RANGE_PX;

/** What the AI reads of a Skirmish ship record. */
export interface BotContactSource {
  readonly id: string;
  readonly faction: string;
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
}

/**
 * @param ship - A Skirmish ship record (its faction is its side).
 * @returns The ship as BotPilot / SquadCommand see it.
 */
export function toBotContact(ship: BotContactSource): BotContact {
  return {
    id: ship.id,
    side: ship.faction,
    definitionId: ship.definitionId,
    x: ship.x,
    y: ship.y,
    angle: ship.angle,
    alive: ship.hull > 0,
    hull: Math.max(0, ship.hull),
    maxHull: ship.maxHull,
    shields: Math.max(0, ship.shields),
    maxShields: ship.maxShields,
    firingArcDeg: SKIRMISH_FIRING_ARC_DEG,
    weaponRange: SKIRMISH_WEAPON_RANGE_PX,
    speed: ship.control.speed,
    isStressed: ship.stress.isStressed,
  };
}
