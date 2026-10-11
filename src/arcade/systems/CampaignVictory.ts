/**
 * CampaignVictory — assembles what a won mission adds to the campaign save:
 * base rewards (credits scaled by Salvage Protocols-style bonuses), bonus
 * objective awards (research + credits, plus research per bonus from
 * research), bonus XP, pilot XP, story flags (scripted + the mission's own
 * victory flags), branch slot, evolution and finale. Pure.
 */

import type { ObjectiveDefinition } from "../objectives";
import type { CampaignShipBonuses } from "../../campaign/armory/bonusTypes";
import {
  branchSlotKey,
  isFinaleMission,
} from "../../campaign/hub/missionGraph";
import type {
  MissionCompletionRecord,
  BonusAward,
} from "../../campaign/save/missionCompletion";
import type { CampaignSaveData } from "../../campaign/save/campaignSaveTypes";
import type {
  CampaignMission,
  FactionCampaign,
} from "../../data/campaign/campaignTypes";
import { CAMPAIGN_PILOTS } from "../../data/PilotData";
import {
  distributeMissionXp,
  type LevelUpEvent,
} from "../../systems/CampaignPilotManager";

/** Bonus XP of a bonus objective that names none. */
export const DEFAULT_BONUS_XP = 50;
/** Research a bonus objective grants when it names none. */
export const DEFAULT_BONUS_RESEARCH = 1;

/** Inputs of a victory. */
export interface VictoryInput {
  readonly mission: CampaignMission;
  readonly campaign: FactionCampaign;
  readonly save: CampaignSaveData;
  /** Bonus objectives completed. */
  readonly bonuses: readonly ObjectiveDefinition[];
  /** Story flags the script persisted. */
  readonly storyFlags: Readonly<Record<string, boolean>>;
  readonly kills: number;
  readonly shipsLost: number;
  /** Armory + research bonuses in force. */
  readonly bonusesActive: CampaignShipBonuses;
}

/** The record plus presentation extras for the debrief. */
export interface VictoryRewards {
  readonly record: MissionCompletionRecord;
  readonly bonusXp: number;
  readonly levelUpEvents: LevelUpEvent[];
}

/**
 * @param def - A completed bonus objective.
 * @param bonuses - Bonuses in force.
 * @returns Its research/credit award.
 */
function awardOf(
  def: ObjectiveDefinition,
  bonuses: CampaignShipBonuses,
): BonusAward {
  return {
    objectiveId: def.id,
    research:
      (def.reward?.research ?? DEFAULT_BONUS_RESEARCH) +
      bonuses.researchPerBonus,
    credits: def.reward?.credits ?? 0,
  };
}

/**
 * @param input - The victory.
 * @returns What it adds to the save.
 */
export function missionVictoryRecord(input: VictoryInput): VictoryRewards {
  const { mission, save, bonusesActive } = input;
  const bonusXp = input.bonuses.reduce(
    (sum, b) => sum + (b.reward?.xp ?? b.xpBonus ?? DEFAULT_BONUS_XP),
    0,
  );
  const { updatedPilots, levelUpEvents } = distributeMissionXp(
    save.campaignPilots,
    CAMPAIGN_PILOTS[save.factionId] ?? [],
    mission.rewards.xp,
    bonusXp,
  );
  const record: MissionCompletionRecord = {
    missionId: mission.id,
    branchSlot: branchSlotKey(mission),
    xp: mission.rewards.xp + bonusXp,
    credits: Math.round(
      mission.rewards.credits * bonusesActive.creditMultiplier,
    ),
    kills: input.kills,
    shipsLost: input.shipsLost,
    unlocks: mission.rewards.unlocks ?? [],
    pilots: updatedPilots,
    pendingEvolution: mission.evolutionChoice !== undefined,
    storyFlags: { ...input.storyFlags, ...(mission.victoryFlags ?? {}) },
    bonuses: input.bonuses.map((b) => awardOf(b, bonusesActive)),
    isFinale: isFinaleMission(mission, input.campaign),
  };
  return { record, bonusXp, levelUpEvents };
}
