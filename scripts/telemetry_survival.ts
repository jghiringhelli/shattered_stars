/**
 * telemetry_survival — node-based Survival roguelite balance sweep: plays
 * whole runs headless (SurvivalRunSim: the game's run operations, every
 * battle fought on the real engine by an average-tier flagship bot) and
 * prints the ADR-0004 targets: node clear rate per sector / kind, run win
 * rate at an ascension, node length.
 *
 * Usage: npx tsx scripts/telemetry_survival.ts [--runs 200] [--seed 1] [--ascension 0] [--belt-aware]
 *   --mixed       fly every faction's starter in turn (seed % 5), not the Terran
 *                 Hegemony viper alone (the audit's and round 4's baseline)
 *   --belt-aware  the simulated player never takes belt damage (a pilot who
 *                 keeps clear of it; the default flies the scene's autopilot)
 */

import {
  summarizeSweep,
  sweepRuns,
  type ClearStats,
} from "../src/simulation/survival/runSweep";

const DEFAULT_RUNS = 200;
const PERCENT = 100;
const MS_PER_S = 1000;

function arg(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

function row(label: string, s: ClearStats): string {
  const pct = Number.isNaN(s.rate)
    ? "  -"
    : `${(s.rate * PERCENT).toFixed(0)}%`;
  const sec = (ms: number): string =>
    Number.isNaN(ms) ? "-" : (ms / MS_PER_S).toFixed(0);
  return (
    `${label.padEnd(10)} fought ${String(s.fought).padStart(5)}  cleared ${pct.padStart(4)}  ` +
    `timeouts ${s.timeouts}  length p10/med/p90 ${sec(s.p10Ms)}/${sec(s.medianMs)}/${sec(s.p90Ms)} s`
  );
}

function main(): void {
  const runs = arg("--runs", DEFAULT_RUNS);
  const seed = arg("--seed", 1);
  const ascension = arg("--ascension", 0);
  const started = Date.now();
  const beltAware = process.argv.includes("--belt-aware");
  const summary = summarizeSweep(
    sweepRuns(
      runs,
      seed,
      ascension,
      { playerBeltDamage: !beltAware },
      process.argv.includes("--mixed"),
    ),
  );
  console.log(
    `Survival node sweep — ${runs} runs, ascension ${ascension}, seeds ${seed}..${seed + runs - 1}` +
      (beltAware ? ", belt-aware pilot" : ", autopilot (belt hits the fleet)"),
  );
  console.log(
    `Run win rate ${(summary.winRate * PERCENT).toFixed(1)}%  reached sectors ${summary.reached.join(" / ")}`,
  );
  summary.bySector.forEach((s, i) => console.log(row(`sector ${i + 1}`, s)));
  for (const [kind, s] of Object.entries(summary.byKind))
    console.log(row(kind, s));
  console.log(row("all", summary.all));
  console.log(`(${((Date.now() - started) / MS_PER_S).toFixed(1)} s)`);
}

main();
