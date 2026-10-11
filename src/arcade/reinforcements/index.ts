/**
 * Reinforcement-pool battles — public API. Each side spends a points pool
 * (opening squad included) to keep ships on the field under an on-field
 * cap; destroyed ships are replaced at once (AI) or through the player's
 * picker, following pre-planned strategies and category quotas. A side
 * whose pool runs out loses; at 3:00 destroyed points decide.
 *
 * Pure rules (no Phaser); the scene glue lives in
 * src/scenes/arcadeBattle/reinforcements.
 */

export type * from "./reinforcementTypes";
export * from "./reinforcementRules";
export { ReinforcementError } from "./reinforcementErrors";
export {
  toDeployOption,
  toDeployOptions,
  factionCatalog,
  isFormatShip,
  hasCategory,
} from "./shipOptions";
export {
  createSideLedger,
  deployShip,
  retireShip,
  remainingPoints,
  fieldPoints,
  isOnField,
  categoryCount,
  type SideLedger,
  type FieldEntry,
} from "./poolLedger";
export {
  checkDeploy,
  canEverDeploy,
  isSideExhausted,
  isPermanentBlock,
} from "./quotaRules";
export {
  STRATEGY_IDS,
  STRATEGY_LABELS,
  MAX_RESERVE_ENTRIES,
  isStrategyId,
  strategyRotation,
  buildReserve,
} from "./strategyPresets";
export {
  PATIENT_STRATEGIES,
  HEAVY_THREAT_COUNT,
  COUNTER_LOOKAHEAD,
  createPlannerState,
  planNextDeployment,
  type PlannerState,
  type BattleView,
  type PlanInput,
  type PlanStep,
} from "./strategyPlanner";
export {
  RESERVE_PICKER_ROWS,
  createPlayerReserve,
  nextReserveIndex,
  takeReserve,
  pickerOptions,
  type PlayerReserve,
  type PickerOption,
  type PickerInput,
} from "./reserveQueue";
export {
  decideReinforcedOutcome,
  leaderByDestroyed,
  type ReinforcedSide,
  type ReinforcedResult,
  type ReinforcedEndReason,
  type SideStanding,
} from "./reinforcementOutcome";
export {
  REINFORCEMENTS_BATTLE,
  parseReinforcementSetup,
  parseReserveEntries,
  type ReinforcementSetup,
  type SidePlan,
} from "./reinforcementConfig";
export {
  DEPLOY_EDGE_OFFSET_PX,
  DEPLOY_SPACING_PX,
  DEPLOY_SLOTS,
  sideHome,
  deployPose,
  type DeployPose,
} from "./deployPoints";
export { ArrivalShield } from "./arrivalShield";
export {
  REINFORCEMENT_PREFS_KEY,
  REINFORCEMENT_PREFS_VERSION,
  DEFAULT_REINFORCEMENT_PREFS,
  loadReinforcementPrefs,
  saveReinforcementPrefs,
  type BattleType,
  type ReinforcementPrefs,
} from "./reservePersistence";
export type { SideSummary, CoalitionStats } from "./directorSides";
export { ReinforcementDirector } from "./ReinforcementDirector";
export {
  PICKER_MAX_OPTIONS,
  type DeployPilot,
  type Deployment,
  type DirectorSetup,
  type DirectorSideSetup,
  type PickerView,
} from "./directorTypes";
