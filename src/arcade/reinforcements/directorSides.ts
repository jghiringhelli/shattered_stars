/**
 * directorSides — the per-side state a reinforced match keeps (ledger, AI
 * plan or player reserve, arrival counter, when it may next deploy) and the
 * read-only summaries the HUD, end screen and telemetry show.
 *
 * Pure.
 */

import type { ShipRole } from "../../core/types";
import {
  createSideLedger,
  fieldPoints,
  remainingPoints,
  type SideLedger,
} from "./poolLedger";
import { PICKER_MAX_OPTIONS } from "./directorTypes";
import { isSideExhausted } from "./quotaRules";
import type { ReinforcedSide, SideStanding } from "./reinforcementOutcome";
import {
  pickerOptions,
  type PickerOption,
  type PlayerReserve,
} from "./reserveQueue";
import type { PlannerState } from "./strategyPlanner";
import type {
  DeployOption,
  ReinforcementRules,
  StrategyId,
} from "./reinforcementTypes";

/** One side's runtime state. */
export interface SideState {
  readonly faction: string;
  readonly isPlayerSide: boolean;
  readonly strategy: StrategyId;
  readonly ledger: SideLedger;
  /** AI sides: the strategy plan. */
  readonly planner: PlannerState;
  /** The player's side: the reserve. */
  readonly reserve: PlayerReserve;
  /** Reinforcements deployed (numbers arrival slots). */
  readonly arrivals: number;
  /** Battle time from which the side may deploy (AI deploy delay). */
  readonly readyAtMs: number;
}

/** What the HUD and end screen show of a side. */
export interface SideSummary {
  readonly faction: string;
  readonly isPlayerSide: boolean;
  readonly poolPoints: number;
  readonly remainingPoints: number;
  readonly fieldPoints: number;
  readonly fieldCapPoints: number;
  readonly deployedCount: number;
  readonly lostCount: number;
  readonly lostPoints: number;
  readonly exhausted: boolean;
}

/** A coalition's totals (the player's side vs everyone else). */
export interface CoalitionStats {
  readonly deployed: number;
  readonly lost: number;
  readonly lostPoints: number;
  /** Points of opposing ships destroyed. */
  readonly destroyedPoints: number;
  readonly remainingPoints: number;
}

/**
 * @param rules - Match rules.
 * @param faction - The side's faction.
 * @param isPlayerSide - Whether the human flies for it.
 * @param strategy - Its strategy.
 * @param plan - AI: the rotation; the player's side: the reserve.
 * @returns A fresh side.
 */
export function createSideState(
  rules: ReinforcementRules,
  faction: string,
  isPlayerSide: boolean,
  strategy: StrategyId,
  plan: readonly DeployOption[],
): SideState {
  return {
    faction,
    isPlayerSide,
    strategy,
    ledger: createSideLedger(rules),
    planner: { rotation: plan, cursor: 0 },
    reserve: { entries: plan, cursor: 0 },
    arrivals: 0,
    readyAtMs: 0,
  };
}

/**
 * @param side - A side.
 * @param rules - Match rules.
 * @param playerCatalog - Extra ships the player may pick (open choice).
 * @returns Whether it has nothing alive and nothing it can deploy.
 */
export function sideExhausted(
  side: SideState,
  rules: ReinforcementRules,
  playerCatalog: readonly DeployOption[],
): boolean {
  const options = side.isPlayerSide
    ? [
        ...side.reserve.entries,
        ...(rules.choice === "open" ? playerCatalog : []),
      ]
    : side.planner.rotation;
  return isSideExhausted(side.ledger, rules.quotas, options);
}

/**
 * @param side - A side.
 * @param exhausted - Whether it is exhausted.
 * @returns Its summary.
 */
export function summarize(side: SideState, exhausted: boolean): SideSummary {
  const { ledger } = side;
  return {
    faction: side.faction,
    isPlayerSide: side.isPlayerSide,
    poolPoints: ledger.poolPoints,
    remainingPoints: remainingPoints(ledger),
    fieldPoints: fieldPoints(ledger),
    fieldCapPoints: ledger.fieldCapPoints,
    deployedCount: ledger.deployedCount,
    lostCount: ledger.lostCount,
    lostPoints: ledger.lostPoints,
    exhausted,
  };
}

/**
 * @param own - The coalition's sides.
 * @param opposing - The other coalition's sides.
 * @returns The coalition's totals.
 */
export function coalitionStats(
  own: readonly SideState[],
  opposing: readonly SideState[],
): CoalitionStats {
  const sum = (sides: readonly SideState[], pick: (l: SideLedger) => number) =>
    sides.reduce((total, side) => total + pick(side.ledger), 0);
  return {
    deployed: sum(own, (l) => l.deployedCount),
    lost: sum(own, (l) => l.lostCount),
    lostPoints: sum(own, (l) => l.lostPoints),
    destroyedPoints: sum(opposing, (l) => l.lostPoints),
    remainingPoints: sum(own, remainingPoints),
  };
}

/**
 * @param sides - Every side.
 * @param playerSide - The player's coalition (true) or the opponents' (false).
 * @returns The coalition's sides.
 */
export function coalitionOf(
  sides: Iterable<SideState>,
  playerSide: boolean,
): SideState[] {
  return [...sides].filter((side) => side.isPlayerSide === playerSide);
}

/**
 * @param sides - Every side.
 * @param faction - A side.
 * @returns Roles of every living ship of the other sides.
 */
export function opposingRolesOf(
  sides: Iterable<SideState>,
  faction: string,
): ShipRole[] {
  return [...sides]
    .filter((side) => side.faction !== faction)
    .flatMap((side) => [...side.ledger.field.values()].map((e) => e.role));
}

/**
 * @param side - The player's side.
 * @param count - How many.
 * @returns The next reserve ships from the cursor on (repeating).
 */
export function reservePreviewOf(
  side: SideState,
  count: number,
): DeployOption[] {
  const { entries, cursor } = side.reserve;
  if (entries.length === 0) return [];
  return Array.from(
    { length: count },
    (_, i) => entries[(cursor + i) % entries.length]!,
  );
}

/**
 * @param sides - Every side.
 * @returns The sides, the player's first.
 */
export function playerSideFirst(sides: Iterable<SideState>): SideState[] {
  return [...sides].sort(
    (a, b) => Number(b.isPlayerSide) - Number(a.isPlayerSide),
  );
}

/**
 * @param sides - Every side.
 * @returns Both coalitions' totals.
 */
export function matchTotals(
  sides: Iterable<SideState>,
): Readonly<Record<ReinforcedSide, CoalitionStats>> {
  const all = [...sides];
  const player = coalitionOf(all, true);
  const enemy = coalitionOf(all, false);
  return {
    player: coalitionStats(player, enemy),
    enemy: coalitionStats(enemy, player),
  };
}

/**
 * @param side - The player's side.
 * @param rules - Match rules.
 * @param catalog - Ships the player may pick besides the reserve.
 * @returns The picker rows.
 */
export function pickerRowsFor(
  side: SideState,
  rules: ReinforcementRules,
  catalog: readonly DeployOption[],
): PickerOption[] {
  return pickerOptions({
    reserve: side.reserve,
    catalog,
    choice: rules.choice,
    ledger: side.ledger,
    quotas: rules.quotas,
    maxOptions: PICKER_MAX_OPTIONS,
  });
}

/**
 * @param coalition - One coalition's sides.
 * @param rules - Match rules.
 * @param playerCatalog - Extra ships the player may pick.
 * @returns Whether every side of it is exhausted.
 */
export function coalitionExhausted(
  coalition: readonly SideState[],
  rules: ReinforcementRules,
  playerCatalog: readonly DeployOption[],
): boolean {
  return coalition.every((side) => sideExhausted(side, rules, playerCatalog));
}

/**
 * @param sides - Every side.
 * @param rules - Match rules.
 * @param playerCatalog - Extra ships the player may pick.
 * @returns Both coalitions as the outcome reads them.
 */
export function standingsOf(
  sides: Iterable<SideState>,
  rules: ReinforcementRules,
  playerCatalog: readonly DeployOption[],
): Readonly<Record<ReinforcedSide, SideStanding>> {
  const all = [...sides];
  const totals = matchTotals(all);
  const standing = (
    playerSide: boolean,
    side: ReinforcedSide,
  ): SideStanding => ({
    exhausted: coalitionExhausted(
      coalitionOf(all, playerSide),
      rules,
      playerCatalog,
    ),
    destroyedPoints: totals[side].destroyedPoints,
  });
  return { player: standing(true, "player"), enemy: standing(false, "enemy") };
}
