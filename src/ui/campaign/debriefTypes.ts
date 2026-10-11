/**
 * debriefTypes — data handed from CampaignBattleScene to DebriefScene, and
 * the stats-screen layout shared by the debrief panels.
 */

import type { FactionId } from "../../config";
import type { CampaignMission } from "../../data/CampaignData";
import type { CampaignSaveData } from "../../systems/CampaignSaveManager";
import type { LevelUpEvent } from "../../systems/CampaignPilotManager";

/** DebriefScene input data. */
export interface DebriefSceneData {
  factionId: FactionId;
  mission: CampaignMission;
  preMissionSave: CampaignSaveData;
  updatedSave: CampaignSaveData;
  xpEarned: number;
  creditsEarned: number;
  kills: number;
  shipsLost: number;
  protagonistBonusXp: number;
  levelUpEvents: LevelUpEvent[];
}

/** Layout of the two stats panels (screen coordinates). */
export const STATS_LAYOUT = {
  leftX: 32,
  rightX: 656,
  width: 592,
  areaTop: 104,
  areaBottom: 620,
  headerHeight: 28,
  padding: 24,
  rowGap: 12,
  resultRowHeight: 60,
  pilotRowHeight: 84,
} as const;

/**
 * Shared height of both stats panels for a given roster size.
 *
 * @param resultRows - Number of mission-result rows.
 * @param pilotRows - Number of pilot rows.
 * @returns Panel height, clamped to the content area.
 */
export function statsPanelHeight(
  resultRows: number,
  pilotRows: number,
): number {
  const L = STATS_LAYOUT;
  const stack = (count: number, rowHeight: number): number =>
    count * rowHeight + Math.max(0, count - 1) * L.rowGap;
  const content = Math.max(
    stack(resultRows, L.resultRowHeight),
    stack(pilotRows, L.pilotRowHeight),
  );
  return Math.min(
    L.headerHeight + L.padding * 2 + content,
    L.areaBottom - L.areaTop,
  );
}

/**
 * Top edge of the stats panels so the pair is centred in the content area.
 *
 * @param height - Panel height.
 * @returns Screen y of the panels' top edge.
 */
export function statsPanelTop(height: number): number {
  const L = STATS_LAYOUT;
  return Math.round((L.areaTop + L.areaBottom - height) / 2);
}

/**
 * Whether the debrief must offer the mission's evolution choice (the
 * mission has one and no pilot has taken either option yet).
 *
 * @param mission - Completed mission.
 * @param save - Save after the mission.
 * @returns True when the evolution panel should be shown.
 */
export function needsEvolutionChoice(
  mission: CampaignMission,
  save: CampaignSaveData,
): boolean {
  const choice = mission.evolutionChoice;
  if (!choice) return false;
  const alreadyChosen = save.campaignPilots.some(
    (p) =>
      p.evolutionChoiceIds.includes(choice.optionA.id) ||
      p.evolutionChoiceIds.includes(choice.optionB.id),
  );
  return !alreadyChosen;
}
