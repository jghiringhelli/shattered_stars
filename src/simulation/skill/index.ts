/**
 * Skill arena — public API: headless battles between the game's AI pilots
 * (src/arcade/ai, re-exported here), series statistics, the lever report
 * and the two piloting gates.
 */

export * from "../../arcade/ai";
export * from "./ArenaRules";
export * from "./ArenaLayout";
export {
  spawnArenaShip,
  contactOf,
  setArenaFlight,
  type ArenaShip,
} from "./ArenaShip";
export { emptyTally, type SideTally, type CombatState } from "./ArenaCombat";
export type { SideId } from "./ArenaCombatState";
export {
  runBattle,
  TICK_MS,
  DEFAULT_TIME_LIMIT_MS,
  type BattleSpec,
  type BattleResult,
  type SideSpec,
  type ShipEntry,
  type SquadSetup,
} from "./SkillArena";
export * from "./ArenaStats";
export * from "./SkillGates";
export * from "./SkillGate2";
export * from "./SkillLevers";
