/**
 * renderShips — the value-per-point section: every Skirmish hull's mono
 * squad (default quick builds) against the five auto-fill lists, its share
 * interpolated to 200 points, turned into "plays like N % more/fewer
 * points" with the sweep's own price slope, relative to the trend (the
 * mean over all hulls). Roles are summarised; hulls outside ±15 % flagged.
 */

import type { BalanceJobResult } from "../../src/simulation/balance/balanceJobs";
import { inverseLogit } from "../../src/simulation/balance/balanceStats";
import {
  logitPerPoint,
  mispricing,
  type ShipValue,
} from "../../src/simulation/balance/roleValue";
import { SKIRMISH_POINT_LIMIT } from "../../src/simulation/balance/squadLists";
import { cellsOf, shipValueOf } from "./merge";

/** Value band around the trend (±15 %). */
export const VALUE_BAND = 0.15;

/** A hull's value relative to the trend. */
export interface ValueRow {
  readonly value: ShipValue;
  /** Relative mispricing minus the trend (+ = under-costed). */
  readonly residual: number;
}

/**
 * @param results - All results.
 * @returns Every hull's residual (sorted, most under-costed first) and the slope.
 */
export function valueRows(results: ReadonlyMap<string, BalanceJobResult>): {
  rows: ValueRow[];
  slope: number;
  trend: number;
} {
  const values = [...cellsOf(results, "ships").values()].map(shipValueOf);
  const slope = logitPerPoint(values);
  const raw = values.map((v) => mispricing(v, slope, SKIRMISH_POINT_LIMIT));
  const trend = raw.reduce((a, b) => a + b, 0) / Math.max(1, raw.length);
  const rows = values
    .map((value, i) => ({ value, residual: raw[i]! - trend }))
    .sort((a, b) => b.residual - a.residual);
  return { rows, slope, trend };
}

const signed = (x: number): string =>
  `${x >= 0 ? "+" : ""}${Math.round(x * 100)}%`;

/**
 * @param results - All results.
 * @returns The ships / roles section.
 */
export function renderShipsSection(
  results: ReadonlyMap<string, BalanceJobResult>,
): string {
  const { rows, slope, trend } = valueRows(results);
  if (rows.length === 0) return "";
  const roles = [...new Set(rows.map((r) => r.value.role))].sort();
  const roleRows = roles.map((role) => {
    const own = rows.filter((r) => r.value.role === role);
    const mean = own.reduce((s, r) => s + r.residual, 0) / own.length;
    const outside = own.filter((r) => Math.abs(r.residual) > VALUE_BAND).length;
    return `| ${role} | ${own.length} | ${signed(mean)}${Math.abs(mean) > VALUE_BAND ? " ✘" : ""} | ${outside} |`;
  });
  const shipRows = rows.map((r) => {
    const v = r.value;
    const at200 = inverseLogit(v.logitAtBudget);
    return `| ${v.definitionId} | ${v.role} | ${v.hullCost} | ${v.low.copies}×=${v.low.cost} ${Math.round(v.low.share * 100)}% / ${v.high.copies}×=${v.high.cost} ${Math.round(v.high.share * 100)}% | ${Math.round(at200 * 100)}% | ${signed(r.residual)}${Math.abs(r.residual) > VALUE_BAND ? " ✘" : ""} |`;
  });
  const flagged = rows.filter((r) => Math.abs(r.residual) > VALUE_BAND).length;
  return [
    "## Value per point (mono-hull squads on default quick builds vs the 5 auto-fill lists)",
    "",
    `Price slope ${slope.toFixed(4)} log-odds/pt; trend ${signed(trend)} (the reference lists' own strength). Residual = plays like N % more (+, under-costed) or fewer (−) points than the trend. ${flagged}/${rows.length} hulls outside ±${VALUE_BAND * 100}%.`,
    "",
    "| role | hulls | mean residual | outside ±15% |",
    "|---|---|---|---|",
    ...roleRows,
    "",
    "<details><summary>Every hull</summary>",
    "",
    "| hull | role | bare | sweep (copies=cost share) | win % @200 | residual |",
    "|---|---|---|---|---|---|",
    ...shipRows,
    "",
    "</details>",
    "",
  ].join("\n");
}
