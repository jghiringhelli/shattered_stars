/**
 * scenario_match_length — headless measurement of Scenario mode match length
 * with average bots on both sides.
 *
 * Runs each scenario with the skill arena's real engine (BotPilot through the
 * player's controls, SquadCommand orders + marks, CycleFlight, the arena's
 * dice combat under the CombatTempo round model) and the Scenario mode's own
 * layers exactly as the Skirmish scene wires them (ScenarioFrameTracker →
 * stepScenario, ScenarioDirector → BotPilot safe-point goals). Arena combat
 * is the continuous-mode dice model, so kill rates approximate Skirmish's
 * projectile lasers.
 *
 * Usage: npx tsx scripts/scenario_match_length.ts [seedsPerScenario=10]
 */

import {
  SCENARIO_IDS,
  totalPoints,
  type ScenarioId,
  type ScenarioResult,
} from "../src/arcade/scenarios";
import { runScenarioMatch } from "../src/simulation/ScenarioMatchSim";

/** One measured match. */
interface Measured {
  readonly scenario: ScenarioId;
  readonly seed: number;
  readonly result: ScenarioResult;
  readonly pickups: number;
}

function runMatch(scenario: ScenarioId, seed: number): Measured {
  return runScenarioMatch(scenario, seed);
}

function summarize(runs: readonly Measured[]): void {
  for (const id of SCENARIO_IDS) {
    const own = runs.filter((r) => r.scenario === id);
    const seconds = own
      .map((r) => r.result.elapsedMs / 1000)
      .sort((a, b) => a - b);
    const mean = seconds.reduce((a, b) => a + b, 0) / seconds.length;
    const median = seconds[Math.floor(seconds.length / 2)]!;
    const reasons = new Map<string, number>();
    for (const r of own)
      reasons.set(r.result.reason, (reasons.get(r.result.reason) ?? 0) + 1);
    const objectiveShare =
      own.reduce((sum, r) => {
        const p = r.result.points;
        const total = totalPoints(p.player) + totalPoints(p.enemy);
        return (
          sum +
          (total > 0 ? (p.player.objective + p.enemy.objective) / total : 0)
        );
      }, 0) / own.length;
    const wins = own.filter((r) => r.result.winner === "player").length;
    console.log(
      `${id.padEnd(24)} n=${own.length} mean=${mean.toFixed(0)}s median=${median.toFixed(0)}s ` +
        `min=${seconds[0]!.toFixed(0)}s max=${seconds[seconds.length - 1]!.toFixed(0)}s ` +
        `ends=${[...reasons].map(([k, v]) => `${k}:${v}`).join(",")} ` +
        `objective-share=${(objectiveShare * 100).toFixed(0)}% A-wins=${wins}` +
        (id === "salvage_mission"
          ? ` pickups/match=${(own.reduce((s, r) => s + r.pickups, 0) / own.length).toFixed(1)}`
          : ""),
    );
  }
}

const seeds = Number(process.argv[2] ?? 10);
const runs: Measured[] = [];
for (const id of SCENARIO_IDS) {
  for (let seed = 1; seed <= seeds; seed++) runs.push(runMatch(id, seed));
}
summarize(runs);
