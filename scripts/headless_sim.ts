/**
 * Headless Battle Simulation CLI
 *
 * Runs AI vs AI battles using preset loadouts and reports win rates / balance data.
 * Uses upgrade-aware BattleSimulator (loadout bonuses applied to SimShips).
 *
 * Usage:
 *   npx tsx scripts/headless_sim.ts [options]
 *
 * Options:
 *   --faction1 <id>   Faction for team 1 (default: terran_hegemony)
 *   --faction2 <id>   Faction for team 2 (default: void_corsairs)
 *   --budget <pts>    Point budget per squad (default: 200)
 *   --battles <N>     Battles per matchup (default: 200)
 *   --matrix          Run all 10 faction pairs
 *   --export <path>   Write JSON results to file
 */

import { BattleSimulator, type AggregatedStats, type SimShipSpec } from '../src/simulation/BattleSimulator';
import * as fs from 'fs';

// ─── Arg parsing ────────────────────────────────────────────────────────────

type FactionId =
  | 'terran_hegemony'
  | 'free_confederation'
  | 'synthetic_collective'
  | 'void_corsairs'
  | 'ascendant_empire';

const ALL_FACTIONS: FactionId[] = [
  'terran_hegemony',
  'free_confederation',
  'synthetic_collective',
  'void_corsairs',
  'ascendant_empire',
];

const FACTION_LABELS: Record<FactionId, string> = {
  terran_hegemony: 'Terran Hegemony',
  free_confederation: 'Free Confederation',
  synthetic_collective: 'Synthetic Collective',
  void_corsairs: 'Void Corsairs',
  ascendant_empire: 'Ascendant Empire',
};

function parseArgs(): {
  faction1: FactionId;
  faction2: FactionId;
  budget: number;
  battles: number;
  matrix: boolean;
  exportPath: string | null;
} {
  const args = process.argv.slice(2);
  const get = (flag: string): string | null => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1]! : null;
  };

  return {
    faction1: (get('--faction1') ?? 'terran_hegemony') as FactionId,
    faction2: (get('--faction2') ?? 'void_corsairs') as FactionId,
    budget: parseInt(get('--budget') ?? '200', 10),
    battles: parseInt(get('--battles') ?? '200', 10),
    matrix: args.includes('--matrix'),
    exportPath: get('--export'),
  };
}

// ─── Display helpers ─────────────────────────────────────────────────────────

const WIN_RATE_THRESHOLD = 0.60;
const OUTLIER_MARK = '▲';

function pct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

function printMatchup(
  label: string,
  stats: AggregatedStats,
  budget: number,
  battles: number
): void {
  const t1w = stats.team1Wins / stats.totalBattles;
  const t2w = stats.team2Wins / stats.totalBattles;
  const draws = stats.draws / stats.totalBattles;
  const outlier = t1w > WIN_RATE_THRESHOLD || t2w > WIN_RATE_THRESHOLD;

  console.log(`\n${label}  [${budget}pt / ${battles} battles]`);
  console.log(`  Team 1 win: ${pct(t1w)} | Team 2 win: ${pct(t2w)} | Draw: ${pct(draws)}`);
  console.log(`  Avg turns: ${stats.averageTurns.toFixed(1)}`);

  for (const [faction, perf] of stats.factionPerformance) {
    console.log(`  ${faction}: winRate=${pct(perf.winRate)}  avgSurvivors=${perf.averageShipsSurviving.toFixed(2)}`);
  }

  if (outlier) {
    const side = t1w > WIN_RATE_THRESHOLD ? 'Team 1' : 'Team 2';
    console.log(`  ⚠  Win rate >${Math.round(WIN_RATE_THRESHOLD * 100)}%: ${side} — flag for point cost review`);
  }
}

function printMatrix(results: Map<string, AggregatedStats>): void {
  const abbr: Record<FactionId, string> = {
    terran_hegemony: 'TH',
    free_confederation: 'FC',
    synthetic_collective: 'SC',
    void_corsairs: 'VC',
    ascendant_empire: 'AE',
  };

  console.log('\n═══ FACTION WIN-RATE MATRIX (Team 1 win % per row) ═══');
  const header = '          ' + ALL_FACTIONS.map(f => abbr[f].padStart(6)).join('');
  console.log(header);

  for (const f1 of ALL_FACTIONS) {
    let row = abbr[f1].padEnd(10);
    for (const f2 of ALL_FACTIONS) {
      if (f1 === f2) {
        row += '   —  ';
        continue;
      }
      const key1 = `${f1} vs ${f2}`;
      const key2 = `${f2} vs ${f1}`;
      const stats = results.get(key1) ?? results.get(key2);
      if (!stats) { row += '   ?  '; continue; }
      const wr = results.has(key1)
        ? stats.team1Wins / stats.totalBattles
        : stats.team2Wins / stats.totalBattles;
      const mark = wr > WIN_RATE_THRESHOLD ? OUTLIER_MARK : ' ';
      row += (pct(wr) + mark).padStart(6);
    }
    console.log(row);
  }
  console.log(`\n${OUTLIER_MARK} = win rate >${Math.round(WIN_RATE_THRESHOLD * 100)}% (flag for rebalance)`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { faction1, faction2, budget, battles, matrix, exportPath } = parseArgs();

  const sim = new BattleSimulator({ verbose: false, maxTurns: 60 });
  const allResults: Record<string, AggregatedStats> = {};

  if (matrix) {
    console.log(`\nRunning full faction matrix (${battles} battles per matchup)…\n`);
    const mapResults = new Map<string, AggregatedStats>();

    for (let i = 0; i < ALL_FACTIONS.length; i++) {
      for (let j = i + 1; j < ALL_FACTIONS.length; j++) {
        const f1 = ALL_FACTIONS[i]!;
        const f2 = ALL_FACTIONS[j]!;
        const key = `${f1} vs ${f2}`;
        process.stdout.write(`  ${FACTION_LABELS[f1]} vs ${FACTION_LABELS[f2]}… `);

        const t1 = sim.getPresetSquadForFaction(f1, budget);
        const t2 = sim.getPresetSquadForFaction(f2, budget);
        const stats = sim.runBatchSimulation(t1, t2, battles);

        mapResults.set(key, stats);
        allResults[key] = stats;
        process.stdout.write('done\n');
      }
    }

    printMatrix(mapResults);
  } else {
    const label = `${FACTION_LABELS[faction1]} vs ${FACTION_LABELS[faction2]}`;
    console.log(`\nRunning: ${label}…`);

    const t1: SimShipSpec[] = sim.getPresetSquadForFaction(faction1, budget);
    const t2: SimShipSpec[] = sim.getPresetSquadForFaction(faction2, budget);
    const stats = sim.runBatchSimulation(t1, t2, battles);

    printMatchup(label, stats, budget, battles);
    allResults[label] = stats;
  }

  if (exportPath) {
    const exportable = Object.fromEntries(
      Object.entries(allResults).map(([k, v]) => [
        k,
        {
          ...v,
          shipPerformance: Object.fromEntries(v.shipPerformance),
          factionPerformance: Object.fromEntries(v.factionPerformance),
        },
      ])
    );
    fs.writeFileSync(exportPath, JSON.stringify(exportable, null, 2));
    console.log(`\nResults written to ${exportPath}`);
  }
}

main().catch(err => {
  console.error('Simulation failed:', err);
  process.exit(1);
});
