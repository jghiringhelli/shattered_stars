/**
 * victoryLines — the on-win phase's hand-off to the debrief: dialogue of the
 * beats that play after the win condition fires opens the debrief, ahead of
 * the mission's own debrief lines. Pure.
 */

import type {
  CampaignMission,
  DebriefLine,
} from "../../data/campaign/campaignTypes";

/**
 * @param mission - The mission that was won.
 * @param victoryLines - Dialogue from the on-win phase (may be empty).
 * @returns The mission whose debrief opens with those lines (the same
 *   mission when there are none); the input is never mutated.
 */
export function withVictoryLines(
  mission: CampaignMission,
  victoryLines: readonly DebriefLine[],
): CampaignMission {
  if (victoryLines.length === 0) return mission;
  return { ...mission, debrief: [...victoryLines, ...(mission.debrief ?? [])] };
}
