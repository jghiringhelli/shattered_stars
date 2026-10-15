/**
 * strategyPlanner — an AI side's next reinforcement: it follows its
 * strategy's rotation (the head ship first) within the pool, the field cap
 * and the quotas, and reads the battle:
 * - a ship the side can never deploy again (pool spent, match quota used)
 *   is dropped from the plan;
 * - a head ship blocked for now (no room under the cap, field quota, its
 *   unique pilot still flying): patient strategies (Aces, Heavy-Bombers)
 *   wait for room for it (none is by default); eager ones fill the room with
 *   the first later ship that fits;
 * - Balanced counters a heavy enemy field (bombers, gunships, capitals) by
 *   pulling an interceptor or heavy fighter forward from its next ships.
 *
 * Pure.
 */

import type { ShipRole } from "../../core/types";
import type { SideLedger } from "./poolLedger";
import { canEverDeploy, checkDeploy } from "./quotaRules";
import type { DeployOption, QuotaRule, StrategyId } from "./reinforcementTypes";

/**
 * Strategies that hold field room for their planned ship. None does: Aces and
 * Heavy-Bombers used to (their expensive head ship waited while Balanced
 * filled the room) and measured 8–10 points weaker than eager play.
 */
export const PATIENT_STRATEGIES: Set<StrategyId> = new Set<StrategyId>();

/** Heavy enemy ships on the field that make Balanced counter-pick. */
export const HEAVY_THREAT_COUNT = 2;

/** How many of its next ships Balanced looks through for a counter. */
export const COUNTER_LOOKAHEAD = 3;

/** The counter-pick knobs above as one table the balance sweeps tune. */
export const PLANNER_TUNING = {
  heavyThreatCount: HEAVY_THREAT_COUNT,
  counterLookahead: COUNTER_LOOKAHEAD,
};

const HEAVY_ROLES: ReadonlySet<ShipRole> = new Set([
  "bomber",
  "gunship",
  "capital",
]);
const COUNTER_ROLES: ReadonlySet<ShipRole> = new Set([
  "interceptor",
  "heavy_fighter",
]);

/** Where a side is in its plan. */
export interface PlannerState {
  readonly rotation: readonly DeployOption[];
  /** Index of the head ship. */
  readonly cursor: number;
}

/** What the planner sees of the battle. */
export interface BattleView {
  /** Roles of the living enemy ships. */
  readonly opposingRoles: readonly ShipRole[];
}

/** One planning call. */
export interface PlanInput {
  readonly strategy: StrategyId;
  readonly state: PlannerState;
  readonly ledger: SideLedger;
  readonly quotas: readonly QuotaRule[];
  readonly battle: BattleView;
}

/** The planner's answer: a ship to deploy now (or none) and the new plan state. */
export interface PlanStep {
  readonly option: DeployOption | null;
  readonly state: PlannerState;
}

/**
 * @param rotation - The strategy's repeating order of ships.
 * @returns A plan at its first ship.
 */
export function createPlannerState(
  rotation: readonly DeployOption[],
): PlannerState {
  return { rotation, cursor: 0 };
}

/**
 * @param input - Strategy, plan, the side's accounts and the battle.
 * @returns What to deploy now (null = nothing) and the updated plan.
 */
export function planNextDeployment(input: PlanInput): PlanStep {
  const state = dropUnreachableHeads(input);
  const { rotation } = state;
  if (rotation.length === 0) return { option: null, state };
  const allowed = (o: DeployOption): boolean =>
    checkDeploy(input.ledger, input.quotas, o).allowed;
  const head = rotation[state.cursor]!;
  const upcoming = Array.from(
    { length: rotation.length - 1 },
    (_, i) => rotation[(state.cursor + 1 + i) % rotation.length]!,
  );
  if (allowed(head)) {
    const counter = counterPick(input, head, upcoming, allowed);
    if (counter) return { option: counter, state };
    return { option: head, state: advance(state) };
  }
  if (PATIENT_STRATEGIES.has(input.strategy)) return { option: null, state };
  return { option: upcoming.find(allowed) ?? null, state };
}

/** Skips head ships the side can never deploy again (at most one lap). */
function dropUnreachableHeads(input: PlanInput): PlannerState {
  let state = input.state;
  for (let i = 0; i < state.rotation.length; i++) {
    const head = state.rotation[state.cursor]!;
    if (canEverDeploy(input.ledger, input.quotas, head)) return state;
    state = advance(state);
  }
  return state;
}

function counterPick(
  input: PlanInput,
  head: DeployOption,
  upcoming: readonly DeployOption[],
  allowed: (o: DeployOption) => boolean,
): DeployOption | null {
  if (input.strategy !== "balanced" || COUNTER_ROLES.has(head.role))
    return null;
  const threats = input.battle.opposingRoles.filter((role) =>
    HEAVY_ROLES.has(role),
  ).length;
  if (threats < PLANNER_TUNING.heavyThreatCount) return null;
  return (
    upcoming
      .slice(0, PLANNER_TUNING.counterLookahead)
      .find((o) => COUNTER_ROLES.has(o.role) && allowed(o)) ?? null
  );
}

function advance(state: PlannerState): PlannerState {
  const length = Math.max(1, state.rotation.length);
  return { ...state, cursor: (state.cursor + 1) % length };
}
