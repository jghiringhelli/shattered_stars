/**
 * reserveExplain — the plain-language sentences of the reserve editor and
 * the squad builder's reinforcement header: the category quotas, the reserve
 * summary, the combined pool / cap tooltip, and where the row selection goes
 * after an edit. Pure: no Phaser.
 */

import type {
  QuotaRule,
  ReinforcementRules,
  ShipCategory,
  StrategyId,
} from "../../arcade/reinforcements";
import { termEntry, type TermId } from "../../data/tooltips";
import type { TooltipContent } from "../menu/tooltipContent";
import { fieldCapNote, poolNote } from "../picker/pointsBudget";

/** Tooltip term of each reserve strategy preset. */
export const RESERVE_STRATEGY_TERMS: Readonly<Record<StrategyId, TermId>> = {
  balanced: "reserve.strategy_balanced",
  swarm: "reserve.strategy_swarm",
  aces: "reserve.strategy_aces",
  heavy: "reserve.strategy_heavy",
};

const CATEGORY_NAMES: Readonly<Record<ShipCategory, string>> = {
  bomber: "bomber",
  ace: "ace",
  capital: "capital ship",
};

/**
 * @param quota - One category quota.
 * @returns "up to 2 bombers", "up to 1 ace (3 per match)" or "no capital ships".
 */
function quotaPhrase(quota: QuotaRule): string {
  const name = CATEGORY_NAMES[quota.category];
  if (quota.maxOnField === 0) return `no ${name}s`;
  const plural = quota.maxOnField === 1 ? name : `${name}s`;
  const perMatch = Number.isFinite(quota.maxPerMatch)
    ? ` (${quota.maxPerMatch} per match)`
    : "";
  return `up to ${quota.maxOnField} ${plural}${perMatch}`;
}

/**
 * @param rules - The battle format's rules.
 * @returns One sentence naming the mix limits of the field.
 */
export function quotaSentence(rules: ReinforcementRules): string {
  return `Mix limits on the field at once: ${rules.quotas.map(quotaPhrase).join(", ")}.`;
}

/**
 * @param count - Ships in the reserve.
 * @param points - Their flown points.
 * @returns "9 ships · 612 pt in reserve", or a note when empty.
 */
export function reserveSummaryLine(count: number, points: number): string {
  if (count === 0) return "Reserve is empty";
  return `${count} ${count === 1 ? "ship" : "ships"} \u00b7 ${points} pt in reserve`;
}

/**
 * @param index - The selected row.
 * @param delta - -1 moved up, +1 moved down.
 * @param length - Rows in the reserve.
 * @returns The row that holds the moved entry.
 */
export function selectionAfterMove(
  index: number,
  delta: -1 | 1,
  length: number,
): number {
  return Math.min(length - 1, Math.max(0, index + delta));
}

/**
 * @param index - The removed row.
 * @param length - Rows left.
 * @returns The row to select next, or null when none are left.
 */
export function selectionAfterRemove(
  index: number,
  length: number,
): number | null {
  if (length === 0) return null;
  return Math.min(index, length - 1);
}

/**
 * @param pool - Reinforcement pool.
 * @param cap - On-field cap.
 * @returns Tooltip content explaining both in plain words with an example.
 */
export function poolCapTooltip(pool: number, cap: number): TooltipContent {
  const entry = termEntry("reserve.pool");
  return {
    title: `Pool ${pool} \u00b7 on-field cap ${cap}`,
    body: `${poolNote(pool)}. ${fieldCapNote(cap)}.`,
    example: entry.example,
    ...(entry.howItPlays ? { howItPlays: entry.howItPlays } : {}),
    glyph: "points",
  };
}
