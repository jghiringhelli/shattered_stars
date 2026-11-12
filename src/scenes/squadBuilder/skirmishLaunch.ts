/**
 * skirmishLaunch — what pressing LAUNCH on the Skirmish setup fields: the
 * player's planned squad (flagship + wingmen) on team 1 and an AI opponent
 * of the next faction, auto-filled to the same point limit. Pure.
 */

import type { FactionId } from "../../config";
import {
  autoFillSquad,
  makeSquad,
  pickOpponentFaction,
  type GameMode,
  type SquadEntry,
} from "../../core/squadTypes";
import type { WingmenPlan } from "../../systems/setup/wingmen";

/** The 'start' event of the simple flow. */
export interface SkirmishStart {
  readonly factionId: FactionId;
  readonly shipId: string;
  readonly loadoutId: string | null;
}

/**
 * @param start - Faction, flagship and build the player chose.
 * @param plan - The squad the WINGMEN choice fills around the flagship.
 * @param gameMode - Game mode (capitals only fill in "epic").
 * @param pointLimit - Points per side.
 * @returns The player's squad and the opponent's squad.
 */
export function skirmishSquads(
  start: SkirmishStart,
  plan: WingmenPlan,
  gameMode: GameMode,
  pointLimit: number,
): [SquadEntry, SquadEntry] {
  const player: SquadEntry = {
    teamId: 1,
    factionId: start.factionId,
    controller: "player",
    ships: [...plan.ships],
    loadoutChoices: { ...plan.loadoutChoices },
    pointsUsed: plan.pointsUsed,
  };
  const opponent = makeSquad(2, 0, "ai");
  opponent.factionId = pickOpponentFaction(start.factionId);
  autoFillSquad(opponent, gameMode, pointLimit);
  return [player, opponent];
}
