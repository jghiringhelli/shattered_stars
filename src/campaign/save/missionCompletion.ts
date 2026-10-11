/**
 * missionCompletion — folds a won mission into the campaign save: progress,
 * rewards, story flags, branch choice, bonus objectives (rewarded once per
 * playthrough), hero power unlocks and campaign completion. Pure; the save
 * manager persists the result (autosave).
 */

import { heroPowerRanksFor } from "../powers/heroPowerState";
import type { CampaignPilotState, CampaignSaveData } from "./campaignSaveTypes";

/** A bonus objective completed in the mission and what it grants. */
export interface BonusAward {
  readonly objectiveId: string;
  readonly research: number;
  readonly credits: number;
}

/** Everything a won mission adds to the save. */
export interface MissionCompletionRecord {
  readonly missionId: string;
  /** Branch slot key when the mission was one of a branch pair. */
  readonly branchSlot?: string | undefined;
  readonly xp: number;
  readonly credits: number;
  readonly kills: number;
  readonly shipsLost: number;
  readonly unlocks: readonly string[];
  readonly pilots?: CampaignPilotState[] | undefined;
  readonly pendingEvolution?: boolean | undefined;
  readonly storyFlags?: Readonly<Record<string, boolean>> | undefined;
  readonly bonuses?: readonly BonusAward[] | undefined;
  /** The campaign's final mission. */
  readonly isFinale?: boolean | undefined;
}

/** The new save plus what bonuses actually paid out. */
export interface CompletionResult {
  readonly save: CampaignSaveData;
  readonly researchEarned: number;
  readonly bonusCredits: number;
}

/**
 * @param save - Save before the mission.
 * @param record - What the mission earned.
 * @returns The updated save and the bonus payout.
 */
export function applyMissionCompletion(
  save: CampaignSaveData,
  record: MissionCompletionRecord,
): CompletionResult {
  const firstTime = !save.completedMissions.includes(record.missionId);
  const completedMissions = firstTime
    ? [...save.completedMissions, record.missionId]
    : [...save.completedMissions];
  const fresh = (record.bonuses ?? []).filter(
    (b) =>
      !save.bonusObjectivesCompleted.includes(
        `${record.missionId}:${b.objectiveId}`,
      ),
  );
  const researchEarned = fresh.reduce((sum, b) => sum + b.research, 0);
  const bonusCredits = fresh.reduce((sum, b) => sum + b.credits, 0);
  const derivedRanks = heroPowerRanksFor(
    save.factionId,
    completedMissions.length,
  );
  const heroPowerRanks: Record<string, number> = { ...save.heroPowerRanks };
  for (const [id, rank] of Object.entries(derivedRanks)) {
    heroPowerRanks[id] = Math.max(heroPowerRanks[id] ?? 0, rank);
  }
  const next: CampaignSaveData = {
    ...save,
    completedMissions,
    currentMission: save.currentMission + (firstTime ? 1 : 0),
    totalXp: save.totalXp + record.xp,
    credits: save.credits + record.credits + bonusCredits,
    totalKills: save.totalKills + record.kills,
    shipsLost: save.shipsLost + record.shipsLost,
    unlockedShips: [...new Set([...save.unlockedShips, ...record.unlocks])],
    campaignPilots: record.pilots ?? save.campaignPilots,
    pendingEvolution: record.pendingEvolution ?? save.pendingEvolution,
    storyFlags: { ...save.storyFlags, ...(record.storyFlags ?? {}) },
    branchChoices: record.branchSlot
      ? { ...save.branchChoices, [record.branchSlot]: record.missionId }
      : { ...save.branchChoices },
    researchPoints: save.researchPoints + researchEarned,
    bonusObjectivesCompleted: [
      ...save.bonusObjectivesCompleted,
      ...fresh.map((b) => `${record.missionId}:${b.objectiveId}`),
    ],
    heroPowerRanks,
    campaignComplete: save.campaignComplete || record.isFinale === true,
  };
  return { save: next, researchEarned, bonusCredits };
}
