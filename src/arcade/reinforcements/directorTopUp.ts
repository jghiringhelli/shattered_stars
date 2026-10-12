/**
 * directorTopUp — what one squad of a team deploys next to fill the
 * team's free field room: a human squad's next reserve ship (its human's
 * wingmen, at once), an AI squad's next ship of its strategy plan (after
 * the team's AI deploy delay). The director deploys the step before asking
 * the next squad, so squads share the team's pool and cap in turn.
 *
 * Pure.
 */

import type { ShipRole } from "../../core/types";
import type { DeployPilot } from "./directorTypes";
import type { MemberState } from "./directorMembers";
import { withMember, type SideState } from "./directorSides";
import { nextReserveIndex, takeReserve } from "./reserveQueue";
import { planNextDeployment } from "./strategyPlanner";
import type { DeployOption, ReinforcementRules } from "./reinforcementTypes";

/** What a top-up reads of the battle. */
export interface TopUpContext {
  readonly rules: ReinforcementRules;
  readonly elapsedMs: number;
  /** Roles of the living ships of the other teams. */
  readonly opposingRoles: readonly ShipRole[];
}

/** One squad's top-up step. */
export interface TopUpStep {
  /** The team with the squad's plan or reserve advanced. */
  readonly side: SideState;
  /** The ship to deploy, or null when the squad deploys nothing now. */
  readonly option: DeployOption | null;
  readonly pilot: DeployPilot;
}

/**
 * @param side - The team.
 * @param member - One of its squads.
 * @param context - Rules, clock, opposing roles.
 * @returns The squad's next deployment (or none) and the advanced team.
 */
export function nextTopUp(
  side: SideState,
  member: MemberState,
  context: TopUpContext,
): TopUpStep {
  return member.human
    ? nextWingman(side, member, context.rules)
    : nextAiShip(side, member, context);
}

function nextWingman(
  side: SideState,
  member: MemberState,
  rules: ReinforcementRules,
): TopUpStep {
  const index = nextReserveIndex(member.reserve, side.ledger, rules.quotas);
  if (index === null) return { side, option: null, pilot: "wingman" };
  return {
    side: withMember(side, member.key, (m) => ({
      ...m,
      reserve: takeReserve(m.reserve, index),
    })),
    option: member.reserve.entries[index]!,
    pilot: "wingman",
  };
}

function nextAiShip(
  side: SideState,
  member: MemberState,
  context: TopUpContext,
): TopUpStep {
  if (context.elapsedMs < side.readyAtMs)
    return { side, option: null, pilot: "ai" };
  const step = planNextDeployment({
    strategy: member.strategy,
    state: member.planner,
    ledger: side.ledger,
    quotas: context.rules.quotas,
    battle: { opposingRoles: context.opposingRoles },
  });
  return {
    side: withMember(side, member.key, (m) => ({ ...m, planner: step.state })),
    option: step.option,
    pilot: "ai",
  };
}
