/**
 * EpicAiFlight — pure flight rules for Boss Raid (EpicBattleScene) AI pilots
 * flying the X-Wing cycle engine.
 */

import { canHullKTurn } from "./AiPursuit";

/** Boss Raid difficulty tiers. */
export type EpicDifficulty = "easy" | "medium" | "hard" | "mythic";

/** Which side an AI ship flies for in a raid. */
export type EpicAiSide = "escort" | "wingman";

/** Difficulties at which boss escorts may K-turn onto a target behind them. */
const ESCORT_KTURN_DIFFICULTIES: ReadonlySet<EpicDifficulty> = new Set([
  "medium",
  "hard",
  "mythic",
]);

/**
 * Whether an AI ship may K-turn. Capital-profile hulls never do; boss escorts
 * only above easy difficulty; the player's wingmen always may.
 *
 * @param definitionId - Ship definition id.
 * @param side - Escort (boss side) or wingman (player side).
 * @param difficulty - Raid difficulty.
 * @returns True when steerAiFlight may queue a K-turn for this ship.
 */
export function mayAiKTurn(
  definitionId: string,
  side: EpicAiSide,
  difficulty: EpicDifficulty,
): boolean {
  if (!canHullKTurn(definitionId)) return false;
  return side === "wingman" || ESCORT_KTURN_DIFFICULTIES.has(difficulty);
}
