/**
 * Arcade AI — public API. The in-game AI and the skill gates fly the same
 * pilots: scenes give each AI ship a BotPilot (tier from difficultyToTier)
 * and each squad side a SquadCommand (orders + squad mark).
 *
 * Pure: no Phaser anywhere under src/arcade/ai.
 */

export {
  BotPilot,
  type BotFlightFrame,
  type BotPilotOptions,
} from "./BotPilot";
export {
  SquadCommand,
  SQUAD_PLAN_INTERVAL_MS,
  type SquadCommandFrame,
  type SquadCommandOptions,
} from "./SquadCommand";
export {
  difficultyToTier,
  botProfile,
  squadLeaderSkill,
  squadSkillPlan,
  squadSlotSkill,
  BRUTAL_REACTION_SCALE,
  EASY_REACTION_SCALE,
  HARD_REACTION_SCALE,
  DEFAULT_BOT_SKILL,
  type BotSkill,
  type DuelMode,
  type SquadFormat,
  type SquadSkillPlan,
} from "./BotDifficulty";
export {
  contactSnapshot,
  ownShipView,
  type BotContact,
  type OwnShipInput,
} from "./BotView";
export * from "./BotTypes";
export * from "./AiGeometry";
export { PilotHands, THROTTLE_TAP_GAP_MS } from "./PilotHands";
export { SnapshotHistory } from "./Perception";
export { createBot } from "./bots/BotFactory";
export { TIER_PROFILES } from "./bots/BotKit";
export { NoviceBot } from "./bots/NoviceBot";
export { AverageBot, AVERAGE_WEIGHTS } from "./bots/AverageBot";
export { ExpertBot } from "./bots/ExpertBot";
export {
  SquadCoordinator,
  DEFAULT_COORDINATION,
  type CoordinationOptions,
} from "./SquadCoordinator";
export {
  planManeuver,
  EXPERT_WEIGHTS,
  type PlanWeights,
} from "./bots/ManeuverPlanner";
