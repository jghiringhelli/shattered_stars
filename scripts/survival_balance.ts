/**
 * Survival Balance Simulation CLI
 *
 * Sweeps survival runs across draft policies and reports how far runs get, build
 * diversity and spike unlock rates so ADR-0003 coefficients can be tuned.
 *
 * Usage:
 *   npx tsx scripts/survival_balance.ts [options]
 *
 * Options:
 *   --runs <N>      Seeded runs per policy (default: 500)
 *   --seed <N>      Base seed (default: 1)
 *   --hull <id>     Starting hull (default: workhorse)
 *   --curve         Also print the threat/power curve of a reference run
 *   --export <path> Write JSON summaries to a file
 */

import * as fs from "fs";
import { createSeededRng } from "../src/utils/random";
import type { HullClass } from "../src/data/survival/model";
import {
  allPolicies,
  specialistPolicy,
} from "../src/simulation/SurvivalDraftPolicy";
import {
  type PolicySummary,
  fleetPower,
  survivalProbability,
  sweepPolicy,
} from "../src/simulation/SurvivalBalanceSim";
import { computeThreat } from "../src/data/survival/threat";
import { SurvivalRunController } from "../src/systems/survival/SurvivalRunController";

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1]! : null;
}

const runs = parseInt(arg("--runs") ?? "500", 10);
const seed = parseInt(arg("--seed") ?? "1", 10);
const hull = (arg("--hull") ?? "workhorse") as HullClass;
const showCurve = process.argv.includes("--curve");
const exportPath = arg("--export");

function pad(s: string | number, width: number): string {
  return String(s).padEnd(width);
}

function printSummaryTable(summaries: PolicySummary[]): void {
  console.log("\n═══ Survival balance — levels cleared per policy ═══");
  console.log(
    `${pad("policy", 12)}${pad("runs", 6)}${pad("p10", 6)}${pad("median", 8)}${pad("p90", 6)}${pad("caps", 6)}${pad("cross", 6)}hulls`,
  );
  for (const s of summaries) {
    const hulls = Object.entries(s.hullDistribution)
      .map(([h, n]) => `${h}:${n}`)
      .join(" ");
    console.log(
      `${pad(s.policy, 12)}${pad(s.runs, 6)}${pad(s.p10, 6)}${pad(s.median, 8)}${pad(s.p90, 6)}${pad(s.meanCapstones.toFixed(2), 6)}${pad(s.meanCrosses.toFixed(2), 6)}${hulls}`,
    );
  }
}

/** Print a per-level threat/power/survival trace for a reference specialist run. */
function printCurve(): void {
  const controller = new SurvivalRunController(seed, hull);
  const policy = specialistPolicy();
  console.log("\n═══ Reference run (specialist) — threat vs power ═══");
  console.log(
    `${pad("lvl", 5)}${pad("ships", 6)}${pad("power", 9)}${pad("threat", 8)}${pad("p(win)", 8)}milestone`,
  );
  for (let i = 0; i < 20 && controller.level < 20; i++) {
    controller.beginWave();
    const ships = Math.min(1 + controller.state.escorts, 6);
    const power = fleetPower(controller.bonuses, ships);
    const threat = computeThreat(controller.state, ships);
    const pWin = survivalProbability(power, threat);
    console.log(
      `${pad(controller.level, 5)}${pad(ships, 6)}${pad(power.toFixed(1), 9)}${pad(threat.toFixed(1), 8)}${pad(pWin.toFixed(2), 8)}${controller.isMilestone ? "★" : ""}`,
    );
    if (controller.isMilestone) {
      const options = controller.hangar();
      if (options.length)
        controller.chooseHangar(policy.pickHangar(options, controller.state));
    } else {
      const offered = controller.draft();
      if (offered.length)
        controller.choosePower(policy.pickPower(offered, controller.state));
    }
  }
}

function main(): void {
  console.log(
    `Survival balance sweep — ${runs} runs/policy, base seed ${seed}, hull ${hull}`,
  );
  const rng = createSeededRng(seed);
  const summaries: PolicySummary[] = [];
  for (const policy of allPolicies(rng)) {
    const { summary } = sweepPolicy(policy, runs, seed, hull);
    summaries.push(summary);
  }
  printSummaryTable(summaries);
  if (showCurve) printCurve();

  if (exportPath) {
    fs.writeFileSync(exportPath, JSON.stringify(summaries, null, 2));
    console.log(`\nWrote ${exportPath}`);
  }

  // Sanity signal (not an assertion): flag policies that trivially never die.
  const infinite = summaries.filter((s) => s.median >= 60);
  if (infinite.length > 0) {
    console.warn(
      `\n⚠  Policies hitting the level cap (possible runaway): ${infinite.map((s) => s.policy).join(", ")}`,
    );
  }
}

main();
