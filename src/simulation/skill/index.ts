/**
 * Skill arena — public API. Headless bot pilots of three skill tiers flying
 * the real engine, battles, series statistics and the two piloting gates.
 */

export * from "./SkillTypes";
export * from "./ArenaGeometry";
export * from "./ArenaRules";
export * from "./ArenaLayout";
export { PilotHands, THROTTLE_TAP_GAP_MS } from "./PilotHands";
export { SnapshotHistory } from "./Perception";
export {
  spawnArenaShip,
  snapshotOf,
  ownViewOf,
  type ArenaShip,
} from "./ArenaShip";
export { emptyTally, type SideTally, type CombatState } from "./ArenaCombat";
export {
  runBattle,
  TICK_MS,
  DEFAULT_TIME_LIMIT_MS,
  type BattleSpec,
  type BattleResult,
  type SideSpec,
  type ShipEntry,
} from "./SkillArena";
export * from "./ArenaStats";
export * from "./SkillGates";
export * from "./SkillLevers";
export { createBot } from "./bots/BotFactory";
export { TIER_PROFILES } from "./bots/BotKit";
export { NoviceBot } from "./bots/NoviceBot";
export { AverageBot } from "./bots/AverageBot";
export { ExpertBot } from "./bots/ExpertBot";
export {
  SquadCoordinator,
  DEFAULT_COORDINATION,
  type CoordinationOptions,
} from "./bots/SquadCoordinator";
export {
  planManeuver,
  EXPERT_WEIGHTS,
  type PlanWeights,
} from "./bots/ManeuverPlanner";
