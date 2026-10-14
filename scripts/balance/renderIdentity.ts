/**
 * renderIdentity — the report's faction-identity section: each faction's
 * specialty and levers, how often its preset / rotation actually flies
 * them, and what they are worth (the faction's win share with its identity
 * against the same squads flown without it — src/simulation/
 * identityAblation.ts), in classic squads and reinforced battles. Also the
 * scenario faction totals (every list's games, both variants).
 */

import type { FactionId } from "../../src/config";
import { FACTION_IDENTITIES } from "../../src/data/factionIdentity";
import type { BalanceJobResult } from "../../src/simulation/balance/balanceJobs";
import {
  addTallies,
  EMPTY_TALLY,
  formatInterval,
  shareInterval,
  Z_95,
  type WinTally,
} from "../../src/simulation/balance/balanceStats";
import {
  factionTotals,
  type PairResult,
} from "../../src/simulation/balance/factionMatrix";
import { identityUsage } from "../../src/simulation/identityAblation";
import {
  BALANCE_FACTIONS,
  FACTION_SHORT,
  skirmishAutoFillList,
} from "../../src/simulation/balance/squadLists";
import { cellsOf, mergePairs, mergeScenarios } from "./merge";

type Results = ReadonlyMap<string, BalanceJobResult>;

/** The identity target: removing it costs its faction at least this share. */
export const IDENTITY_MARGIN_TARGET = 0.08;

/** Faction-total fair band (classic, reinforced, scenarios). */
export const TOTAL_LOW = 0.45;
export const TOTAL_HIGH = 0.55;

/** @param share - A faction total. @returns " ✘" outside the band. */
export function totalFlag(share: number): string {
  return share < TOTAL_LOW || share > TOTAL_HIGH ? " ✘" : "";
}

/** A margin between two shares with its 95 % half-width. */
interface Margin {
  readonly with: WinTally;
  readonly without: WinTally;
  readonly margin: number;
  readonly half: number;
}

function marginOf(withTally: WinTally, withoutTally: WinTally): Margin {
  const a = shareInterval(withTally);
  const b = shareInterval(withoutTally);
  const variance = (s: typeof a): number =>
    s.games > 0 ? (s.share * (1 - s.share)) / s.games : 0;
  return {
    with: withTally,
    without: withoutTally,
    margin: a.share - b.share,
    half: Z_95 * Math.sqrt(variance(a) + variance(b)),
  };
}

function ablatedTotals(
  results: Results,
  section: string,
): Map<FactionId, WinTally> {
  const totals = new Map<FactionId, WinTally>();
  for (const pair of [...cellsOf(results, section).values()].map(mergePairs))
    totals.set(
      pair.a,
      addTallies(totals.get(pair.a) ?? EMPTY_TALLY, pair.tally),
    );
  return totals;
}

function baseTotals(
  results: Results,
  section: string,
): Map<FactionId, WinTally> {
  const pairs: PairResult[] = [...cellsOf(results, section).values()].map(
    mergePairs,
  );
  return factionTotals(pairs);
}

const points = (x: number): string =>
  `${x >= 0 ? "+" : ""}${Math.round(x * 100)}`;

function marginCell(margin: Margin | null): string {
  if (!margin) return "–";
  const ok = margin.margin >= IDENTITY_MARGIN_TARGET ? "" : " ✘";
  return `${points(margin.margin)} ±${Math.round(margin.half * 100)}${ok}`;
}

function marginFor(
  base: ReadonlyMap<FactionId, WinTally>,
  ablated: ReadonlyMap<FactionId, WinTally>,
  faction: FactionId,
): Margin | null {
  const withTally = base.get(faction);
  const withoutTally = ablated.get(faction);
  return withTally && withoutTally ? marginOf(withTally, withoutTally) : null;
}

/**
 * @param results - All results.
 * @returns The faction identity section (empty without identity jobs).
 */
export function renderIdentitySection(results: Results): string {
  const classic = [
    baseTotals(results, "classic"),
    ablatedTotals(results, "identity"),
  ] as const;
  const reinforced = [
    baseTotals(results, "reinforced"),
    ablatedTotals(results, "identityReinforced"),
  ] as const;
  if (classic[1].size === 0 && reinforced[1].size === 0) return "";
  const rows = BALANCE_FACTIONS.map((faction) => {
    const identity = FACTION_IDENTITIES[faction];
    const usage = identityUsage(skirmishAutoFillList(faction).ships);
    const c = marginFor(classic[0], classic[1], faction);
    const r = marginFor(reinforced[0], reinforced[1], faction);
    const without = c ? formatInterval(shareInterval(c.without)) : "–";
    return `| **${FACTION_SHORT[faction]}** | ${identity.specialty} | ${usage.identityShips}/${usage.ships} ships, ${usage.auraProjectors} aura projector(s) | ${c ? formatInterval(shareInterval(c.with)) : "–"} | ${without} | ${marginCell(c)} | ${marginCell(r)} |`;
  });
  const levers = BALANCE_FACTIONS.map(
    (f) =>
      `- **${FACTION_SHORT[f]}** — ${FACTION_IDENTITIES[f].levers.join("; ")}.`,
  );
  return [
    "## Faction identity (ablation)",
    "",
    `Each faction's squads flown with and without its identity levers (its aura, its identity cards, and for ace factions its named pilots' abilities) against the other four, same seeds. Margin = win points the identity is worth (95 % half-width); ✘ = below the +${IDENTITY_MARGIN_TARGET * 100} target. "Uses" = ships of the 200-pt preset that fly an identity card or ace ability, and how many project the faction aura.`,
    "",
    "| faction | specialty | uses (200-pt preset) | classic with | classic without | classic margin | reinforced margin |",
    "|---|---|---|---|---|---|---|",
    ...rows,
    "",
    ...levers,
    "",
  ].join("\n");
}

/**
 * @param results - All results.
 * @returns Each faction's scenario games pooled (classic / reinforced variants).
 */
export function renderScenarioFactionSection(results: Results): string {
  const cells = cellsOf(results, "scenario");
  if (cells.size === 0) return "";
  const totals = new Map<string, WinTally>();
  for (const [cell, blocks] of cells) {
    const [, variant, a, b] = cell.split(":");
    const s = mergeScenarios(blocks);
    const flip = {
      wins: s.listTally.losses,
      losses: s.listTally.wins,
      draws: s.listTally.draws,
    };
    const add = (key: string, t: WinTally): void => {
      totals.set(key, addTallies(totals.get(key) ?? EMPTY_TALLY, t));
    };
    add(`${variant}:${a}`, s.listTally);
    add(`${variant}:${b}`, flip);
  }
  const rows = BALANCE_FACTIONS.map((f) => {
    const cols = (["c", "r"] as const).map((v) => {
      const t = totals.get(`${v}:${f}`);
      if (!t) return "–";
      const i = shareInterval(t);
      return `${formatInterval(i)}${totalFlag(i.share)}`;
    });
    return `| **${FACTION_SHORT[f]}** | ${cols.join(" | ")} |`;
  });
  return [
    "## Scenario faction totals (every scenario, lists swapped per seed; ✘ outside 45–55 %)",
    "",
    "| faction | classic scenarios | reinforced scenarios |",
    "|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}
