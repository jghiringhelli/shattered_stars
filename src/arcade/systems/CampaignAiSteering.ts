/**
 * CampaignAiSteering — who flies a campaign mission's AI ships. Every
 * enemy and every escort is a BotPilot (the same bots the skill gates
 * measure, flying through the player's controls); this module picks its
 * tier. Campaign has no difficulty selector — the mission script is:
 *
 * | ship                          | act 1   | act 2+  |
 * |-------------------------------|---------|---------|
 * | any enemy in a tutorial       | novice  | —       |
 * | regular enemy                 | novice  | average |
 * | ace or boss enemy             | average | expert  |
 * | escort / wingman (player)     | average | average |
 *
 * Act 1 is the learning act: novice squads do not mark targets (see
 * SquadBattleAi), so a newcomer meets focus fire only from act 2 on.
 *
 * Tutorials are each faction's opening missions: mission 1 of act 1 (the
 * navigation course, no enemies) and mission 2 ("First Blood" — the first
 * hostile the player ever meets).
 *
 * Pure: no Phaser.
 */

import type { BotTier } from "../ai/BotTypes";

/** The act whose opening missions are tutorials. */
export const TUTORIAL_ACT = 1;

/** Last tutorial mission number of {@link TUTORIAL_ACT} (the first combat). */
export const TUTORIAL_LAST_MISSION_NUMBER = 2;

/** Tier of every enemy in a tutorial mission. */
export const CAMPAIGN_TUTORIAL_TIER: BotTier = "novice";

/** Tier of a regular mission enemy (act 2 on). */
export const CAMPAIGN_REGULAR_TIER: BotTier = "average";

/** Tier of an ace or boss enemy (act 2 on). */
export const CAMPAIGN_ACE_TIER: BotTier = "expert";

/** The learning act: its enemies fly one tier lower. */
export const LEARNING_ACT = 1;

/** Tier of a regular enemy in the learning act. */
export const LEARNING_REGULAR_TIER: BotTier = "novice";

/** Tier of an ace or boss enemy in the learning act. */
export const LEARNING_ACE_TIER: BotTier = "average";

/** Tier of the player's escorts and wingmen. */
export const CAMPAIGN_ESCORT_TIER: BotTier = "average";

/** Where a mission sits in its faction's campaign. */
export interface MissionPlacement {
  readonly act: number;
  readonly missionNumber: number;
}

/** How a mission script flags an enemy. */
export interface EnemyRank {
  readonly isAce?: boolean;
  readonly isBoss?: boolean;
}

/**
 * @param mission - The mission's act and number.
 * @returns Whether it is one of its faction's opening tutorials.
 */
export function isTutorialMission(mission: MissionPlacement): boolean {
  return (
    mission.act === TUTORIAL_ACT &&
    mission.missionNumber <= TUTORIAL_LAST_MISSION_NUMBER
  );
}

/**
 * @param mission - The mission's act and number.
 * @param enemy - The enemy's ace / boss flags.
 * @returns The tier the enemy's BotPilot flies at.
 */
export function campaignEnemyTier(
  mission: MissionPlacement,
  enemy: EnemyRank,
): BotTier {
  if (isTutorialMission(mission)) return CAMPAIGN_TUTORIAL_TIER;
  const elite = enemy.isAce === true || enemy.isBoss === true;
  if (mission.act === LEARNING_ACT)
    return elite ? LEARNING_ACE_TIER : LEARNING_REGULAR_TIER;
  return elite ? CAMPAIGN_ACE_TIER : CAMPAIGN_REGULAR_TIER;
}
