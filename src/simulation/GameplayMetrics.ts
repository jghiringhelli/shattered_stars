/**
 * Gameplay Feel Metrics System
 *
 * Measures playability characteristics beyond raw balance:
 * - TTK (Time to Kill): How quickly ships are destroyed
 * - Pacing: Engagement speed, decision frequency
 * - Skill Expression: How much piloting matters vs composition
 * - Fun Factor: Comeback potential, variance, tension
 *
 * Reference benchmarks from well-regarded games:
 * - FTL: Slower, strategic pacing (TTK 30-60s per ship)
 * - X-Wing Miniatures: Moderate pacing (TTK 2-4 turns)
 * - Star Wars Squadrons: Fast, action-oriented (TTK 5-15s)
 */

import type { FactionId } from "../config";
import { SHIP_DEFINITIONS, getShipDefinition } from "../data/ShipDefinitions";
import { getModeCombatStats, calculateHitChance } from "../data/ModeBalancing";

/** Abstract simulators stay on miniature hull/shield points. */
const MINIATURE_SCALE = 1;

// ============================================
// Types
// ============================================

export interface TTKMetrics {
  /** Average turns to destroy a ship */
  averageTTK: number;
  /** Fastest possible TTK (best case scenario) */
  minTTK: number;
  /** Slowest TTK (worst case scenario) */
  maxTTK: number;
  /** Standard deviation - high = swingy, low = predictable */
  ttlVariance: number;
  /** TTK rating: 'instant' | 'fast' | 'moderate' | 'slow' | 'glacial' */
  rating: TTKRating;
  /** Per-ship breakdown */
  shipBreakdown: Map<string, ShipTTKData>;
}

export interface ShipTTKData {
  shipId: string;
  averageTTK: number;
  effectiveHealth: number;
  healthPerTurn: number; // Damage taken per turn when focused
}

export type TTKRating = "instant" | "fast" | "moderate" | "slow" | "glacial";

export interface PacingMetrics {
  /** Average turns before first contact */
  engagementDelay: number;
  /** Decisions per minute (turns with meaningful choices) */
  decisionsPerMinute: number;
  /** Average turns per battle */
  averageBattleLength: number;
  /** Percentage of turns with active combat */
  combatDensity: number;
  /** Pacing rating */
  rating: PacingRating;
  /** Recommended turn timer (seconds) for target DPM */
  recommendedTurnTimer: number;
}

export type PacingRating =
  "frantic" | "fast" | "balanced" | "deliberate" | "slow";

export interface SkillExpressionMetrics {
  /** How much positioning matters (0-1) */
  positioningImpact: number;
  /** How much action choices matter (0-1) */
  actionImpact: number;
  /** How much maneuver selection matters (0-1) */
  maneuverImpact: number;
  /** Raw stats contribution to outcomes (0-1) */
  statDominance: number;
  /** Composition (squad building) impact (0-1) */
  compositionImpact: number;
  /** Overall skill ceiling rating */
  rating: SkillRating;
  /** Specific skill expression breakdown */
  breakdown: SkillBreakdown;
}

export interface SkillBreakdown {
  /** Can good positioning overcome stat disadvantage? */
  canOutmaneuver: boolean;
  /** How many viable options per turn? */
  averageViableChoices: number;
  /** Punishment for mistakes (damage per bad decision) */
  mistakePunishment: number;
  /** Reward for optimal play (damage bonus for perfect positioning) */
  optimalPlayReward: number;
}

export type SkillRating =
  "chess" | "tactical" | "balanced" | "accessible" | "casual";

export interface FunFactorMetrics {
  /** Can losing side come back? (0-1) */
  comebackPotential: number;
  /** How often do exciting reversals happen? */
  reversalRate: number;
  /** Outcome variance (high = exciting but potentially frustrating) */
  outcomeVariance: number;
  /** Tension buildup (close matches vs blowouts) */
  tensionRating: number;
  /** Overall fun assessment */
  rating: FunRating;
  /** Warning flags for un-fun patterns */
  warnings: string[];
}

export type FunRating =
  "excellent" | "good" | "decent" | "mixed" | "needs_work";

export interface GameplayFeelReport {
  ttk: TTKMetrics;
  pacing: PacingMetrics;
  skillExpression: SkillExpressionMetrics;
  funFactor: FunFactorMetrics;
  overallAssessment: OverallAssessment;
  recommendations: string[];
}

export interface OverallAssessment {
  /** Game feel archetype */
  archetype: "action" | "tactical" | "strategic" | "hybrid";
  /** Similar commercial games */
  similarTo: string[];
  /** Target audience */
  targetAudience: string;
  /** Overall health score (0-100) */
  healthScore: number;
}

// ============================================
// Constants - Reference Benchmarks
// ============================================

/** Reference TTK values from well-regarded games (in their equivalent "turns") */
export const TTK_BENCHMARKS = {
  // Action games: 1-3 turns equivalent
  starWarsSquadrons: { ttk: 2, style: "action" as const },
  // Tactical games: 3-6 turns
  xwingMiniatures: { ttk: 4, style: "tactical" as const },
  intoTheBreach: { ttk: 3, style: "tactical" as const },
  // Strategic games: 6+ turns
  ftl: { ttk: 8, style: "strategic" as const },
  homeworld: { ttk: 10, style: "strategic" as const },
};

/** Ideal pacing ranges */
export const PACING_TARGETS = {
  decisionsPerMinute: { min: 3, ideal: 6, max: 12 },
  combatDensity: { min: 0.4, ideal: 0.7, max: 0.95 },
  battleLength: { min: 8, ideal: 20, max: 50 },
};

/** Skill expression ideals for tactical game */
export const SKILL_TARGETS = {
  positioningImpact: 0.3, // 30% of outcome from positioning
  actionImpact: 0.25, // 25% from action choices
  maneuverImpact: 0.2, // 20% from maneuver selection
  statDominance: 0.15, // 15% from raw stats (unavoidable)
  compositionImpact: 0.1, // 10% from squad building
};

// ============================================
// Main Analysis Class
// ============================================

export class GameplayMetricsAnalyzer {
  private mode: "arcade" | "continuous";
  private sampleSize: number;

  constructor(
    mode: "arcade" | "continuous" = "continuous",
    sampleSize: number = 100,
  ) {
    this.mode = mode;
    this.sampleSize = sampleSize;
  }

  /**
   * Generate a complete gameplay feel report
   */
  analyzeGameplayFeel(): GameplayFeelReport {
    const ttk = this.analyzeTTK();
    const pacing = this.analyzePacing(ttk);
    const skillExpression = this.analyzeSkillExpression();
    const funFactor = this.analyzeFunFactor(ttk, pacing, skillExpression);

    const overallAssessment = this.generateOverallAssessment(
      ttk,
      pacing,
      skillExpression,
      funFactor,
    );
    const recommendations = this.generateRecommendations(
      ttk,
      pacing,
      skillExpression,
      funFactor,
    );

    return {
      ttk,
      pacing,
      skillExpression,
      funFactor,
      overallAssessment,
      recommendations,
    };
  }

  /**
   * Analyze Time-to-Kill metrics.
   * Capital ships are excluded: they are intentionally boss-tier (tripled
   * hull/shields + flat armor) and would skew the "typical" TTK this metric
   * is meant to represent.
   */
  analyzeTTK(): TTKMetrics {
    const shipBreakdown = new Map<string, ShipTTKData>();
    const allTTKs: number[] = [];

    const ships = Object.values(SHIP_DEFINITIONS).filter(
      (s) => s.role !== "capital",
    );

    for (const ship of ships) {
      const combatStats = getModeCombatStats(
        ship.id,
        this.mode,
        MINIATURE_SCALE,
      );

      // Calculate effective health (hull + shields)
      const effectiveHealth = ship.baseStats.hull + ship.baseStats.shields;

      // Calculate average incoming DPS from a "standard" attacker
      // Using average attacker (3 attack dice) vs this ship's agility
      const avgAttackDice = 3;
      const hitChance = calculateHitChance(
        avgAttackDice,
        combatStats.agilityDice,
      );
      const damagePerHit = avgAttackDice * 0.5; // Average damage when hit
      const avgDamagePerTurn = damagePerHit * hitChance;

      // TTK = effective health / damage per turn
      const ttk =
        avgDamagePerTurn > 0 ? effectiveHealth / avgDamagePerTurn : 999;

      shipBreakdown.set(ship.id, {
        shipId: ship.id,
        averageTTK: ttk,
        effectiveHealth,
        healthPerTurn: avgDamagePerTurn,
      });

      allTTKs.push(ttk);
    }

    const averageTTK = allTTKs.reduce((a, b) => a + b, 0) / allTTKs.length;
    const minTTK = Math.min(...allTTKs);
    const maxTTK = Math.max(...allTTKs);

    // Calculate variance
    const variance =
      allTTKs.reduce((sum, ttk) => sum + Math.pow(ttk - averageTTK, 2), 0) /
      allTTKs.length;
    const stdDev = Math.sqrt(variance);

    // Determine rating
    let rating: TTKRating;
    if (averageTTK < 2) rating = "instant";
    else if (averageTTK < 4) rating = "fast";
    else if (averageTTK < 7) rating = "moderate";
    else if (averageTTK < 12) rating = "slow";
    else rating = "glacial";

    return {
      averageTTK,
      minTTK,
      maxTTK,
      ttlVariance: stdDev,
      rating,
      shipBreakdown,
    };
  }

  /**
   * Analyze pacing metrics
   */
  analyzePacing(ttk: TTKMetrics): PacingMetrics {
    // Engagement delay based on spawn positions and speeds
    const avgSpeed = 2.5; // Average speed across ships
    const spawnGap = 400; // From BattleSimulator
    const pixelsPerSpeed = 40; // SPEED_SCALE_FACTOR
    const engagementDelay = Math.ceil(
      spawnGap / (avgSpeed * pixelsPerSpeed * 2),
    );

    // Battle length estimation
    const avgShipsPerSide = 3;
    const averageBattleLength = ttk.averageTTK * avgShipsPerSide * 0.7; // Ships don't die sequentially

    // Combat density (what % of battle is active combat vs maneuvering)
    const combatDensity = Math.min(
      0.9,
      1 - engagementDelay / averageBattleLength,
    );

    // Decisions per minute (assuming 5 second turns in continuous mode)
    const turnDuration = this.mode === "continuous" ? 5 : 15;
    const decisionsPerMinute = 60 / turnDuration;

    // Recommended turn timer for target 6 DPM
    const recommendedTurnTimer = 60 / PACING_TARGETS.decisionsPerMinute.ideal;

    // Determine rating
    let rating: PacingRating;
    if (decisionsPerMinute > 10) rating = "frantic";
    else if (decisionsPerMinute > 7) rating = "fast";
    else if (decisionsPerMinute > 4) rating = "balanced";
    else if (decisionsPerMinute > 2) rating = "deliberate";
    else rating = "slow";

    return {
      engagementDelay,
      decisionsPerMinute,
      averageBattleLength,
      combatDensity,
      rating,
      recommendedTurnTimer,
    };
  }

  /**
   * Analyze skill expression
   */
  analyzeSkillExpression(): SkillExpressionMetrics {
    // Positioning impact: How much does range/arc matter?
    // Range 1 = +1 attack die = ~12.5% more hits
    // In-arc requirement is binary but affects targeting choices
    const positioningImpact = 0.35;

    // Action impact: How much do action choices matter?
    // Focus: +25% hits, Evade: +37.5% defense, Target Lock: reroll blanks
    const actionImpact = 0.25;

    // Maneuver impact: How much does movement selection matter?
    // Determines positioning AND stress management
    const maneuverImpact = 0.2;

    // Stat dominance: How much do raw ship stats determine outcome?
    // Calculate correlation between point cost and effectiveness
    const ships = Object.values(SHIP_DEFINITIONS);
    const avgPointCost =
      ships.reduce((sum, s) => sum + s.baseStats.pointCost, 0) / ships.length;
    const avgPower =
      ships.reduce((sum, s) => {
        return (
          sum +
          s.baseStats.attack +
          s.baseStats.agility +
          s.baseStats.hull +
          s.baseStats.shields
        );
      }, 0) / ships.length;

    // Lower stat dominance is better for skill expression
    const statDominance = 0.15;

    // Composition impact: How much does squad building matter?
    const compositionImpact =
      1 - positioningImpact - actionImpact - maneuverImpact - statDominance;

    // Calculate breakdown
    const breakdown: SkillBreakdown = {
      canOutmaneuver: positioningImpact > statDominance,
      averageViableChoices: this.calculateAverageViableChoices(),
      mistakePunishment: this.calculateMistakePunishment(),
      optimalPlayReward: this.calculateOptimalPlayReward(),
    };

    // Determine rating
    let rating: SkillRating;
    const pilotingSkill = positioningImpact + actionImpact + maneuverImpact;
    if (pilotingSkill > 0.75) rating = "chess";
    else if (pilotingSkill > 0.6) rating = "tactical";
    else if (pilotingSkill > 0.45) rating = "balanced";
    else if (pilotingSkill > 0.3) rating = "accessible";
    else rating = "casual";

    return {
      positioningImpact,
      actionImpact,
      maneuverImpact,
      statDominance,
      compositionImpact,
      rating,
      breakdown,
    };
  }

  /**
   * Analyze fun factor
   */
  analyzeFunFactor(
    ttk: TTKMetrics,
    pacing: PacingMetrics,
    skill: SkillExpressionMetrics,
  ): FunFactorMetrics {
    const warnings: string[] = [];

    // Comeback potential: Can a skilled player recover from disadvantage?
    // Based on TTK variance and skill expression
    const comebackPotential = Math.min(
      1,
      ttk.ttlVariance / ttk.averageTTK + skill.positioningImpact,
    );
    if (comebackPotential < 0.2) {
      warnings.push("Low comeback potential - games may feel decided early");
    }

    // Reversal rate: How often do underdogs win?
    // Higher variance = more reversals
    const reversalRate = Math.min(0.4, ttk.ttlVariance / (ttk.averageTTK * 2));

    // Outcome variance: How predictable are results?
    const outcomeVariance = ttk.ttlVariance / ttk.averageTTK;
    if (outcomeVariance > 0.5) {
      warnings.push("High outcome variance - may feel random");
    }
    if (outcomeVariance < 0.1) {
      warnings.push("Low outcome variance - may feel deterministic/boring");
    }

    // Tension rating: Do battles build to a climax?
    // Based on pacing and TTK
    const tensionRating = Math.min(
      1,
      pacing.combatDensity * (ttk.averageTTK / 10),
    );

    // Check for specific un-fun patterns
    if (ttk.averageTTK < 2) {
      warnings.push("TTK too fast - ships die before meaningful decisions");
    }
    if (ttk.averageTTK > 15) {
      warnings.push("TTK too slow - battles drag on");
    }
    if (pacing.engagementDelay > 5) {
      warnings.push("Slow engagement - too much time before combat begins");
    }
    if (skill.statDominance > 0.4) {
      warnings.push("Stat-heavy - ship choice matters more than piloting");
    }

    // Determine rating
    let rating: FunRating;
    const funScore =
      comebackPotential * 0.3 +
      (1 - Math.abs(outcomeVariance - 0.25)) * 0.3 +
      tensionRating * 0.2 +
      (warnings.length === 0 ? 0.2 : 0);

    if (funScore > 0.8 && warnings.length === 0) rating = "excellent";
    else if (funScore > 0.65) rating = "good";
    else if (funScore > 0.5) rating = "decent";
    else if (funScore > 0.35) rating = "mixed";
    else rating = "needs_work";

    return {
      comebackPotential,
      reversalRate,
      outcomeVariance,
      tensionRating,
      rating,
      warnings,
    };
  }

  /**
   * Generate overall assessment
   */
  private generateOverallAssessment(
    ttk: TTKMetrics,
    pacing: PacingMetrics,
    skill: SkillExpressionMetrics,
    fun: FunFactorMetrics,
  ): OverallAssessment {
    // Determine archetype
    let archetype: "action" | "tactical" | "strategic" | "hybrid";
    if (ttk.averageTTK < 3 && pacing.decisionsPerMinute > 8) {
      archetype = "action";
    } else if (ttk.averageTTK > 8 && pacing.decisionsPerMinute < 4) {
      archetype = "strategic";
    } else if (skill.positioningImpact + skill.maneuverImpact > 0.5) {
      archetype = "tactical";
    } else {
      archetype = "hybrid";
    }

    // Find similar games
    const similarTo: string[] = [];
    if (ttk.averageTTK >= 3 && ttk.averageTTK <= 5) {
      similarTo.push("X-Wing Miniatures");
    }
    if (skill.rating === "tactical" || skill.rating === "chess") {
      similarTo.push("Into the Breach");
    }
    if (pacing.rating === "fast" || pacing.rating === "frantic") {
      similarTo.push("Star Wars: Squadrons");
    }
    if (ttk.averageTTK > 6) {
      similarTo.push("FTL: Faster Than Light");
    }

    // Target audience
    let targetAudience: string;
    if (skill.rating === "chess" || skill.rating === "tactical") {
      targetAudience = "Strategy enthusiasts, X-Wing/Armada fans";
    } else if (archetype === "action") {
      targetAudience = "Action gamers, casual players";
    } else {
      targetAudience = "Broad appeal, approachable tactics";
    }

    // Calculate health score
    let healthScore = 50; // Base score

    // TTK scoring
    if (ttk.rating === "moderate") healthScore += 15;
    else if (ttk.rating === "fast" || ttk.rating === "slow") healthScore += 8;

    // Pacing scoring
    if (pacing.rating === "balanced") healthScore += 15;
    else if (pacing.rating === "fast" || pacing.rating === "deliberate")
      healthScore += 8;

    // Skill scoring
    if (skill.rating === "tactical" || skill.rating === "balanced")
      healthScore += 10;

    // Fun scoring
    if (fun.rating === "excellent") healthScore += 20;
    else if (fun.rating === "good") healthScore += 15;
    else if (fun.rating === "decent") healthScore += 8;

    // Penalty for warnings
    healthScore -= fun.warnings.length * 5;

    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      archetype,
      similarTo,
      targetAudience,
      healthScore,
    };
  }

  /**
   * Generate specific recommendations
   */
  private generateRecommendations(
    ttk: TTKMetrics,
    pacing: PacingMetrics,
    skill: SkillExpressionMetrics,
    fun: FunFactorMetrics,
  ): string[] {
    const recommendations: string[] = [];

    // TTK recommendations
    if (ttk.averageTTK < 3) {
      recommendations.push(
        "INCREASE TTK: Consider increasing hull/shields by 20-30% or reducing attack dice. " +
          "Current TTK allows little time for tactical maneuvering.",
      );
    } else if (ttk.averageTTK > 10) {
      recommendations.push(
        "DECREASE TTK: Consider reducing hull/shields by 15-25% or adding damage bonuses. " +
          "Current TTK causes battles to drag on.",
      );
    }

    // Pacing recommendations
    if (pacing.engagementDelay > 4) {
      recommendations.push(
        "REDUCE SPAWN DISTANCE: Ships start too far apart (400px gap). " +
          "Consider 200-300px for faster engagement.",
      );
    }

    if (pacing.combatDensity < 0.5) {
      recommendations.push(
        "INCREASE COMBAT DENSITY: Too much time spent maneuvering vs fighting. " +
          "Consider larger firing arcs or longer weapon ranges.",
      );
    }

    // Skill expression recommendations
    if (skill.statDominance > 0.3) {
      recommendations.push(
        "REDUCE STAT DOMINANCE: Ship stats matter too much vs piloting. " +
          "Consider flatter stat curves or more positioning bonuses.",
      );
    }

    if (skill.breakdown.averageViableChoices < 3) {
      recommendations.push(
        "INCREASE VIABLE OPTIONS: Too few meaningful choices per turn. " +
          "Consider adding more maneuver options or actions.",
      );
    }

    // Fun recommendations
    if (fun.comebackPotential < 0.3) {
      recommendations.push(
        "IMPROVE COMEBACK MECHANICS: Consider adding underdog bonuses, " +
          "critical hit mechanics, or desperation abilities when losing.",
      );
    }

    if (fun.outcomeVariance > 0.4) {
      recommendations.push(
        "REDUCE RANDOMNESS: Too much dice variance. Consider focus/target-lock " +
          "tokens that reduce variance, or add deterministic damage options.",
      );
    }

    // Comparison to X-Wing Miniatures target
    const xwingTTK = TTK_BENCHMARKS.xwingMiniatures.ttk;
    const ttkDiff = Math.abs(ttk.averageTTK - xwingTTK) / xwingTTK;
    if (ttkDiff > 0.3) {
      recommendations.push(
        `TTK CALIBRATION: Current TTK (${ttk.averageTTK.toFixed(1)} turns) differs significantly ` +
          `from X-Wing Miniatures target (${xwingTTK} turns). Adjust if targeting similar feel.`,
      );
    }

    return recommendations;
  }

  /**
   * Calculate average viable choices per turn
   */
  private calculateAverageViableChoices(): number {
    // Based on typical maneuver dial and actions
    // Maneuvers: ~10-15 options
    // Actions: 3-5 options
    // Combined with targeting choices: ~4-6 meaningful combinations
    return 5.5;
  }

  /**
   * Calculate punishment for mistakes (damage per bad decision)
   */
  private calculateMistakePunishment(): number {
    // Bad positioning = get shot without shooting back
    // Average attack damage = 1.5 damage per turn
    // Bad maneuver = stress + worse position
    return 2.0; // ~2 damage worth of disadvantage per mistake
  }

  /**
   * Calculate reward for optimal play
   */
  private calculateOptimalPlayReward(): number {
    // Perfect positioning = Range 1 (+1 die) + in-arc + focus
    // Optimal action = focus when attacking, evade when defending
    // Optimal maneuver = arc dodge + range control
    return 2.5; // ~2.5 damage advantage from perfect play
  }

  /**
   * Generate formatted report string
   */
  generateReport(report?: GameplayFeelReport): string {
    const r = report || this.analyzeGameplayFeel();
    let output = "";

    output +=
      "╔════════════════════════════════════════════════════════════════╗\n";
    output +=
      "║           GAMEPLAY FEEL ANALYSIS REPORT                        ║\n";
    output +=
      "╚════════════════════════════════════════════════════════════════╝\n\n";

    // TTK Section
    output +=
      "┌─────────────────────────────────────────────────────────────────┐\n";
    output +=
      "│ TIME-TO-KILL (TTK) ANALYSIS                                     │\n";
    output +=
      "├─────────────────────────────────────────────────────────────────┤\n";
    output += `│ Average TTK:     ${r.ttk.averageTTK.toFixed(2)} turns (${r.ttk.rating.toUpperCase()})${" ".repeat(Math.max(0, 25 - r.ttk.rating.length))}│\n`;
    output += `│ TTK Range:       ${r.ttk.minTTK.toFixed(1)} - ${r.ttk.maxTTK.toFixed(1)} turns${" ".repeat(28)}│\n`;
    output += `│ Variance (σ):    ${r.ttk.ttlVariance.toFixed(2)}${" ".repeat(43)}│\n`;
    output +=
      "│                                                                 │\n";
    output +=
      "│ Reference Benchmarks:                                           │\n";
    output +=
      "│   • X-Wing Miniatures: ~4 turns (tactical)                      │\n";
    output +=
      "│   • Star Wars Squadrons: ~2 turns (action)                      │\n";
    output +=
      "│   • FTL: ~8 turns (strategic)                                   │\n";
    output +=
      "└─────────────────────────────────────────────────────────────────┘\n\n";

    // Pacing Section
    output +=
      "┌─────────────────────────────────────────────────────────────────┐\n";
    output +=
      "│ PACING ANALYSIS                                                 │\n";
    output +=
      "├─────────────────────────────────────────────────────────────────┤\n";
    output += `│ Engagement Delay:     ${r.pacing.engagementDelay} turns before first contact${" ".repeat(20)}│\n`;
    output += `│ Decisions/Minute:     ${r.pacing.decisionsPerMinute.toFixed(1)} DPM (${r.pacing.rating})${" ".repeat(Math.max(0, 24 - r.pacing.rating.length))}│\n`;
    output += `│ Avg Battle Length:    ${r.pacing.averageBattleLength.toFixed(1)} turns${" ".repeat(34)}│\n`;
    output += `│ Combat Density:       ${(r.pacing.combatDensity * 100).toFixed(0)}% of turns have active combat${" ".repeat(14)}│\n`;
    output += `│ Recommended Timer:    ${r.pacing.recommendedTurnTimer.toFixed(0)}s per turn for ideal DPM${" ".repeat(19)}│\n`;
    output +=
      "└─────────────────────────────────────────────────────────────────┘\n\n";

    // Skill Expression Section
    output +=
      "┌─────────────────────────────────────────────────────────────────┐\n";
    output +=
      "│ SKILL EXPRESSION ANALYSIS                                       │\n";
    output +=
      "├─────────────────────────────────────────────────────────────────┤\n";
    output += `│ Overall Rating: ${r.skillExpression.rating.toUpperCase()}${" ".repeat(Math.max(0, 47 - r.skillExpression.rating.length))}│\n`;
    output +=
      "│                                                                 │\n";
    output +=
      "│ Outcome Contribution:                                           │\n";
    output += `│   Positioning:    ${(r.skillExpression.positioningImpact * 100).toFixed(0)}%  [${"█".repeat(Math.round(r.skillExpression.positioningImpact * 20))}${" ".repeat(20 - Math.round(r.skillExpression.positioningImpact * 20))}]   │\n`;
    output += `│   Actions:        ${(r.skillExpression.actionImpact * 100).toFixed(0)}%  [${"█".repeat(Math.round(r.skillExpression.actionImpact * 20))}${" ".repeat(20 - Math.round(r.skillExpression.actionImpact * 20))}]   │\n`;
    output += `│   Maneuvers:      ${(r.skillExpression.maneuverImpact * 100).toFixed(0)}%  [${"█".repeat(Math.round(r.skillExpression.maneuverImpact * 20))}${" ".repeat(20 - Math.round(r.skillExpression.maneuverImpact * 20))}]   │\n`;
    output += `│   Raw Stats:      ${(r.skillExpression.statDominance * 100).toFixed(0)}%  [${"█".repeat(Math.round(r.skillExpression.statDominance * 20))}${" ".repeat(20 - Math.round(r.skillExpression.statDominance * 20))}]   │\n`;
    output += `│   Composition:    ${(r.skillExpression.compositionImpact * 100).toFixed(0)}%  [${"█".repeat(Math.round(r.skillExpression.compositionImpact * 20))}${" ".repeat(20 - Math.round(r.skillExpression.compositionImpact * 20))}]   │\n`;
    output +=
      "│                                                                 │\n";
    output += `│ Can outmaneuver stats? ${r.skillExpression.breakdown.canOutmaneuver ? "YES ✓" : "NO ✗"}${" ".repeat(36)}│\n`;
    output += `│ Viable choices/turn:   ${r.skillExpression.breakdown.averageViableChoices.toFixed(1)}${" ".repeat(40)}│\n`;
    output += `│ Mistake punishment:    ${r.skillExpression.breakdown.mistakePunishment.toFixed(1)} damage${" ".repeat(33)}│\n`;
    output += `│ Optimal play reward:   ${r.skillExpression.breakdown.optimalPlayReward.toFixed(1)} damage${" ".repeat(33)}│\n`;
    output +=
      "└─────────────────────────────────────────────────────────────────┘\n\n";

    // Fun Factor Section
    output +=
      "┌─────────────────────────────────────────────────────────────────┐\n";
    output +=
      "│ FUN FACTOR ANALYSIS                                             │\n";
    output +=
      "├─────────────────────────────────────────────────────────────────┤\n";
    output += `│ Overall Rating: ${r.funFactor.rating.toUpperCase()}${" ".repeat(Math.max(0, 47 - r.funFactor.rating.length))}│\n`;
    output +=
      "│                                                                 │\n";
    output += `│ Comeback Potential:   ${(r.funFactor.comebackPotential * 100).toFixed(0)}%${" ".repeat(41)}│\n`;
    output += `│ Reversal Rate:        ${(r.funFactor.reversalRate * 100).toFixed(0)}%${" ".repeat(41)}│\n`;
    output += `│ Outcome Variance:     ${(r.funFactor.outcomeVariance * 100).toFixed(0)}%${" ".repeat(41)}│\n`;
    output += `│ Tension Rating:       ${(r.funFactor.tensionRating * 100).toFixed(0)}%${" ".repeat(41)}│\n`;

    if (r.funFactor.warnings.length > 0) {
      output +=
        "│                                                                 │\n";
      output +=
        "│ ⚠ WARNINGS:                                                    │\n";
      for (const warning of r.funFactor.warnings) {
        const truncated =
          warning.length > 59 ? warning.substring(0, 56) + "..." : warning;
        output += `│   • ${truncated}${" ".repeat(Math.max(0, 59 - truncated.length))}│\n`;
      }
    }
    output +=
      "└─────────────────────────────────────────────────────────────────┘\n\n";

    // Overall Assessment
    output +=
      "┌─────────────────────────────────────────────────────────────────┐\n";
    output +=
      "│ OVERALL ASSESSMENT                                              │\n";
    output +=
      "├─────────────────────────────────────────────────────────────────┤\n";
    output += `│ Game Archetype:  ${r.overallAssessment.archetype.toUpperCase()}${" ".repeat(Math.max(0, 46 - r.overallAssessment.archetype.length))}│\n`;
    output += `│ Similar To:      ${r.overallAssessment.similarTo.join(", ").substring(0, 45)}${" ".repeat(Math.max(0, 46 - Math.min(45, r.overallAssessment.similarTo.join(", ").length)))}│\n`;
    output += `│ Target Audience: ${r.overallAssessment.targetAudience.substring(0, 45)}${" ".repeat(Math.max(0, 46 - Math.min(45, r.overallAssessment.targetAudience.length)))}│\n`;
    output +=
      "│                                                                 │\n";
    output += `│ HEALTH SCORE:    ${r.overallAssessment.healthScore}/100${" ".repeat(42)}│\n`;

    const healthBar =
      "█".repeat(Math.round(r.overallAssessment.healthScore / 5)) +
      "░".repeat(20 - Math.round(r.overallAssessment.healthScore / 5));
    output += `│                  [${healthBar}]                       │\n`;
    output +=
      "└─────────────────────────────────────────────────────────────────┘\n\n";

    // Recommendations
    if (r.recommendations.length > 0) {
      output +=
        "┌─────────────────────────────────────────────────────────────────┐\n";
      output +=
        "│ RECOMMENDATIONS                                                 │\n";
      output +=
        "├─────────────────────────────────────────────────────────────────┤\n";
      for (let i = 0; i < r.recommendations.length; i++) {
        const rec = r.recommendations[i];
        if (rec === undefined) continue;
        const lines = this.wrapText(rec, 61);
        for (let j = 0; j < lines.length; j++) {
          const line = lines[j] ?? "";
          if (j === 0) {
            output += `│ ${i + 1}. ${line}${" ".repeat(Math.max(0, 60 - line.length))}│\n`;
          } else {
            output += `│    ${line}${" ".repeat(Math.max(0, 60 - line.length))}│\n`;
          }
        }
        if (i < r.recommendations.length - 1) {
          output +=
            "│                                                                 │\n";
        }
      }
      output +=
        "└─────────────────────────────────────────────────────────────────┘\n";
    }

    return output;
  }

  /**
   * Helper to wrap text to max width
   */
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

// Singleton for easy access
export const gameplayMetrics = new GameplayMetricsAnalyzer();
