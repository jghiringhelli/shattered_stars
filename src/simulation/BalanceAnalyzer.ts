/**
 * Balance Analyzer
 *
 * Comprehensive analysis combining:
 * - Battle simulation statistics
 * - Gameplay feel metrics
 * - Faction and ship balance
 * - Actionable recommendations
 *
 * This is the main entry point for understanding game health.
 */

import { BattleSimulator } from "./BattleSimulator";
import {
  GameplayMetricsAnalyzer,
  type GameplayFeelReport,
} from "./GameplayMetrics";
import { SHIP_DEFINITIONS } from "../data/ShipDefinitions";
import { MONSTER_DEFINITIONS, getBossMonsters } from "../data/SpaceMonsters";
import type { FactionId } from "../config";

// ============================================
// Types
// ============================================

export interface BalanceReport {
  // Simulation data
  factionBalance: FactionBalanceData;
  shipBalance: ShipBalanceData;
  roleBalance: RoleBalanceData;

  // Gameplay feel
  gameplayFeel: GameplayFeelReport;

  // Monster/PvE analysis
  monsterAnalysis: MonsterAnalysis;

  // Overall health
  overallHealth: OverallHealthScore;

  // Recommendations
  recommendations: PrioritizedRecommendation[];

  // Metadata
  generatedAt: string;
  simulationRuns: number;
  mode: "arcade" | "continuous";
}

export interface FactionBalanceData {
  factions: Map<FactionId, FactionStats>;
  matchups: Map<string, MatchupStats>;
  imbalanceWarnings: string[];
}

export interface FactionStats {
  faction: FactionId;
  overallWinRate: number;
  shipCount: number;
  avgPointCost: number;
  avgEfficiency: number; // Damage per point
  strongestMatchup: { opponent: FactionId; winRate: number };
  weakestMatchup: { opponent: FactionId; winRate: number };
}

export interface MatchupStats {
  faction1: FactionId;
  faction2: FactionId;
  faction1WinRate: number;
  faction2WinRate: number;
  drawRate: number;
  averageTurns: number;
  balance:
    "balanced" | "slightly_favored" | "imbalanced" | "severely_imbalanced";
}

export interface ShipBalanceData {
  ships: Map<string, ShipStats>;
  overperformers: string[];
  underperformers: string[];
  outliers: string[];
}

export interface ShipStats {
  shipId: string;
  faction: FactionId;
  role: string;
  pointCost: number;
  survivalRate: number;
  avgKills: number;
  avgDamage: number;
  efficiency: number; // Performance per point cost
  rating: "S" | "A" | "B" | "C" | "D" | "F";
}

export interface RoleBalanceData {
  roles: Map<string, RoleStats>;
  rockPaperScissors: boolean; // Is there a healthy counter system?
  dominantRole: string | null;
  underpoweredRole: string | null;
}

export interface RoleStats {
  role: string;
  shipCount: number;
  avgSurvivalRate: number;
  avgDamage: number;
  avgPointCost: number;
  vsOtherRoles: Map<string, number>; // Win rate vs each role
}

export interface MonsterAnalysis {
  totalMonsters: number;
  bossCount: number;
  categoryBreakdown: Map<string, number>;
  difficultySpread: DifficultySpread;
  designIssues: string[];
}

export interface DifficultySpread {
  easy: number; // 0-5
  medium: number; // 6-12
  hard: number; // 13-18
  extreme: number; // 19+
}

export interface OverallHealthScore {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  breakdown: {
    factionBalance: number;
    shipBalance: number;
    gameplayFeel: number;
    pveContent: number;
  };
  criticalIssues: string[];
}

export interface PrioritizedRecommendation {
  priority: "critical" | "high" | "medium" | "low";
  category: "balance" | "gameplay" | "content" | "polish";
  title: string;
  description: string;
  effort: "small" | "medium" | "large";
  impact: "small" | "medium" | "large";
}

// ============================================
// Main Analyzer Class
// ============================================

export class BalanceAnalyzer {
  private battleSim: BattleSimulator;
  private metricsAnalyzer: GameplayMetricsAnalyzer;
  private mode: "arcade" | "continuous";
  private battlesPerMatchup: number;

  constructor(
    mode: "arcade" | "continuous" = "continuous",
    battlesPerMatchup: number = 50,
  ) {
    this.mode = mode;
    this.battlesPerMatchup = battlesPerMatchup;
    this.battleSim = new BattleSimulator({
      mode,
      verbose: false,
      maxTurns: 60,
    });
    this.metricsAnalyzer = new GameplayMetricsAnalyzer(mode);
  }

  /**
   * Run complete analysis and generate report
   */
  async analyze(): Promise<BalanceReport> {
    console.log("Starting comprehensive balance analysis...\n");

    console.log("1. Analyzing faction balance...");
    const factionBalance = this.analyzeFactionBalance();

    console.log("2. Analyzing ship balance...");
    const shipBalance = this.analyzeShipBalance(factionBalance);

    console.log("3. Analyzing role balance...");
    const roleBalance = this.analyzeRoleBalance();

    console.log("4. Analyzing gameplay feel...");
    const gameplayFeel = this.metricsAnalyzer.analyzeGameplayFeel();

    console.log("5. Analyzing monster/PvE content...");
    const monsterAnalysis = this.analyzeMonsters();

    console.log("6. Calculating overall health...");
    const overallHealth = this.calculateOverallHealth(
      factionBalance,
      shipBalance,
      gameplayFeel,
      monsterAnalysis,
    );

    console.log("7. Generating recommendations...");
    const recommendations = this.generateRecommendations(
      factionBalance,
      shipBalance,
      roleBalance,
      gameplayFeel,
      monsterAnalysis,
      overallHealth,
    );

    return {
      factionBalance,
      shipBalance,
      roleBalance,
      gameplayFeel,
      monsterAnalysis,
      overallHealth,
      recommendations,
      generatedAt: new Date().toISOString(),
      simulationRuns: this.battlesPerMatchup * 10, // Rough estimate
      mode: this.mode,
    };
  }

  /**
   * Analyze faction balance through simulated battles
   */
  private analyzeFactionBalance(): FactionBalanceData {
    const factions: FactionId[] = [
      "terran_hegemony",
      "free_confederation",
      "synthetic_collective",
      "void_corsairs",
      "ascendant_empire",
    ];

    const matchups = new Map<string, MatchupStats>();
    const factionStats = new Map<FactionId, FactionStats>();
    const warnings: string[] = [];

    // Run all matchups
    const matchupResults = this.battleSim.runAllFactionMatchups(
      3,
      this.battlesPerMatchup,
    );

    // Process matchup results
    for (const [matchupKey, stats] of matchupResults) {
      const [f1, , f2] = matchupKey.split(" ");
      const faction1 = f1 as FactionId;
      const faction2 = f2 as FactionId;

      const f1WinRate = stats.team1Wins / stats.totalBattles;
      const f2WinRate = stats.team2Wins / stats.totalBattles;
      const drawRate = stats.draws / stats.totalBattles;

      let balance: MatchupStats["balance"];
      const diff = Math.abs(f1WinRate - f2WinRate);
      if (diff < 0.1) balance = "balanced";
      else if (diff < 0.25) balance = "slightly_favored";
      else if (diff < 0.4) balance = "imbalanced";
      else balance = "severely_imbalanced";

      if (balance === "imbalanced" || balance === "severely_imbalanced") {
        const favored = f1WinRate > f2WinRate ? faction1 : faction2;
        const unfavored = f1WinRate > f2WinRate ? faction2 : faction1;
        warnings.push(
          `${favored} has ${balance} advantage over ${unfavored} (${(Math.max(f1WinRate, f2WinRate) * 100).toFixed(0)}% win rate)`,
        );
      }

      matchups.set(matchupKey, {
        faction1,
        faction2,
        faction1WinRate: f1WinRate,
        faction2WinRate: f2WinRate,
        drawRate,
        averageTurns: stats.averageTurns,
        balance,
      });
    }

    // Calculate per-faction stats
    for (const faction of factions) {
      const ships = Object.values(SHIP_DEFINITIONS).filter(
        (s) => s.faction === faction,
      );
      const avgCost =
        ships.reduce((sum, s) => sum + s.baseStats.pointCost, 0) / ships.length;

      let wins = 0;
      let games = 0;
      let strongestMatchup = { opponent: factions[0]!, winRate: 0 };
      let weakestMatchup = { opponent: factions[0]!, winRate: 1 };

      for (const ms of matchups.values()) {
        if (ms.faction1 === faction) {
          wins += ms.faction1WinRate;
          games++;
          if (ms.faction1WinRate > strongestMatchup.winRate) {
            strongestMatchup = {
              opponent: ms.faction2,
              winRate: ms.faction1WinRate,
            };
          }
          if (ms.faction1WinRate < weakestMatchup.winRate) {
            weakestMatchup = {
              opponent: ms.faction2,
              winRate: ms.faction1WinRate,
            };
          }
        } else if (ms.faction2 === faction) {
          wins += ms.faction2WinRate;
          games++;
          if (ms.faction2WinRate > strongestMatchup.winRate) {
            strongestMatchup = {
              opponent: ms.faction1,
              winRate: ms.faction2WinRate,
            };
          }
          if (ms.faction2WinRate < weakestMatchup.winRate) {
            weakestMatchup = {
              opponent: ms.faction1,
              winRate: ms.faction2WinRate,
            };
          }
        }
      }

      factionStats.set(faction, {
        faction,
        overallWinRate: games > 0 ? wins / games : 0.5,
        shipCount: ships.length,
        avgPointCost: avgCost,
        avgEfficiency: 1, // Would need more detailed simulation
        strongestMatchup,
        weakestMatchup,
      });
    }

    return { factions: factionStats, matchups, imbalanceWarnings: warnings };
  }

  /**
   * Analyze individual ship balance
   */
  private analyzeShipBalance(
    _factionData: FactionBalanceData,
  ): ShipBalanceData {
    const ships = new Map<string, ShipStats>();
    const overperformers: string[] = [];
    const underperformers: string[] = [];
    const outliers: string[] = [];

    const allShips = Object.values(SHIP_DEFINITIONS);

    for (const ship of allShips) {
      const stats = ship.baseStats;

      // Calculate a simple efficiency score
      const offensivePower =
        stats.attack * 2 + (stats.actions?.includes("target_lock") ? 0.5 : 0);
      const defensivePower = stats.hull + stats.shields + stats.agility * 1.5;
      const mobilityScore =
        stats.speed.max -
        stats.speed.min +
        (stats.actions?.includes("boost") ? 1 : 0);

      const totalPower = offensivePower + defensivePower + mobilityScore;
      const efficiency = totalPower / stats.pointCost;

      // Estimate survival and damage based on stats
      const estimatedSurvival =
        (stats.hull + stats.shields + stats.agility) / 15;
      const estimatedDamage = stats.attack * 3;

      // Calculate rating
      let rating: ShipStats["rating"];
      if (efficiency > 0.35) rating = "S";
      else if (efficiency > 0.3) rating = "A";
      else if (efficiency > 0.25) rating = "B";
      else if (efficiency > 0.2) rating = "C";
      else if (efficiency > 0.15) rating = "D";
      else rating = "F";

      // Track outliers
      if (efficiency > 0.4) {
        overperformers.push(ship.id);
        outliers.push(
          `${ship.name}: Too efficient (${(efficiency * 100).toFixed(0)}%)`,
        );
      } else if (efficiency < 0.15) {
        underperformers.push(ship.id);
        outliers.push(
          `${ship.name}: Underperforming (${(efficiency * 100).toFixed(0)}%)`,
        );
      }

      ships.set(ship.id, {
        shipId: ship.id,
        faction: ship.faction,
        role: ship.role,
        pointCost: stats.pointCost,
        survivalRate: Math.min(1, estimatedSurvival),
        avgKills: estimatedDamage / 5, // Rough estimate
        avgDamage: estimatedDamage,
        efficiency,
        rating,
      });
    }

    return { ships, overperformers, underperformers, outliers };
  }

  /**
   * Analyze role balance
   */
  private analyzeRoleBalance(): RoleBalanceData {
    const roles = new Map<string, RoleStats>();
    const allShips = Object.values(SHIP_DEFINITIONS);

    // Group ships by role
    const roleGroups = new Map<string, typeof allShips>();
    for (const ship of allShips) {
      if (!roleGroups.has(ship.role)) {
        roleGroups.set(ship.role, []);
      }
      roleGroups.get(ship.role)!.push(ship);
    }

    // Calculate per-role stats
    for (const [role, ships] of roleGroups) {
      const avgCost =
        ships.reduce((sum, s) => sum + s.baseStats.pointCost, 0) / ships.length;
      const avgDamage =
        ships.reduce((sum, s) => sum + s.baseStats.attack * 3, 0) /
        ships.length;
      const avgSurvival =
        ships.reduce((sum, s) => {
          return (
            sum +
            (s.baseStats.hull + s.baseStats.shields + s.baseStats.agility) / 15
          );
        }, 0) / ships.length;

      roles.set(role, {
        role,
        shipCount: ships.length,
        avgSurvivalRate: Math.min(1, avgSurvival),
        avgDamage,
        avgPointCost: avgCost,
        vsOtherRoles: new Map(), // Would need simulation to fill
      });
    }

    // Check for dominant/underpowered roles
    let dominantRole: string | null = null;
    let underpoweredRole: string | null = null;
    let maxScore = 0;
    let minScore = Infinity;

    for (const [role, stats] of roles) {
      const score =
        (stats.avgSurvivalRate * stats.avgDamage) / stats.avgPointCost;
      if (score > maxScore) {
        maxScore = score;
        dominantRole = role;
      }
      if (score < minScore) {
        minScore = score;
        underpoweredRole = role;
      }
    }

    // Only flag if difference is significant
    if (maxScore - minScore < 0.2) {
      dominantRole = null;
      underpoweredRole = null;
    }

    return {
      roles,
      rockPaperScissors: roles.size >= 3, // Has enough variety for counter-play
      dominantRole,
      underpoweredRole,
    };
  }

  /**
   * Analyze monster/PvE content
   */
  private analyzeMonsters(): MonsterAnalysis {
    const monsters = Object.values(MONSTER_DEFINITIONS);
    const bosses = getBossMonsters();
    const designIssues: string[] = [];

    // Category breakdown
    const categoryBreakdown = new Map<string, number>();
    for (const monster of monsters) {
      const count = categoryBreakdown.get(monster.category) || 0;
      categoryBreakdown.set(monster.category, count + 1);
    }

    // Difficulty spread based on effective health and abilities
    const difficultySpread: DifficultySpread = {
      easy: 0,
      medium: 0,
      hard: 0,
      extreme: 0,
    };
    for (const monster of monsters) {
      const effectiveHealth =
        monster.hull + monster.shields + monster.armor * 5;
      const abilityPower = monster.abilities.length * 2;
      const difficulty = effectiveHealth / 5 + abilityPower;

      if (difficulty <= 5) difficultySpread.easy++;
      else if (difficulty <= 12) difficultySpread.medium++;
      else if (difficulty <= 18) difficultySpread.hard++;
      else difficultySpread.extreme++;
    }

    // Check for design issues
    if (difficultySpread.easy < 2) {
      designIssues.push("Not enough easy monsters for early game");
    }
    if (difficultySpread.extreme < 2) {
      designIssues.push("Not enough extreme difficulty bosses for endgame");
    }
    if (bosses.length < 5) {
      designIssues.push("Need more boss encounters for variety");
    }
    if (categoryBreakdown.size < 4) {
      designIssues.push("Need more monster categories for variety");
    }

    return {
      totalMonsters: monsters.length,
      bossCount: bosses.length,
      categoryBreakdown,
      difficultySpread,
      designIssues,
    };
  }

  /**
   * Calculate overall health score
   */
  private calculateOverallHealth(
    factionBalance: FactionBalanceData,
    shipBalance: ShipBalanceData,
    gameplayFeel: GameplayFeelReport,
    monsterAnalysis: MonsterAnalysis,
  ): OverallHealthScore {
    const criticalIssues: string[] = [];

    // Faction balance score (0-25)
    let factionScore = 25;
    factionScore -= factionBalance.imbalanceWarnings.length * 5;
    factionScore = Math.max(0, factionScore);
    if (factionScore < 10) {
      criticalIssues.push("Severe faction imbalance detected");
    }

    // Ship balance score (0-25)
    let shipScore = 25;
    shipScore -= shipBalance.outliers.length * 2;
    shipScore = Math.max(0, shipScore);
    if (shipBalance.overperformers.length > 5) {
      criticalIssues.push("Too many overperforming ships");
    }

    // Gameplay feel score (0-25)
    const gameplayScore = gameplayFeel.overallAssessment.healthScore * 0.25;
    if (gameplayFeel.funFactor.warnings.length > 3) {
      criticalIssues.push("Multiple gameplay feel warnings");
    }

    // PvE content score (0-25)
    let pveScore = 25;
    pveScore -= monsterAnalysis.designIssues.length * 4;
    pveScore = Math.max(0, pveScore);

    const totalScore = Math.round(
      factionScore + shipScore + gameplayScore + pveScore,
    );

    let grade: OverallHealthScore["grade"];
    if (totalScore >= 85) grade = "A";
    else if (totalScore >= 70) grade = "B";
    else if (totalScore >= 55) grade = "C";
    else if (totalScore >= 40) grade = "D";
    else grade = "F";

    return {
      score: totalScore,
      grade,
      breakdown: {
        factionBalance: factionScore,
        shipBalance: shipScore,
        gameplayFeel: gameplayScore,
        pveContent: pveScore,
      },
      criticalIssues,
    };
  }

  /**
   * Generate prioritized recommendations
   */
  private generateRecommendations(
    factionBalance: FactionBalanceData,
    shipBalance: ShipBalanceData,
    roleBalance: RoleBalanceData,
    gameplayFeel: GameplayFeelReport,
    monsterAnalysis: MonsterAnalysis,
    overallHealth: OverallHealthScore,
  ): PrioritizedRecommendation[] {
    const recommendations: PrioritizedRecommendation[] = [];

    // Critical issues first
    for (const issue of overallHealth.criticalIssues) {
      recommendations.push({
        priority: "critical",
        category: "balance",
        title: "Critical Issue",
        description: issue,
        effort: "medium",
        impact: "large",
      });
    }

    // Faction balance recommendations
    for (const warning of factionBalance.imbalanceWarnings) {
      recommendations.push({
        priority: "high",
        category: "balance",
        title: "Faction Imbalance",
        description: warning,
        effort: "medium",
        impact: "large",
      });
    }

    // Ship balance recommendations
    if (shipBalance.overperformers.length > 0) {
      recommendations.push({
        priority: "high",
        category: "balance",
        title: "Nerf Overperformers",
        description: `Ships needing nerfs: ${shipBalance.overperformers.slice(0, 5).join(", ")}`,
        effort: "small",
        impact: "medium",
      });
    }

    if (shipBalance.underperformers.length > 0) {
      recommendations.push({
        priority: "medium",
        category: "balance",
        title: "Buff Underperformers",
        description: `Ships needing buffs: ${shipBalance.underperformers.slice(0, 5).join(", ")}`,
        effort: "small",
        impact: "medium",
      });
    }

    // Role balance
    if (roleBalance.dominantRole) {
      recommendations.push({
        priority: "medium",
        category: "balance",
        title: "Role Dominance",
        description: `${roleBalance.dominantRole} role may be too strong. Consider counters.`,
        effort: "medium",
        impact: "medium",
      });
    }

    // Gameplay feel recommendations
    for (const rec of gameplayFeel.recommendations) {
      recommendations.push({
        priority: "medium",
        category: "gameplay",
        title: "Gameplay Feel",
        description: rec,
        effort: "medium",
        impact: "large",
      });
    }

    // Monster/PvE recommendations
    for (const issue of monsterAnalysis.designIssues) {
      recommendations.push({
        priority: "low",
        category: "content",
        title: "PvE Content",
        description: issue,
        effort: "medium",
        impact: "small",
      });
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recommendations.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );

    return recommendations;
  }

  /**
   * Generate formatted text report
   */
  generateReport(report: BalanceReport): string {
    let output = "";

    output +=
      "╔══════════════════════════════════════════════════════════════════════╗\n";
    output +=
      "║              SHATTERED STARS - BALANCE ANALYSIS REPORT               ║\n";
    output += `║              Generated: ${report.generatedAt.substring(0, 19).replace("T", " ")}                       ║\n`;
    output +=
      "╚══════════════════════════════════════════════════════════════════════╝\n\n";

    // Overall Health
    output +=
      "┌──────────────────────────────────────────────────────────────────────┐\n";
    output +=
      "│ OVERALL HEALTH                                                       │\n";
    output +=
      "├──────────────────────────────────────────────────────────────────────┤\n";
    output += `│ Grade: ${report.overallHealth.grade}    Score: ${report.overallHealth.score}/100                                          │\n`;
    output +=
      "│                                                                      │\n";
    output +=
      "│ Breakdown:                                                           │\n";
    output += `│   Faction Balance:  ${report.overallHealth.breakdown.factionBalance.toString().padStart(2)}/25                                          │\n`;
    output += `│   Ship Balance:     ${report.overallHealth.breakdown.shipBalance.toString().padStart(2)}/25                                          │\n`;
    output += `│   Gameplay Feel:    ${report.overallHealth.breakdown.gameplayFeel.toFixed(0).padStart(2)}/25                                          │\n`;
    output += `│   PvE Content:      ${report.overallHealth.breakdown.pveContent.toString().padStart(2)}/25                                          │\n`;

    if (report.overallHealth.criticalIssues.length > 0) {
      output +=
        "│                                                                      │\n";
      output +=
        "│ ⚠ CRITICAL ISSUES:                                                  │\n";
      for (const issue of report.overallHealth.criticalIssues) {
        output += `│   • ${issue.substring(0, 64).padEnd(64)}│\n`;
      }
    }
    output +=
      "└──────────────────────────────────────────────────────────────────────┘\n\n";

    // Faction Balance Summary
    output +=
      "┌──────────────────────────────────────────────────────────────────────┐\n";
    output +=
      "│ FACTION BALANCE                                                      │\n";
    output +=
      "├──────────────────────────────────────────────────────────────────────┤\n";
    for (const [faction, stats] of report.factionBalance.factions) {
      const winRate = (stats.overallWinRate * 100).toFixed(0);
      output += `│ ${faction.padEnd(22)} Win Rate: ${winRate.padStart(3)}%  Ships: ${stats.shipCount.toString().padStart(2)}            │\n`;
    }

    if (report.factionBalance.imbalanceWarnings.length > 0) {
      output +=
        "│                                                                      │\n";
      output +=
        "│ Warnings:                                                            │\n";
      for (const warning of report.factionBalance.imbalanceWarnings.slice(
        0,
        3,
      )) {
        output += `│   • ${warning.substring(0, 64).padEnd(64)}│\n`;
      }
    }
    output +=
      "└──────────────────────────────────────────────────────────────────────┘\n\n";

    // Ship Balance Summary
    output +=
      "┌──────────────────────────────────────────────────────────────────────┐\n";
    output +=
      "│ SHIP BALANCE                                                         │\n";
    output +=
      "├──────────────────────────────────────────────────────────────────────┤\n";
    output += `│ Total Ships: ${report.shipBalance.ships.size}                                                      │\n`;
    output += `│ Overperformers: ${report.shipBalance.overperformers.length}    Underperformers: ${report.shipBalance.underperformers.length}                          │\n`;

    if (report.shipBalance.outliers.length > 0) {
      output +=
        "│                                                                      │\n";
      output +=
        "│ Outliers:                                                            │\n";
      for (const outlier of report.shipBalance.outliers.slice(0, 5)) {
        output += `│   • ${outlier.substring(0, 64).padEnd(64)}│\n`;
      }
    }
    output +=
      "└──────────────────────────────────────────────────────────────────────┘\n\n";

    // Monster Analysis
    output +=
      "┌──────────────────────────────────────────────────────────────────────┐\n";
    output +=
      "│ PVE CONTENT (MONSTERS)                                               │\n";
    output +=
      "├──────────────────────────────────────────────────────────────────────┤\n";
    output += `│ Total Monsters: ${report.monsterAnalysis.totalMonsters}    Bosses: ${report.monsterAnalysis.bossCount}                                        │\n`;
    output +=
      "│                                                                      │\n";
    output +=
      "│ Difficulty Spread:                                                   │\n";
    output += `│   Easy: ${report.monsterAnalysis.difficultySpread.easy}  Medium: ${report.monsterAnalysis.difficultySpread.medium}  Hard: ${report.monsterAnalysis.difficultySpread.hard}  Extreme: ${report.monsterAnalysis.difficultySpread.extreme}                        │\n`;

    if (report.monsterAnalysis.designIssues.length > 0) {
      output +=
        "│                                                                      │\n";
      output +=
        "│ Issues:                                                              │\n";
      for (const issue of report.monsterAnalysis.designIssues) {
        output += `│   • ${issue.substring(0, 64).padEnd(64)}│\n`;
      }
    }
    output +=
      "└──────────────────────────────────────────────────────────────────────┘\n\n";

    // Recommendations
    output +=
      "┌──────────────────────────────────────────────────────────────────────┐\n";
    output +=
      "│ PRIORITIZED RECOMMENDATIONS                                          │\n";
    output +=
      "├──────────────────────────────────────────────────────────────────────┤\n";

    for (const rec of report.recommendations.slice(0, 10)) {
      const priority = rec.priority.toUpperCase().padEnd(8);
      output += `│ [${priority}] ${rec.title.padEnd(20)}                                  │\n`;
      const descLines = this.wrapText(rec.description, 60);
      for (const line of descLines) {
        output += `│     ${line.padEnd(65)}│\n`;
      }
      output +=
        "│                                                                      │\n";
    }

    output +=
      "└──────────────────────────────────────────────────────────────────────┘\n";

    return output;
  }

  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= maxWidth) {
        currentLine += (currentLine ? " " : "") + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }
}

// Convenience function for quick analysis
export async function runBalanceAnalysis(
  mode: "arcade" | "continuous" = "continuous",
  battlesPerMatchup: number = 30,
): Promise<string> {
  const analyzer = new BalanceAnalyzer(mode, battlesPerMatchup);
  const report = await analyzer.analyze();
  return analyzer.generateReport(report);
}
