/**
 * render — the balance report's markdown sections, from merged results.
 */

import type { FactionId } from "../../src/config";
import { ACE_MATCHUPS } from "../../src/data/AceMatchups";
import { SCENARIO_IDS } from "../../src/arcade/scenarios";
import type { BalanceJobResult } from "../../src/simulation/balance/balanceJobs";
import {
  formatInterval,
  percentile,
  shareInterval,
  type WinTally,
} from "../../src/simulation/balance/balanceStats";
import {
  CURVE_MODES,
  DIFFICULTY_LABELS,
} from "../../src/simulation/balance/difficultyCurve";
import {
  cellOf,
  factionTotals,
  type PairResult,
} from "../../src/simulation/balance/factionMatrix";
import {
  BALANCE_FACTIONS,
  FACTION_SHORT,
} from "../../src/simulation/balance/squadLists";
import {
  cellsOf,
  mergeDuels,
  mergePairs,
  mergeScenarios,
  mergeTallies,
} from "./merge";
import { totalFlag } from "./renderIdentity";

type Results = ReadonlyMap<string, BalanceJobResult>;

/** Fair band for duels and seat bias (share of games). */
export const FAIR_LOW = 0.4;
export const FAIR_HIGH = 0.6;

/** Fair band for one faction pairing (squad matrices). */
export const PAIR_LOW = 0.35;
export const PAIR_HIGH = 0.65;

const sec = (ms: number): string =>
  Number.isFinite(ms) ? `${Math.round(ms / 1000)} s` : "–";
const pct = (share: number): string => `${Math.round(share * 100)}`;
const flag = (share: number): string =>
  share < FAIR_LOW || share > FAIR_HIGH ? " ✘" : "";
const pairFlag = (share: number): string =>
  share < PAIR_LOW || share > PAIR_HIGH ? " ✘" : "";

/** Median (p10–p90) of lengths in ms. */
export function lengthSummary(durationsMs: readonly number[]): string {
  return `${sec(percentile(durationsMs, 0.5))} (${sec(percentile(durationsMs, 0.1))}–${sec(percentile(durationsMs, 0.9))})`;
}

/**
 * @param results - All results.
 * @param section - classic / reinforced / preset.
 * @param title - Heading.
 * @returns The faction matrix section.
 */
export function renderFactionSection(
  results: Results,
  section: string,
  title: string,
): string {
  const pairs: PairResult[] = [...cellsOf(results, section).values()].map(
    mergePairs,
  );
  if (pairs.length === 0) return "";
  const totals = factionTotals(pairs);
  const head = `| | ${BALANCE_FACTIONS.map((f) => FACTION_SHORT[f]).join(" | ")} | overall [95% CI] |`;
  const rows = BALANCE_FACTIONS.map((row) => {
    const cells = BALANCE_FACTIONS.map((col) => matrixCell(pairs, row, col));
    const total = shareInterval(totals.get(row)!);
    return `| **${FACTION_SHORT[row]}** | ${cells.join(" | ")} | ${formatInterval(total)}${totalFlag(total.share)} |`;
  });
  const games = pairs[0] ? shareInterval(pairs[0].tally).games : 0;
  const lengths = pairs.flatMap((p) => p.durationsMs);
  return [
    `## ${title}`,
    "",
    `Row faction's win % vs column (draws = ½), ${games} games per pairing (both seats). Median length ${lengthSummary(lengths)}.`,
    "",
    head,
    `|---|${BALANCE_FACTIONS.map(() => "---").join("|")}|---|`,
    ...rows,
    "",
  ].join("\n");
}

function matrixCell(
  pairs: readonly PairResult[],
  row: FactionId,
  col: FactionId,
): string {
  if (row === col) return "—";
  const tally = cellOf(pairs, row, col);
  if (!tally) return "";
  const share = shareInterval(tally).share;
  return `${pct(share)}${pairFlag(share)}`;
}

/** @param results - All results. @returns The Ace Duel preset section. */
export function renderAceSection(results: Results): string {
  const cells = cellsOf(results, "ace");
  if (cells.size === 0) return "";
  const rows = ACE_MATCHUPS.map((m) => {
    const tiers = (["average", "expert"] as const).map((tier) => {
      const blocks = cells.get(`${m.id}:${tier}`);
      return blocks ? mergeDuels(blocks) : null;
    });
    const cols = tiers.map((s) => {
      if (!s) return "– | – | –";
      const i = shareInterval(s.tally);
      return `${formatInterval(i)}${flag(i.share)} | ${sec(percentile(s.durationsMs, 0.5))} | ${pct(s.timeouts / Math.max(1, s.rounds))}%`;
    });
    const ships = `${m.side1.ships.join("+")} v ${m.side2.ships.join("+")}`;
    return `| ${m.name} (${ships}) | ${cols.join(" | ")} |`;
  });
  return [
    "## Ace Duel presets (side 1's win %, aces' abilities on)",
    "",
    "| preset | avg win % | avg median | avg timeouts | expert win % | expert median | expert timeouts |",
    "|---|---|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}

/** @param results - All results. @returns The Dogfight default pairing section. */
export function renderDogfightSection(results: Results): string {
  const cells = cellsOf(results, "dogfight");
  if (cells.size === 0) return "";
  const rows = (["novice", "average", "expert"] as const).map((tier) => {
    const blocks = cells.get(tier);
    if (!blocks) return `| ${tier} | – | – | – |`;
    const s = mergeDuels(blocks);
    return `| ${tier} | ${formatInterval(shareInterval(s.tally))} | ${lengthSummary(s.durationsMs)} | ${pct(s.timeouts / Math.max(1, s.rounds))}% |`;
  });
  return [
    "## Dogfight default pairing (player ship's win %)",
    "",
    "| tier | win % | median (p10–p90) | timeouts |",
    "|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}

/** @param results - All results. @returns The difficulty-curve section. */
export function renderDifficultySection(results: Results): string {
  const cells = cellsOf(results, "difficulty");
  if (cells.size === 0) return "";
  const rows = CURVE_MODES.map((mode) => {
    const cols = DIFFICULTY_LABELS.map((label) => {
      const blocks = cells.get(`${mode}:${label}`);
      return blocks ? formatInterval(shareInterval(mergeTallies(blocks))) : "–";
    });
    return `| ${mode} | ${cols.join(" | ")} |`;
  });
  return [
    "## AI difficulty curve (average player bot's win %; target Easy ~80, Normal ~50, Hard ~25–30, Brutal ~10–15)",
    "",
    `| mode | ${DIFFICULTY_LABELS.join(" | ")} |`,
    "|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}

/** @param results - All results. @returns The scenario section. */
export function renderScenarioSection(results: Results): string {
  const cells = cellsOf(results, "scenario");
  if (cells.size === 0) return "";
  const rows: string[] = [];
  for (const scenario of SCENARIO_IDS)
    for (const variant of ["c", "r"] as const) {
      const blocks = [...cells.entries()]
        .filter(([cell]) => cell.startsWith(`${scenario}:${variant}:`))
        .flatMap(([, b]) => b);
      if (blocks.length === 0) continue;
      const s = mergeScenarios(blocks);
      const seat = shareInterval(s.seatTally);
      const reasons = Object.entries(s.reasons)
        .map(([r, n]) => `${r} ${n}`)
        .join(", ");
      rows.push(
        `| ${scenario} | ${variant === "c" ? "classic" : "reinforced"} | ${formatInterval(seat)}${flag(seat.share)} | ${lengthSummary(s.durationsMs)} | ${reasons} |`,
      );
    }
  return [
    "## Scenarios (player seat's win %, lists swapped every seed; average v average)",
    "",
    "| scenario | variant | player seat win % | median (p10–p90) | ended by |",
    "|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}

/** @param tally - A tally. @returns "W-L-D". */
export function wld(tally: WinTally): string {
  return `${tally.wins}-${tally.losses}-${tally.draws}`;
}
