/**
 * Balance Simulation Script
 *
 * Runs automated balance testing and generates reports.
 * Execute with: npx tsx scripts/runBalanceSimulation.ts
 */

import {
  BattleSimulator,
  type SimulationConfig,
} from "../src/simulation/BattleSimulator";
import type { FactionId } from "../src/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config: SimulationConfig = {
  mode: "continuous",
  maxTurns: 20,
  battlefieldSize: 1000,
  verbose: true,
};

const simulator = new BattleSimulator(config);

console.log("===========================================");
console.log("   SHATTERED STARS BALANCE SIMULATION");
console.log("===========================================\n");

// Configuration
const SHIPS_PER_TEAM = 3;
const BATTLES_PER_MATCHUP = 50;

console.log(`Configuration:`);
console.log(`  Mode: ${config.mode}`);
console.log(`  Ships per team: ${SHIPS_PER_TEAM}`);
console.log(`  Battles per matchup: ${BATTLES_PER_MATCHUP}`);
console.log(`  Max turns: ${config.maxTurns}`);
console.log();

// Run all faction matchups
console.log("Running all faction matchups...\n");
const allMatchups = simulator.runAllFactionMatchups(
  SHIPS_PER_TEAM,
  BATTLES_PER_MATCHUP,
);

// Generate individual matchup reports
console.log("\n=== MATCHUP RESULTS ===\n");

const matchupResults: Array<{
  matchup: string;
  faction1WinRate: number;
  faction2WinRate: number;
  drawRate: number;
}> = [];

for (const [matchup, stats] of allMatchups) {
  const team1WinRate = stats.team1Wins / stats.totalBattles;
  const team2WinRate = stats.team2Wins / stats.totalBattles;
  const drawRate = stats.draws / stats.totalBattles;

  matchupResults.push({
    matchup,
    faction1WinRate: team1WinRate,
    faction2WinRate: team2WinRate,
    drawRate,
  });

  console.log(`${matchup}:`);
  console.log(`  Team 1 Win Rate: ${(team1WinRate * 100).toFixed(1)}%`);
  console.log(`  Team 2 Win Rate: ${(team2WinRate * 100).toFixed(1)}%`);
  console.log(`  Draw Rate: ${(drawRate * 100).toFixed(1)}%`);
  console.log();
}

// Calculate faction overall performance
console.log("=== FACTION OVERALL PERFORMANCE ===\n");

const factionStats: Map<
  FactionId,
  { wins: number; losses: number; draws: number }
> = new Map();
const factions: FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

for (const faction of factions) {
  factionStats.set(faction, { wins: 0, losses: 0, draws: 0 });
}

for (const [matchup, stats] of allMatchups) {
  const [faction1Name, faction2Name] = matchup.split(" vs ");

  const f1Stats = factionStats.get(faction1Name as FactionId)!;
  const f2Stats = factionStats.get(faction2Name as FactionId)!;

  f1Stats.wins += stats.team1Wins;
  f1Stats.losses += stats.team2Wins;
  f1Stats.draws += stats.draws;

  f2Stats.wins += stats.team2Wins;
  f2Stats.losses += stats.team1Wins;
  f2Stats.draws += stats.draws;
}

// Sort factions by win rate
const rankedFactions = Array.from(factionStats.entries())
  .map(([faction, stats]) => ({
    faction,
    total: stats.wins + stats.losses + stats.draws,
    winRate: stats.wins / (stats.wins + stats.losses + stats.draws),
    ...stats,
  }))
  .sort((a, b) => b.winRate - a.winRate);

console.log("Faction Rankings (by win rate):");
console.log("-----------------------------------");
rankedFactions.forEach((f, index) => {
  console.log(
    `${index + 1}. ${f.faction.padEnd(25)} Win Rate: ${(f.winRate * 100).toFixed(1).padStart(5)}%  (W:${f.wins} L:${f.losses} D:${f.draws})`,
  );
});

console.log();

// Balance analysis
console.log("=== BALANCE ANALYSIS ===\n");

const avgWinRate =
  rankedFactions.reduce((sum, f) => sum + f.winRate, 0) / rankedFactions.length;
const winRateVariance =
  rankedFactions.reduce(
    (sum, f) => sum + Math.pow(f.winRate - avgWinRate, 2),
    0,
  ) / rankedFactions.length;
const winRateStdDev = Math.sqrt(winRateVariance);

console.log(
  `Average Win Rate: ${(avgWinRate * 100).toFixed(1)}% (expected: 50%)`,
);
console.log(`Win Rate Std Dev: ${(winRateStdDev * 100).toFixed(2)}%`);

if (winRateStdDev < 0.05) {
  console.log(`Balance Status: EXCELLENT - Very well balanced`);
} else if (winRateStdDev < 0.1) {
  console.log(`Balance Status: GOOD - Minor balance differences`);
} else if (winRateStdDev < 0.15) {
  console.log(`Balance Status: FAIR - Noticeable balance differences`);
} else {
  console.log(`Balance Status: NEEDS WORK - Significant imbalances detected`);
}

console.log();

// Identify outliers
const bestFaction = rankedFactions[0]!;
const worstFaction = rankedFactions[rankedFactions.length - 1]!;

if (bestFaction.winRate > 0.6) {
  console.log(
    `WARNING: ${bestFaction.faction} may be overpowered (${(bestFaction.winRate * 100).toFixed(1)}% win rate)`,
  );
}

if (worstFaction.winRate < 0.4) {
  console.log(
    `WARNING: ${worstFaction.faction} may be underpowered (${(worstFaction.winRate * 100).toFixed(1)}% win rate)`,
  );
}

// Check for one-sided matchups
console.log("\nOne-sided Matchups (>65% win rate):");
let foundOnesided = false;
for (const result of matchupResults) {
  if (result.faction1WinRate > 0.65 || result.faction2WinRate > 0.65) {
    foundOnesided = true;
    const winner =
      result.faction1WinRate > result.faction2WinRate ? "Team 1" : "Team 2";
    const winRate = Math.max(result.faction1WinRate, result.faction2WinRate);
    console.log(
      `  ${result.matchup}: ${winner} wins ${(winRate * 100).toFixed(1)}%`,
    );
  }
}
if (!foundOnesided) {
  console.log("  None found - all matchups are reasonably balanced!");
}

// Save report to file
const report = {
  timestamp: new Date().toISOString(),
  config: {
    mode: config.mode,
    shipsPerTeam: SHIPS_PER_TEAM,
    battlesPerMatchup: BATTLES_PER_MATCHUP,
    maxTurns: config.maxTurns,
  },
  factionRankings: rankedFactions,
  matchupResults,
  analysis: {
    avgWinRate,
    winRateStdDev,
    balanceStatus:
      winRateStdDev < 0.05
        ? "EXCELLENT"
        : winRateStdDev < 0.1
          ? "GOOD"
          : winRateStdDev < 0.15
            ? "FAIR"
            : "NEEDS_WORK",
  },
};

const reportPath = path.join(__dirname, "..", "balance_report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\nDetailed report saved to: ${reportPath}`);

console.log("\n===========================================");
console.log("   SIMULATION COMPLETE");
console.log("===========================================");
