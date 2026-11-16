/**
 * LabBattleReport — the battle emulation's results as markdown tables for
 * docs/balance/movement-lab.md: head to head, human-like pilot, tier ordering
 * and the recommendation (every setting's pooled feel proxies and its mean rank).
 *
 * Pure: no Phaser, no I/O.
 */

import { shareInterval } from "../balance/balanceStats";
import type { CellResult } from "./LabBattle";
import type { BattleRow } from "./LabBattleCells";

/**
 * @param value - A number.
 * @param digits - Decimals.
 * @returns The number as text ("-" when not finite).
 */
function num(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "-";
}

/**
 * @param results - Results of cells (same subject setting).
 * @returns One result pooled over them: counts summed, means weighted by ship-minutes.
 */
export function pool(results: readonly CellResult[]): CellResult {
  const sum = (pick: (r: CellResult) => number): number =>
    results.reduce((total, r) => total + pick(r), 0);
  const weighted = (pick: (r: CellResult) => number): number =>
    sum((r) => pick(r) * r.shipMinutes) / sum((r) => r.shipMinutes);
  const rounds = sum((r) => r.rounds);
  const killRounds = sum((r) => r.killRounds);
  const tally = {
    wins: sum((r) => r.wins),
    losses: sum((r) => r.losses),
    draws: sum((r) => r.draws),
  };
  return {
    rounds,
    ...tally,
    win: shareInterval(tally),
    killRounds,
    meanFirstKillMs:
      sum((r) => r.meanFirstKillMs * r.killRounds) / Math.max(1, killRounds),
    meanDurationMs: sum((r) => r.meanDurationMs * r.rounds) / rounds,
    shotsPerShipMinute: weighted((r) => r.shotsPerShipMinute),
    wedgePercent: weighted((r) => r.wedgePercent),
    meanStress: weighted((r) => r.meanStress),
    turnsPerShipMinute: weighted((r) => r.turnsPerShipMinute),
    speedChangesPerShipMinute: weighted((r) => r.speedChangesPerShipMinute),
    cappedPercent: weighted((r) => r.cappedPercent),
    headingAccelRms: weighted((r) => r.headingAccelRms),
    shipMinutes: sum((r) => r.shipMinutes),
  };
}

const COLUMNS =
  "rounds | W-L-D | win % [95 % CI] | first kill s (rounds) | shots / ship-min | wedge % | stress | turns / ship-min | throttle changes / ship-min | at speed cap % | heading accel RMS °/s² |";
const RULES = "---|---|---|---|---|---|---|---|---|---|---|";

/**
 * @param r - A result.
 * @returns The metric cells of a table row.
 */
function cells(r: CellResult): string {
  const win = `${num(100 * r.win.share, 0)} [${num(100 * r.win.low, 0)}-${num(100 * r.win.high, 0)}]`;
  return `${r.rounds} | ${r.wins}-${r.losses}-${r.draws} | ${win} | ${num(r.meanFirstKillMs / 1000)} (${r.killRounds}) | ${num(r.shotsPerShipMinute)} | ${num(r.wedgePercent)} | ${num(r.meanStress, 2)} | ${num(r.turnsPerShipMinute, 0)} | ${num(r.speedChangesPerShipMinute)} | ${num(r.cappedPercent)} | ${num(r.headingAccelRms, 0)} |`;
}

/**
 * @param rows - Rows of one section.
 * @returns The distinct values of `key`, in first-seen order.
 */
function distinct(rows: readonly BattleRow[], key: (row: BattleRow) => string): string[] {
  return [...new Set(rows.map(key))];
}

/**
 * @param r - A pooled result.
 * @returns "W-L-D (win %)" (draws count half a win).
 */
function record(r: CellResult): string {
  return `${r.wins}-${r.losses}-${r.draws} (${num(100 * r.win.share, 0)} %)`;
}

/**
 * One row per setting, one column per `column` value, a last column pooling all.
 *
 * @param head - Title and column headings.
 * @param rows - The section's rows.
 * @param column - The column a row belongs to.
 * @returns The table lines.
 */
function pivot(
  head: { readonly title: string; readonly column: (key: string) => string },
  rows: readonly BattleRow[],
  column: (row: BattleRow) => string,
): string[] {
  const keys = distinct(rows, column);
  const titles = ["setting", ...keys.map(head.column), "all: win % [95 % CI] (rounds)"];
  const lines = [head.title, "", `| ${titles.join(" | ")} |`, `|${titles.map(() => "---").join("|")}|`];
  for (const setting of distinct(rows, (r) => r.setting.label)) {
    const own = rows.filter((r) => r.setting.label === setting);
    const parts = keys.map((key) =>
      record(pool(own.filter((r) => column(r) === key).map((r) => r.result))),
    );
    const all = pool(own.map((r) => r.result));
    const ci = `${num(100 * all.win.share, 0)} [${num(100 * all.win.low, 0)}-${num(100 * all.win.high, 0)}] (${all.rounds})`;
    lines.push(`| ${setting} | ${parts.join(" | ")} | ${ci} |`);
  }
  return [...lines, ""];
}

/**
 * @param rows - The head-to-head rows.
 * @returns The table: bots on each setting vs average bots on the template.
 */
export function headToHeadTable(rows: readonly BattleRow[]): string[] {
  return pivot(
    {
      title: "### Head to head: average bots on a setting vs average bots on the template (win % = the setting's; ships per side in the columns)",
      column: (key) => `${key}v${key}`,
    },
    rows,
    (r) => String(r.formation),
  );
}

/**
 * @param rows - The human-like rows.
 * @returns The table: the human-like pilot vs each tier (1v1 and 2v2 pooled).
 */
export function humanTable(rows: readonly BattleRow[]): string[] {
  return pivot(
    {
      title: "### Human-like pilot vs bots of each tier on the same setting (1v1 and 2v2 pooled)",
      column: (key) => `vs ${key}`,
    },
    rows,
    (r) => r.versus,
  );
}

/**
 * @param rows - The tier-ordering rows.
 * @returns The table: the higher tier's win rate against the lower, per setting.
 */
export function orderingTable(rows: readonly BattleRow[]): string[] {
  return pivot(
    {
      title: "### Tier ordering (duels, same setting on both sides; win % = the higher tier's; gate 1 needs expert > novice >= 85 %)",
      column: (key) => key,
    },
    rows,
    (r) => r.versus,
  );
}
/** A setting's pooled evidence and its rank. */
export interface Recommendation {
  readonly label: string;
  readonly human: CellResult;
  readonly headToHead: CellResult | null;
  /** Mean rank over the feel metrics (1 = best). */
  readonly meanRank: number;
}

/**
 * Rank settings on the human-like pilot's pooled results: win rate, shots,
 * wedge time (higher is better), first-kill time, stress and heading
 * roughness (lower is better). The mean rank orders the recommendation.
 *
 * @param human - The human-like rows.
 * @param headToHead - The head-to-head rows.
 * @returns One entry per setting, best first.
 */
export function recommend(
  human: readonly BattleRow[],
  headToHead: readonly BattleRow[],
): Recommendation[] {
  const entries = distinct(human, (r) => r.setting.label).map((label) => {
    const h2h = headToHead.filter((r) => r.setting.label === label);
    return {
      label,
      human: pool(human.filter((r) => r.setting.label === label).map((r) => r.result)),
      headToHead: h2h.length > 0 ? pool(h2h.map((r) => r.result)) : null,
    };
  });
  const metrics: readonly ((r: CellResult) => number)[] = [
    (r) => -r.win.share,
    (r) => -r.shotsPerShipMinute,
    (r) => -r.wedgePercent,
    (r) => r.meanFirstKillMs,
    (r) => r.meanStress,
    (r) => r.headingAccelRms,
  ];
  const ranks = (metric: (r: CellResult) => number): Map<string, number> =>
    new Map(
      [...entries]
        .sort((a, b) => metric(a.human) - metric(b.human))
        .map((entry, index) => [entry.label, index + 1]),
    );
  const all = metrics.map(ranks);
  return entries
    .map((entry) => ({
      ...entry,
      meanRank: all.reduce((s, m) => s + m.get(entry.label)!, 0) / all.length,
    }))
    .sort((a, b) => a.meanRank - b.meanRank);
}

/**
 * @param rows - The recommendation entries.
 * @returns The recommendation table.
 */
export function recommendationTable(rows: readonly Recommendation[]): string[] {
  return [
    "### Recommendation (human-like pilot, all tiers and formations pooled; mean rank over win %, shots, wedge, first-kill time, stress, smoothness)",
    "",
    `| setting | mean rank | bots vs template win % (games) | ${COLUMNS}`,
    `|---|---|---|${RULES}`,
    ...rows.map((r) => {
      const h2h = r.headToHead
        ? `${num(100 * r.headToHead.win.share, 0)} (${r.headToHead.rounds})`
        : "-";
      return `| ${r.label} | ${num(r.meanRank, 2)} | ${h2h} | ${cells(r.human)}`;
    }),
    "",
  ];
}
