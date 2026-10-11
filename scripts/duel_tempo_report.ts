/**
 * Duel tempo report — how long Dogfight / Ace Duel rounds last between equal
 * AI pilots on the X-Wing round tempo (DuelTempoSim, same modules as the
 * scenes). Reports median / quartiles per matchup; tunes nothing.
 *
 * Usage:
 *   npx tsx scripts/duel_tempo_report.ts [--rounds N] [--difficulty normal]
 */

import type { DuelDifficulty } from "../src/arcade/systems/AiPursuit";
import { ACE_MATCHUPS } from "../src/data/AceMatchups";
import {
  medianDurationMs,
  simulateDuelRound,
  type DuelTempoResult,
} from "../src/simulation/DuelTempoSim";

const DEFAULT_ROUNDS = 30;
const SEED_BASE = 1000;
const MS_PER_S = 1000;
const QUARTILE_LOW = 0.25;
const QUARTILE_HIGH = 0.75;

/** Mirror matchups (truly equal pilots) plus the Dogfight default. */
const MIRRORS: ReadonlyArray<
  readonly [string, readonly string[], readonly string[]]
> = [
  ["mirror falcon", ["confed_falcon"], ["confed_falcon"]],
  ["mirror raptor", ["terran_raptor"], ["terran_raptor"]],
  ["mirror sparrow", ["confed_sparrow"], ["confed_sparrow"]],
  ["mirror viper", ["terran_viper"], ["terran_viper"]],
  ["mirror fang", ["corsair_fang"], ["corsair_fang"]],
  ["dogfight default", ["confed_falcon"], ["terran_raptor"]],
];

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function seconds(ms: number | null | undefined): string {
  return ms === null || ms === undefined ? "  -  " : (ms / MS_PER_S).toFixed(1);
}

function quantile(
  results: readonly DuelTempoResult[],
  q: number,
): number | null {
  const sorted = results
    .map((r) => r.durationMs)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);
  return sorted.length === 0
    ? null
    : sorted[Math.floor(q * (sorted.length - 1))]!;
}

function report(
  label: string,
  side1: readonly string[],
  side2: readonly string[],
  options: { rounds: number; difficulty: DuelDifficulty },
): void {
  const results = Array.from({ length: options.rounds }, (_, i) =>
    simulateDuelRound({
      side1,
      side2,
      seed: SEED_BASE + i,
      difficulty: options.difficulty,
    }),
  );
  const timeouts = results.filter((r) => r.durationMs === null).length;
  const side1Wins = results.filter((r) => r.winner === 1).length;
  console.log(
    `${label.padEnd(22)} median ${seconds(medianDurationMs(results))}s` +
      `  p25 ${seconds(quantile(results, QUARTILE_LOW))}s` +
      `  p75 ${seconds(quantile(results, QUARTILE_HIGH))}s` +
      `  side1 ${side1Wins}/${options.rounds}  timeouts ${timeouts}`,
  );
}

function main(): void {
  const rounds = Number(argValue("--rounds") ?? DEFAULT_ROUNDS);
  const difficulty = (argValue("--difficulty") ?? "normal") as DuelDifficulty;
  const options = { rounds, difficulty };
  console.log(
    `Duel tempo — ${rounds} rounds per matchup, AI ${difficulty} vs ${difficulty}\n`,
  );
  for (const [label, side1, side2] of MIRRORS)
    report(label, side1, side2, options);
  for (const matchup of ACE_MATCHUPS) {
    report(
      `ace: ${matchup.id}`,
      matchup.side1.ships,
      matchup.side2.ships,
      options,
    );
  }
}

main();
