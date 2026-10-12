/**
 * crewSkill — how a simulated side's AI pilots are crewed: one skill for
 * every ship (a duel tier, the player's wingmen) or a difficulty label's
 * squad plan (BotDifficulty.squadSkillPlan: a skill per ship slot and
 * whether the leader marks), the way ArcadeBotFleet crews a Skirmish side.
 *
 * Pure: no Phaser.
 */

import {
  botProfile,
  squadLeaderSkill,
  squadSlotSkill,
  type SquadSkillPlan,
} from "../arcade/ai/BotDifficulty";
import type { SideSkill } from "./arenaLoop";
import type { SquadSetup } from "./skill/ArenaSpec";

/** One skill for every ship, or a slot plan. */
export type CrewSkill = SideSkill | SquadSkillPlan;

/**
 * @param crew - A side's crew.
 * @returns Whether it is a slot plan.
 */
export function isSquadPlan(crew: CrewSkill): crew is SquadSkillPlan {
  return "slots" in crew;
}

/**
 * @param crew - A side's crew.
 * @param slot - The ship's slot on its side (0-based, reinforcements continue).
 * @returns The skill that ship flies with.
 */
export function crewSlotSkill(crew: CrewSkill, slot: number): SideSkill {
  return isSquadPlan(crew) ? squadSlotSkill(crew, slot) : crew;
}

/**
 * @param crew - A side's crew.
 * @returns Its squad layer: a plan's leader marks only when the plan says
 *   so and perceives at its quickest pilot's reaction; a single skill keeps
 *   the arena's defaults (AI leader, average reaction).
 */
export function crewSquadSetup(crew: CrewSkill): SquadSetup {
  if (!isSquadPlan(crew)) return {};
  const leader = squadLeaderSkill(crew);
  return {
    aiLeader: crew.marks,
    reactionMs: botProfile(leader.tier, leader.reactionScale).reactionMs,
  };
}
