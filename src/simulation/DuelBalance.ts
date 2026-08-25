/**
 * DuelBalance — shared headless-duel guardrail utilities.
 *
 * Single source of truth for how the untested combat modes (Ace Duel, Dogfight,
 * Continuous Tactical, Epic) are exercised as seeded AI-vs-AI duels and how the
 * results are judged "fair" or "decisive". Used by the balance guardrail tests
 * so the thresholds and aggregation live in one place instead of being copied
 * across specs.
 *
 * The simulation models ship-vs-ship combat only. Pilot abilities and difficulty
 * scaling (which the live scenes layer on top) are intentionally NOT modelled:
 * the guardrail asks the coarser question "is the raw ship matchup playable, or a
 * hopeless stomp?" rather than reproducing exact in-scene outcomes.
 */

import { BattleSimulator, type AggregatedStats } from "./BattleSimulator";
import type { GameMode } from "../data/ModeBalancing";
import { getShipDefinition } from "../data/ShipDefinitions";
import { PILOT_ABILITIES } from "../systems/PilotAbilities";
import { ACE_MATCHUPS, type AceMatchup } from "../data/AceMatchups";

/** Modes the simulator can actually run (Survival reuses continuous combat). */
export type DuelMode = Extract<GameMode, "arcade" | "continuous">;

/**
 * Minimum share of *decisive* battles the losing side must still win for a
 * matchup to count as competitive rather than a hopeless stomp. A preset that
 * one side wins more than (1 - this) of the time is flagged for review.
 */
export const STOMP_FLOOR = 0.1;

/**
 * Maximum fraction of battles allowed to end in a draw (both sides alive at the
 * turn cap). A higher draw rate means the matchup is degenerate/unresolvable.
 *
 * The 2v2 bomber-squadron preset legitimately stalemates ~36% of the time — slow,
 * tanky bombers can reach a state where neither side can finish the other even at
 * very high turn caps. This ceiling tolerates that known case while still flagging
 * any matchup that fails to produce a winner most of the time.
 */
export const MAX_DRAW_RATE = 0.4;

/**
 * For a mirror matchup (identical squads on both sides) the win split must stay
 * within this margin of 50/50 once positional bias is cancelled — a wider gap
 * means the combat model has an intrinsic first/second-mover advantage.
 */
export const MIRROR_FAIRNESS_MARGIN = 0.2;

/** Normalized read of a batch of duels, independent of which side is "team1". */
export interface DuelOutcome {
  readonly totalBattles: number;
  readonly side1Wins: number;
  readonly side2Wins: number;
  readonly draws: number;
  /** Fraction of all battles that ended with a winner. */
  readonly decisiveRate: number;
  /** Fraction of all battles that ended in a draw. */
  readonly drawRate: number;
  /** Side 1's share of the *decisive* battles (0..1); 0 when none were decisive. */
  readonly side1DecisiveShare: number;
  /** Win share of whichever side won fewer decisive battles (0..0.5). */
  readonly weakerSideShare: number;
}

/** Reduce raw aggregated stats into a side-agnostic, threshold-friendly outcome. */
export function toDuelOutcome(stats: AggregatedStats): DuelOutcome {
  const total = stats.totalBattles;
  const decisive = stats.team1Wins + stats.team2Wins;
  const side1DecisiveShare = decisive > 0 ? stats.team1Wins / decisive : 0;
  const weakerSideShare =
    decisive > 0 ? Math.min(stats.team1Wins, stats.team2Wins) / decisive : 0;
  return {
    totalBattles: total,
    side1Wins: stats.team1Wins,
    side2Wins: stats.team2Wins,
    draws: stats.draws,
    decisiveRate: total > 0 ? decisive / total : 0,
    drawRate: total > 0 ? stats.draws / total : 0,
    side1DecisiveShare,
    weakerSideShare,
  };
}

/** Options for running a headless duel batch. */
export interface DuelRunOptions {
  readonly mode: DuelMode;
  readonly battles: number;
  readonly seed: number;
  readonly maxTurns?: number;
}

/** Run one squad-vs-squad batch headlessly and return a normalized outcome. */
export function runDuel(
  side1Ships: readonly string[],
  side2Ships: readonly string[],
  options: DuelRunOptions,
): DuelOutcome {
  const sim = new BattleSimulator({
    mode: options.mode,
    seed: options.seed,
    maxTurns: options.maxTurns ?? 100,
    verbose: false,
  });
  const stats = sim.runBatchSimulation(
    [...side1Ships],
    [...side2Ships],
    options.battles,
  );
  return toDuelOutcome(stats);
}

/** Run a preset ace matchup as a headless duel batch. */
export function runAceMatchup(
  matchup: AceMatchup,
  options: DuelRunOptions,
): DuelOutcome {
  return runDuel(matchup.side1.ships, matchup.side2.ships, options);
}

/** A structural problem found in a preset ace matchup. */
export interface AceMatchupIssue {
  readonly matchupId: string;
  readonly problem: string;
}

/**
 * Validate the static shape of every preset ace matchup: unique ids, both sides
 * present with at least one ship, all ship ids resolve to real definitions, and
 * every referenced pilot ability exists. Returns an empty array when clean.
 */
export function findAceMatchupIssues(
  matchups: readonly AceMatchup[] = ACE_MATCHUPS,
): AceMatchupIssue[] {
  const issues: AceMatchupIssue[] = [];
  const seenIds = new Set<string>();

  for (const matchup of matchups) {
    if (seenIds.has(matchup.id)) {
      issues.push({ matchupId: matchup.id, problem: "duplicate matchup id" });
    }
    seenIds.add(matchup.id);

    for (const side of [matchup.side1, matchup.side2] as const) {
      if (side.ships.length === 0) {
        issues.push({
          matchupId: matchup.id,
          problem: `side "${side.name}" has no ships`,
        });
      }
      for (const shipId of side.ships) {
        if (!getShipDefinition(shipId)) {
          issues.push({
            matchupId: matchup.id,
            problem: `unknown ship id "${shipId}"`,
          });
        }
      }
      for (const abilityId of side.abilities) {
        if (!PILOT_ABILITIES[abilityId]) {
          issues.push({
            matchupId: matchup.id,
            problem: `unknown ability id "${abilityId}"`,
          });
        }
      }
    }
  }

  return issues;
}
