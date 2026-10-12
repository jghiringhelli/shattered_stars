/**
 * Duel tempo report — how long Dogfight / Ace Duel rounds last between equal
 * bot pilots on the X-Wing round tempo (DuelTempoSim: the same BotPilots,
 * squad layer and modules as the scenes). For every matchup it reports the
 * median round length (and timeouts) of each tier mirror — novice vs
 * novice (Easy), average vs average (Normal), expert vs expert (Hard).
 * Tunes nothing.
 *
 * Usage:
 *   npx tsx scripts/duel_tempo_report.ts [--rounds N] [--tier average]
 */

import type { BotTier } from "../src/arcade/ai";
import { ACE_MATCHUPS } from "../src/data/AceMatchups";
import { DOGFIGHT_DEFAULT_PAIRING } from "../src/data/DogfightDefaults";
import {
  medianDurationMs,
  simulateDuelRound,
  type DuelTempoResult,
} from "../src/simulation/DuelTempoSim";

const DEFAULT_ROUNDS = 30;
const SEED_BASE = 1000;
const MS_PER_S = 1000;
const LABEL_WIDTH = 22;
const CELL_WIDTH = 20;
const TIERS: readonly BotTier[] = ["novice", "average", "expert"];

/** Mirror matchups (truly equal pilots) plus the Dogfight default. */
const MIRRORS: ReadonlyArray<
  readonly [string, readonly string[], readonly string[]]
> = [
  ["mirror falcon", ["confed_falcon"], ["confed_falcon"]],
  ["mirror raptor", ["terran_raptor"], ["terran_raptor"]],
  ["mirror sparrow", ["confed_sparrow"], ["confed_sparrow"]],
  ["mirror viper", ["terran_viper"], ["terran_viper"]],
  ["mirror fang", ["corsair_fang"], ["corsair_fang"]],
  [
    "dogfight default",
    [DOGFIGHT_DEFAULT_PAIRING.player.shipId],
    [DOGFIGHT_DEFAULT_PAIRING.enemy.shipId],
  ],
];

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function seconds(ms: number | null): string {
  return ms === null ? "-" : `${(ms / MS_PER_S).toFixed(1)}s`;
}

/**
 * @param side1 - Side 1 ship ids.
 * @param side2 - Side 2 ship ids.
 * @param tier - Both sides' bot tier.
 * @param rounds - Seeds to fly.
 * @returns One cell: median, side-1 wins and timeouts of a tier mirror.
 */
function cell(
  side1: readonly string[],
  side2: readonly string[],
  tier: BotTier,
  rounds: number,
): string {
  const results: DuelTempoResult[] = Array.from({ length: rounds }, (_, i) =>
    simulateDuelRound({ side1, side2, seed: SEED_BASE + i, tier }),
  );
  const timeouts = results.filter((r) => r.durationMs === null).length;
  const side1Wins = results.filter((r) => r.winner === 1).length;
  return `${seconds(medianDurationMs(results))} w${side1Wins} t${timeouts}`;
}

/**
 * Print one matchup's row: a cell per tier mirror.
 * @param label - Row label.
 * @param sides - Side 1 and side 2 ship ids.
 * @param tiers - Tier mirrors to fly.
 * @param rounds - Seeds per cell.
 */
function row(
  label: string,
  sides: readonly [readonly string[], readonly string[]],
  tiers: readonly BotTier[],
  rounds: number,
): void {
  const cells = tiers.map((tier) =>
    cell(sides[0], sides[1], tier, rounds).padEnd(CELL_WIDTH),
  );
  console.log(`${label.padEnd(LABEL_WIDTH)}${cells.join("")}`);
}

function main(): void {
  const rounds = Number(argValue("--rounds") ?? DEFAULT_ROUNDS);
  const only = argValue("--tier") as BotTier | undefined;
  const tiers = only ? [only] : TIERS;
  console.log(
    `Duel tempo — ${rounds} rounds per matchup and tier mirror; ` +
      `median round, side-1 wins (w), timeouts (t)\n`,
  );
  console.log(
    "".padEnd(LABEL_WIDTH) +
      tiers.map((t) => `${t} mirror`.padEnd(CELL_WIDTH)).join(""),
  );
  for (const [label, side1, side2] of MIRRORS)
    row(label, [side1, side2], tiers, rounds);
  for (const matchup of ACE_MATCHUPS) {
    row(
      `ace: ${matchup.id}`,
      [matchup.side1.ships, matchup.side2.ships],
      tiers,
      rounds,
    );
  }
}

main();
