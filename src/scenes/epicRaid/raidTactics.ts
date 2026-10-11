/**
 * raidTactics — how the Boss Raid's squads see the battle and pick shots:
 * - the player's squad clears the escort screen before it turns on the
 *   boss: the boss stays out of its picture while escorts fly, unless the
 *   player marks the boss (the mark redirects the squad onto it);
 * - the boss is a contact for the AI like any ship: a static hulk whose
 *   broadside reaches all around it.
 *
 * Pure: no Phaser.
 */

import type { BotContact } from "../../arcade/ai";
import { BOSS_BROADSIDE_RANGE_PX } from "./bossDefinitions";

/** Side key of the player's raid squad (flagship + wingmen; its mark key). */
export const RAID_PLAYER_SIDE = "player";
/** Side key of the boss and its escorts. */
export const RAID_BOSS_SIDE = "boss_fleet";
/** Prefix of an escort wave's squad key (`escort_wave_1`, ...). */
export const ESCORT_WAVE_PREFIX = "escort_wave_";
/** The boss's broadside fires all around it. */
export const BOSS_CONTACT_ARC_DEG = 360;
/** The boss never moves. */
const BOSS_SPEED = 0;

/** The boss as the AI sees it. */
export interface BossContactSource {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly totalHull: number;
  readonly maxTotalHull: number;
  readonly shields: number;
  readonly maxShields: number;
}

/**
 * @param boss - The boss.
 * @returns The boss as a BotContact on the boss's side.
 */
export function bossContact(boss: BossContactSource): BotContact {
  return {
    id: boss.id,
    side: RAID_BOSS_SIDE,
    definitionId: boss.id,
    x: boss.x,
    y: boss.y,
    angle: boss.angle,
    alive: boss.totalHull > 0,
    hull: boss.totalHull,
    maxHull: boss.maxTotalHull,
    shields: boss.shields,
    maxShields: boss.maxShields,
    firingArcDeg: BOSS_CONTACT_ARC_DEG,
    weaponRange: BOSS_BROADSIDE_RANGE_PX,
    speed: BOSS_SPEED,
  };
}

/** What the player's squad plans against. */
export interface PlayerSquadScreenInput {
  readonly bossId: string;
  /** Whether the player's side has the boss marked right now. */
  readonly bossMarked: boolean;
}

/**
 * The player's squad's picture: the boss is left out while any escort
 * flies, unless the player marked it.
 *
 * @param contacts - Every ship and the boss.
 * @param input - Boss id and whether it is marked.
 * @returns The contacts the player's squad plans against.
 */
export function screenBossUntilEscortsFall(
  contacts: readonly BotContact[],
  input: PlayerSquadScreenInput,
): readonly BotContact[] {
  if (input.bossMarked) return contacts;
  const escortFlies = contacts.some(
    (c) =>
      c.side !== RAID_PLAYER_SIDE &&
      c.id !== input.bossId &&
      c.alive &&
      c.hull > 0,
  );
  return escortFlies ? contacts.filter((c) => c.id !== input.bossId) : contacts;
}

/**
 * @param wave - Escort wave number (1 = the boss's opening screen).
 * @returns The wave's squad key.
 */
export function escortWaveKey(wave: number): string {
  return `${ESCORT_WAVE_PREFIX}${wave}`;
}
