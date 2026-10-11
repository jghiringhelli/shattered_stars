/**
 * poolLedger — one side's reinforcement accounts: points spent from the
 * pool (every deployment, the opening squad included), the ships alive on
 * the field with their cost and categories, and what the side has lost.
 *
 * Pure: immutable ledgers.
 */

import { ReinforcementError } from "./reinforcementErrors";
import type { ShipRole } from "../../core/types";
import type { DeployOption, ShipCategory } from "./reinforcementTypes";

/** A living ship as the ledger remembers it. */
export interface FieldEntry {
  readonly cost: number;
  readonly role: ShipRole;
  readonly categories: readonly ShipCategory[];
  readonly uniquePilotId: string | null;
}

/** One side's accounts. */
export interface SideLedger {
  readonly poolPoints: number;
  readonly fieldCapPoints: number;
  readonly spentPoints: number;
  /** Living ships by id. */
  readonly field: ReadonlyMap<string, FieldEntry>;
  readonly deployedCount: number;
  /** Ships deployed per category over the match. */
  readonly deployedByCategory: Readonly<Partial<Record<ShipCategory, number>>>;
  /** Points of this side's ships destroyed. */
  readonly lostPoints: number;
  readonly lostCount: number;
}

/** Pool size and field cap of a side. */
export interface LedgerLimits {
  readonly poolPoints: number;
  readonly fieldCapPoints: number;
}

/**
 * @param limits - Pool and cap.
 * @returns An untouched ledger.
 */
export function createSideLedger(limits: LedgerLimits): SideLedger {
  return {
    poolPoints: limits.poolPoints,
    fieldCapPoints: limits.fieldCapPoints,
    spentPoints: 0,
    field: new Map(),
    deployedCount: 0,
    deployedByCategory: {},
    lostPoints: 0,
    lostCount: 0,
  };
}

/** @returns Pool points left (never negative). */
export function remainingPoints(ledger: SideLedger): number {
  return Math.max(0, ledger.poolPoints - ledger.spentPoints);
}

/** @returns Points of living ships. */
export function fieldPoints(ledger: SideLedger): number {
  let total = 0;
  for (const entry of ledger.field.values()) total += entry.cost;
  return total;
}

/** @returns Whether the ship is alive on this side's field. */
export function isOnField(ledger: SideLedger, shipId: string): boolean {
  return ledger.field.has(shipId);
}

/**
 * @param ledger - A side.
 * @param category - A category.
 * @param scope - Alive now ("field") or deployed this match ("match").
 * @returns How many ships of the category.
 */
export function categoryCount(
  ledger: SideLedger,
  category: ShipCategory,
  scope: "field" | "match",
): number {
  if (scope === "match") return ledger.deployedByCategory[category] ?? 0;
  let count = 0;
  for (const entry of ledger.field.values())
    if (entry.categories.includes(category)) count++;
  return count;
}

/**
 * A ship deploys: its cost leaves the pool and it joins the field.
 * @param ledger - The side.
 * @param shipId - The new ship's id.
 * @param option - What it is.
 * @returns The updated ledger.
 * @throws ReinforcementError when the id is already on the field.
 */
export function deployShip(
  ledger: SideLedger,
  shipId: string,
  option: DeployOption,
): SideLedger {
  if (ledger.field.has(shipId))
    throw new ReinforcementError(
      "deploy",
      `ship ${shipId} is already deployed`,
    );
  const field = new Map(ledger.field);
  field.set(shipId, {
    cost: option.cost,
    role: option.role,
    categories: option.categories,
    uniquePilotId: option.uniquePilotId,
  });
  const byCategory = { ...ledger.deployedByCategory };
  for (const category of option.categories)
    byCategory[category] = (byCategory[category] ?? 0) + 1;
  return {
    ...ledger,
    spentPoints: ledger.spentPoints + option.cost,
    field,
    deployedCount: ledger.deployedCount + 1,
    deployedByCategory: byCategory,
  };
}

/**
 * A ship is destroyed: it leaves the field (its points stay spent).
 * @param ledger - The side.
 * @param shipId - The ship.
 * @returns The updated ledger (the same one for an unknown id).
 */
export function retireShip(ledger: SideLedger, shipId: string): SideLedger {
  const entry = ledger.field.get(shipId);
  if (!entry) return ledger;
  const field = new Map(ledger.field);
  field.delete(shipId);
  return {
    ...ledger,
    field,
    lostPoints: ledger.lostPoints + entry.cost,
    lostCount: ledger.lostCount + 1,
  };
}
