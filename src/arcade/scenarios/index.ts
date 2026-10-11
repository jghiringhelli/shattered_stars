/**
 * Scenario mode — public API. X-Wing Miniatures 2.0 scenarios (Assault at
 * the Satellite Array, Chance Engagement, Salvage Mission, Scramble the
 * Transmissions) adapted to the real-time battle: pure rules, deployment
 * and the squad layer's objective assignments. Scenes build a
 * ScenarioFrame per tick and step the match.
 */

export type * from "./scenarioTypes";
export * from "./scenarioConstants";
export {
  SCENARIO_DEFINITIONS,
  SCENARIO_IDS,
  CHANCE_ENGAGEMENT_QUIET_ROUNDS,
  isScenarioId,
  type ScenarioDefinition,
  type ObjectiveSlot,
} from "./scenarioDefinitions";
export {
  controlWeight,
  resolveControl,
  stepControlZones,
  zonesHeldBy,
} from "./controlRules";
export {
  scenarioShipValue,
  halfValue,
  opponentOf,
  scoreDestruction,
  type DestructionStep,
} from "./destructionScoring";
export {
  createCrates,
  stepSalvage,
  cratesCarriedBy,
  type SalvageStepInput,
  type SalvageStepResult,
} from "./salvageRules";
export { stepScrambleNode, nodesOwnedBy } from "./scrambleRules";
export {
  decideOutcome,
  leaderByPoints,
  totalPoints,
  type OutcomeInput,
} from "./scenarioOutcome";
export {
  createScenarioState,
  stepScenario,
  withBonusPoints,
  roundAwards,
  type ScenarioState,
} from "./scenarioMatch";
export {
  deploymentPoses,
  homePoint,
  type DeployPose,
} from "./scenarioDeployment";
export {
  HOLD_LEASH_FRACTION,
  HUNT_LEASH_PX,
  STICKY_ASSIGNMENT_PX,
  URGENCY_WEIGHT_PX,
  objectiveRunnerCount,
  planScenarioSide,
  steeringGoal,
  type PlannerShip,
  type ScenarioDirective,
  type ScenarioRole,
  type SidePlanInput,
} from "./scenarioAi";
