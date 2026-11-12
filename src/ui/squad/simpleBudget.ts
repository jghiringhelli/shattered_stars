/**
 * simpleBudget — where the simple Skirmish flow's points go: the player's
 * ship as flown plus the AI wingmen that fill the rest of the limit (the same
 * fill the launch uses, so the preview matches the battle). Pure: no Phaser.
 */

import type { FactionId } from "../../config";
import {
  fillSquadWingmen,
  flownSquadCost,
  type GameMode,
  type SquadEntry,
} from "../../core/squadTypes";
import { planWingmen, type WingmenRequest } from "../../systems/setup/wingmen";

/** What the simple flow's budget strip shows. */
export interface SimplePreview {
  /** Flown cost of the player's ship. */
  readonly ownCost: number;
  /** Cost of the whole squad (ship + wingmen). */
  readonly squadTotal: number;
  readonly limit: number;
  /** True when wingmen were added. */
  readonly wingmen: boolean;
}

/**
 * @param request - The squad the Skirmish launch would fill (faction, flagship, WINGMEN choice, limit).
 * @returns The flagship's cost and the squad total of that fill.
 */
export function previewWingmenSquad(request: WingmenRequest): SimplePreview {
  const plan = planWingmen(request);
  return {
    ownCost: flownSquadCost([request.shipId], plan.loadoutChoices["0"] ? { "0": plan.loadoutChoices["0"] } : {}),
    squadTotal: plan.pointsUsed,
    limit: request.pointLimit,
    wingmen: plan.ships.length > 1,
  };
}

/**
 * @param faction - The player's faction.
 * @param shipId - The chosen ship.
 * @param loadoutId - The chosen quick build (null = bare hull / default build).
 * @param gameMode - Game mode (capitals only fill in "epic").
 * @param limit - Point limit.
 * @returns The ship's cost and the squad total after wingmen fill.
 */
export function previewSimpleSquad(
  faction: FactionId,
  shipId: string,
  loadoutId: string | null,
  gameMode: GameMode,
  limit: number,
): SimplePreview {
  const loadoutChoices = loadoutId ? { "0": loadoutId } : {};
  const ownCost = flownSquadCost([shipId], loadoutChoices);
  const squad: SquadEntry = {
    teamId: 1,
    factionId: faction,
    controller: "player",
    ships: [shipId],
    loadoutChoices: { ...loadoutChoices },
    pointsUsed: ownCost,
  };
  fillSquadWingmen(squad, gameMode, limit);
  return {
    ownCost,
    squadTotal: squad.pointsUsed,
    limit,
    wingmen: squad.ships.length > 1,
  };
}
