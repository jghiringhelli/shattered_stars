/**
 * roleValue — what a hull is worth per point in squads: mono-hull squads
 * (each copy on its default quick build, priced at that build) at the two
 * sizes that bracket the budget fight the reference lists; their win
 * shares are interpolated in log-odds to exactly the budget. A squad that
 * still wins more than half at the budget is under-costed.
 *
 * Pure: no Phaser.
 */

import { getShipDefinition } from "../../data/ShipDefinitions";
import { addTallies, EMPTY_TALLY, logit, shareInterval } from "./balanceStats";
import { runSquadMatchup } from "./squadMatchup";
import { listCost, withQuickBuilds, type SquadList } from "./squadLists";

/** Most copies of one hull a sweep squad fields. */
export const MAX_SWEEP_COPIES = 10;

/** One hull's value measurement. */
export interface ShipValue {
  readonly definitionId: string;
  readonly role: string;
  readonly faction: string;
  /** Bare hull price. */
  readonly hullCost: number;
  /** The two bracketing squads: size, cost and win share vs the references. */
  readonly low: SweepPoint;
  readonly high: SweepPoint;
  /** Log-odds of the win share interpolated to the budget. */
  readonly logitAtBudget: number;
}

/** One sweep squad's result. */
export interface SweepPoint {
  readonly copies: number;
  readonly cost: number;
  readonly share: number;
  readonly games: number;
}

/** What one hull's sweep needs. */
export interface ShipValueSpec {
  readonly definitionId: string;
  readonly references: readonly SquadList[];
  readonly seeds: readonly number[];
  readonly budget: number;
}

/**
 * @param definitionId - A hull.
 * @param copies - How many.
 * @returns A mono-hull squad on default quick builds.
 */
export function monoBuildList(definitionId: string, copies: number): SquadList {
  const def = getShipDefinition(definitionId);
  return {
    label: `${copies}× ${def?.name ?? definitionId}`,
    faction: def?.faction ?? "free_confederation",
    ships: withQuickBuilds(Array.from({ length: copies }, () => definitionId)),
  };
}

/**
 * @param definitionId - A hull.
 * @param budget - Squad budget.
 * @returns The copies of the largest mono squad within budget (at least 1).
 */
export function copiesWithin(definitionId: string, budget: number): number {
  let copies = 1;
  while (
    copies < MAX_SWEEP_COPIES &&
    listCost(monoBuildList(definitionId, copies + 1)) <= budget
  )
    copies += 1;
  return copies;
}

/**
 * Sweep one hull: the squads just under and just over the budget against
 * every reference list.
 * @param spec - Hull, references, seeds and budget.
 * @returns Its value measurement.
 */
export function measureShipValue(spec: ShipValueSpec): ShipValue {
  const def = getShipDefinition(spec.definitionId);
  const copies = copiesWithin(spec.definitionId, spec.budget);
  const low = sweepPoint(spec, copies);
  const high = sweepPoint(spec, copies + 1);
  return {
    definitionId: spec.definitionId,
    role: def?.role ?? "unknown",
    faction: def?.faction ?? "unknown",
    hullCost: def?.baseStats.pointCost ?? 0,
    low,
    high,
    logitAtBudget: interpolateLogit(low, high, spec.budget),
  };
}

function sweepPoint(spec: ShipValueSpec, copies: number): SweepPoint {
  const list = monoBuildList(spec.definitionId, copies);
  let tally = EMPTY_TALLY;
  for (const reference of spec.references) {
    const result = runSquadMatchup({
      a: list,
      b: reference,
      seeds: spec.seeds,
    });
    tally = addTallies(tally, result.tally);
  }
  const { share, games } = shareInterval(tally);
  return { copies, cost: listCost(list), share, games };
}

/**
 * @param low - The squad under the budget.
 * @param high - The squad over it.
 * @param budget - The budget.
 * @returns The log-odds at the budget, on the line through both points.
 */
export function interpolateLogit(
  low: SweepPoint,
  high: SweepPoint,
  budget: number,
): number {
  const a = logit(low.share);
  const b = logit(high.share);
  if (high.cost === low.cost) return (a + b) / 2;
  return a + ((b - a) * (budget - low.cost)) / (high.cost - low.cost);
}

/**
 * The squads' price-to-strength slope: log-odds per point, the mean of
 * every sweep's bracket slope (positive slopes only).
 * @param values - Sweeps.
 * @returns Log-odds per point.
 */
export function logitPerPoint(values: readonly ShipValue[]): number {
  const slopes = values
    .filter((v) => v.high.cost > v.low.cost)
    .map(
      (v) =>
        (logit(v.high.share) - logit(v.low.share)) / (v.high.cost - v.low.cost),
    )
    .filter((s) => s > 0);
  return slopes.length > 0
    ? slopes.reduce((a, b) => a + b, 0) / slopes.length
    : Number.NaN;
}

/**
 * How far a hull plays from its price: the points its budget squad plays
 * like, relative to the budget (+0.2 = plays like 20 % more points, i.e.
 * under-costed).
 * @param value - A sweep.
 * @param slope - Log-odds per point ({@link logitPerPoint}).
 * @param budget - The budget.
 * @returns The relative mispricing.
 */
export function mispricing(
  value: ShipValue,
  slope: number,
  budget: number,
): number {
  return value.logitAtBudget / slope / budget;
}
