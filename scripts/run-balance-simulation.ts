/**
 * Balance Simulation Runner
 *
 * Run comprehensive balance simulations and output a detailed report.
 * Usage: npx tsx scripts/run-balance-simulation.ts
 */

import { BattleSimulator, type AggregatedStats } from '../src/simulation/BattleSimulator';
import { SHIP_DEFINITIONS } from '../src/data/ShipDefinitions';
import type { FactionId } from '../src/config';

const BATTLES_PER_MATCHUP = 100;
const SHIPS_PER_TEAM = 3;
const MAX_TURNS = 80;

// All factions
const FACTIONS: FactionId[] = [
  'terran_hegemony',
  'free_confederation',
  'synthetic_collective',
  'void_corsairs',
  'ascendant_empire',
];

// Get ships for a faction
function getShipsForFaction(faction: FactionId): string[] {
  return Object.values(SHIP_DEFINITIONS)
    .filter(ship => ship.faction === faction)
    .map(ship => ship.id);
}

// Format percentage
function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// Format number
function num(value: number): string {
  return value.toFixed(2);
}

console.log('='.repeat(70));
console.log('SHATTERED STARS - BALANCE SIMULATION');
console.log('='.repeat(70));
console.log(`Battles per matchup: ${BATTLES_PER_MATCHUP}`);
console.log(`Ships per team: ${SHIPS_PER_TEAM}`);
console.log(`Max turns: ${MAX_TURNS}`);
console.log('');

const simulator = new BattleSimulator({
  verbose: false,
  maxTurns: MAX_TURNS,
  mode: 'continuous',
});

// ===================================
// FACTION VS FACTION ANALYSIS
// ===================================
console.log('');
console.log('='.repeat(70));
console.log('FACTION VS FACTION MATCHUPS');
console.log('='.repeat(70));

interface MatchupResult {
  faction1: FactionId;
  faction2: FactionId;
  stats: AggregatedStats;
}

const matchupResults: MatchupResult[] = [];
const factionWins: Map<FactionId, number> = new Map();
const factionLosses: Map<FactionId, number> = new Map();
const factionDraws: Map<FactionId, number> = new Map();

// Initialize counters
for (const faction of FACTIONS) {
  factionWins.set(faction, 0);
  factionLosses.set(faction, 0);
  factionDraws.set(faction, 0);
}

// Run all matchups
let totalMatchups = 0;
for (let i = 0; i < FACTIONS.length; i++) {
  for (let j = i + 1; j < FACTIONS.length; j++) {
    totalMatchups++;
    const faction1 = FACTIONS[i]!;
    const faction2 = FACTIONS[j]!;

    process.stdout.write(`Running: ${faction1} vs ${faction2}... `);

    const ships1 = getShipsForFaction(faction1).slice(0, SHIPS_PER_TEAM);
    const ships2 = getShipsForFaction(faction2).slice(0, SHIPS_PER_TEAM);

    const stats = simulator.runBatchSimulation(ships1, ships2, BATTLES_PER_MATCHUP);

    matchupResults.push({ faction1, faction2, stats });

    // Track faction performance
    factionWins.set(faction1, factionWins.get(faction1)! + stats.team1Wins);
    factionLosses.set(faction1, factionLosses.get(faction1)! + stats.team2Wins);
    factionDraws.set(faction1, factionDraws.get(faction1)! + stats.draws);

    factionWins.set(faction2, factionWins.get(faction2)! + stats.team2Wins);
    factionLosses.set(faction2, factionLosses.get(faction2)! + stats.team1Wins);
    factionDraws.set(faction2, factionDraws.get(faction2)! + stats.draws);

    const winRate1 = stats.team1Wins / stats.totalBattles;
    const winRate2 = stats.team2Wins / stats.totalBattles;

    console.log(`${faction1}: ${pct(winRate1)} | ${faction2}: ${pct(winRate2)} | Draws: ${pct(stats.draws / stats.totalBattles)}`);
  }
}

// ===================================
// FACTION OVERALL PERFORMANCE
// ===================================
console.log('');
console.log('='.repeat(70));
console.log('FACTION OVERALL PERFORMANCE');
console.log('='.repeat(70));
console.log('');

interface FactionScore {
  faction: FactionId;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  total: number;
}

const factionScores: FactionScore[] = FACTIONS.map(faction => {
  const wins = factionWins.get(faction)!;
  const losses = factionLosses.get(faction)!;
  const draws = factionDraws.get(faction)!;
  const total = wins + losses + draws;
  return {
    faction,
    wins,
    losses,
    draws,
    total,
    winRate: wins / total,
  };
}).sort((a, b) => b.winRate - a.winRate);

console.log('Faction                    | Wins   | Losses | Draws  | Win Rate');
console.log('-'.repeat(70));
for (const score of factionScores) {
  const name = score.faction.padEnd(25);
  console.log(`${name} | ${String(score.wins).padStart(6)} | ${String(score.losses).padStart(6)} | ${String(score.draws).padStart(6)} | ${pct(score.winRate).padStart(7)}`);
}

// ===================================
// MATCHUP MATRIX
// ===================================
console.log('');
console.log('='.repeat(70));
console.log('MATCHUP MATRIX (Row vs Column Win Rate)');
console.log('='.repeat(70));
console.log('');

// Header
const shortNames: Record<FactionId, string> = {
  terran_hegemony: 'TH',
  free_confederation: 'FC',
  synthetic_collective: 'SC',
  void_corsairs: 'VC',
  ascendant_empire: 'AE',
};

process.stdout.write('        |');
for (const faction of FACTIONS) {
  process.stdout.write(` ${shortNames[faction].padStart(6)} |`);
}
console.log('');
console.log('-'.repeat(55));

for (const faction1 of FACTIONS) {
  process.stdout.write(`${shortNames[faction1].padStart(6)}  |`);
  for (const faction2 of FACTIONS) {
    if (faction1 === faction2) {
      process.stdout.write('    -   |');
    } else {
      // Find the matchup
      const matchup = matchupResults.find(
        m => (m.faction1 === faction1 && m.faction2 === faction2) ||
             (m.faction1 === faction2 && m.faction2 === faction1)
      );

      if (matchup) {
        let winRate: number;
        if (matchup.faction1 === faction1) {
          winRate = matchup.stats.team1Wins / matchup.stats.totalBattles;
        } else {
          winRate = matchup.stats.team2Wins / matchup.stats.totalBattles;
        }
        process.stdout.write(` ${pct(winRate).padStart(6)} |`);
      } else {
        process.stdout.write('   N/A  |');
      }
    }
  }
  console.log('');
}

// ===================================
// SHIP PERFORMANCE
// ===================================
console.log('');
console.log('='.repeat(70));
console.log('SHIP PERFORMANCE (aggregated across all battles)');
console.log('='.repeat(70));
console.log('');

// Aggregate all ship stats
interface ShipAggregate {
  id: string;
  faction: FactionId;
  role: string;
  battles: number;
  survived: number;
  kills: number;
  damageDealt: number;
  damageTaken: number;
  shotsHit: number;
  shotsMissed: number;
}

const shipAggregates: Map<string, ShipAggregate> = new Map();

for (const matchup of matchupResults) {
  for (const [, perf] of matchup.stats.shipPerformance) {
    let agg = shipAggregates.get(perf.definitionId);
    if (!agg) {
      const def = SHIP_DEFINITIONS[perf.definitionId];
      agg = {
        id: perf.definitionId,
        faction: perf.faction,
        role: def?.role || 'unknown',
        battles: 0,
        survived: 0,
        kills: 0,
        damageDealt: 0,
        damageTaken: 0,
        shotsHit: 0,
        shotsMissed: 0,
      };
      shipAggregates.set(perf.definitionId, agg);
    }

    agg.battles += perf.battles;
    agg.survived += perf.survivalRate * perf.battles;
    agg.kills += perf.averageKills * perf.battles;
    agg.damageDealt += perf.averageDamageDealt * perf.battles;
    agg.damageTaken += perf.averageDamageTaken * perf.battles;
    agg.shotsHit += perf.hitRate * perf.battles;
    agg.shotsMissed += (1 - perf.hitRate) * perf.battles;
  }
}

// Sort by survival rate
const sortedShips = Array.from(shipAggregates.values())
  .sort((a, b) => (b.survived / b.battles) - (a.survived / a.battles));

console.log('Ship ID                    | Faction | Role          | Surv%  | Kills  | Dmg Out | Dmg In | Hit%');
console.log('-'.repeat(100));

for (const ship of sortedShips) {
  const survivalRate = ship.survived / ship.battles;
  const avgKills = ship.kills / ship.battles;
  const avgDmgOut = ship.damageDealt / ship.battles;
  const avgDmgIn = ship.damageTaken / ship.battles;
  const hitRate = ship.shotsHit / (ship.shotsHit + ship.shotsMissed);

  const id = ship.id.padEnd(25);
  const faction = shortNames[ship.faction].padStart(7);
  const role = ship.role.padEnd(13);

  console.log(`${id} | ${faction} | ${role} | ${pct(survivalRate).padStart(6)} | ${num(avgKills).padStart(6)} | ${num(avgDmgOut).padStart(7)} | ${num(avgDmgIn).padStart(6)} | ${pct(hitRate).padStart(5)}`);
}

// ===================================
// BALANCE ISSUES
// ===================================
console.log('');
console.log('='.repeat(70));
console.log('BALANCE ANALYSIS');
console.log('='.repeat(70));
console.log('');

const issues: string[] = [];
const warnings: string[] = [];

// Check for dominant factions
for (const score of factionScores) {
  if (score.winRate > 0.65) {
    issues.push(`OVERPOWERED: ${score.faction} has ${pct(score.winRate)} win rate`);
  } else if (score.winRate > 0.55) {
    warnings.push(`Slightly strong: ${score.faction} has ${pct(score.winRate)} win rate`);
  } else if (score.winRate < 0.35) {
    issues.push(`UNDERPOWERED: ${score.faction} has ${pct(score.winRate)} win rate`);
  } else if (score.winRate < 0.45) {
    warnings.push(`Slightly weak: ${score.faction} has ${pct(score.winRate)} win rate`);
  }
}

// Check for dominant/weak ships
for (const ship of sortedShips) {
  const survivalRate = ship.survived / ship.battles;
  const avgKills = ship.kills / ship.battles;

  if (survivalRate > 0.8 && avgKills > 1.5) {
    issues.push(`SHIP OVERPOWERED: ${ship.id} (${pct(survivalRate)} survival, ${num(avgKills)} kills/battle)`);
  } else if (survivalRate < 0.2 && avgKills < 0.3) {
    issues.push(`SHIP UNDERPOWERED: ${ship.id} (${pct(survivalRate)} survival, ${num(avgKills)} kills/battle)`);
  }
}

// Check for one-sided matchups
for (const matchup of matchupResults) {
  const winRate1 = matchup.stats.team1Wins / matchup.stats.totalBattles;
  const winRate2 = matchup.stats.team2Wins / matchup.stats.totalBattles;

  if (winRate1 > 0.75 || winRate2 > 0.75) {
    const winner = winRate1 > winRate2 ? matchup.faction1 : matchup.faction2;
    const loser = winRate1 > winRate2 ? matchup.faction2 : matchup.faction1;
    const rate = Math.max(winRate1, winRate2);
    issues.push(`ONE-SIDED MATCHUP: ${winner} beats ${loser} ${pct(rate)} of the time`);
  } else if (winRate1 > 0.65 || winRate2 > 0.65) {
    const winner = winRate1 > winRate2 ? matchup.faction1 : matchup.faction2;
    const loser = winRate1 > winRate2 ? matchup.faction2 : matchup.faction1;
    const rate = Math.max(winRate1, winRate2);
    warnings.push(`Uneven matchup: ${winner} beats ${loser} ${pct(rate)} of the time`);
  }
}

// Check for high draw rates
for (const matchup of matchupResults) {
  const drawRate = matchup.stats.draws / matchup.stats.totalBattles;
  if (drawRate > 0.25) {
    warnings.push(`High draw rate: ${matchup.faction1} vs ${matchup.faction2} draws ${pct(drawRate)}`);
  }
}

if (issues.length === 0 && warnings.length === 0) {
  console.log('No significant balance issues detected! The game is well-balanced.');
} else {
  if (issues.length > 0) {
    console.log('CRITICAL ISSUES:');
    for (const issue of issues) {
      console.log(`  - ${issue}`);
    }
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('WARNINGS:');
    for (const warning of warnings) {
      console.log(`  - ${warning}`);
    }
  }
}

console.log('');
console.log('='.repeat(70));
console.log('SIMULATION COMPLETE');
console.log('='.repeat(70));
