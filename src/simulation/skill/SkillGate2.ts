/**
 * SkillGate2 — skill gate 2 as data: a coordinated squadron of AVERAGE
 * pilots (SquadCommand: focus fire + squad mark, flanking, cohesion,
 * drag-and-bag, fall-back) beats the same points of EXPERT aces each flying
 * on their own >= 70%. Threshold fixed; tune levers, never this number.
 *
 * Pure: no Phaser.
 */

import type { ShipDefinition } from "../../core/types";
import type { ArenaRules } from "./ArenaRules";
import { runSeries, seedRange, type SeriesSummary } from "./ArenaStats";
import type { BattleSpec } from "./ArenaSpec";
import { GATE_FIGHTER_ROLES } from "./SkillGates";

/** Gate 2: minimum win rate of the coordinated average squad. */
export const GATE2_MIN_SQUAD_WIN_RATE = 0.7;

/**
 * Gate-2 squad lists: per faction, one heavy fighter, one interceptor and
 * one light fighter (first of each role in the catalog) — flown by both
 * sides, so points match exactly.
 * @param fighters - The roster.
 * @returns Squad compositions (ship ids).
 */
export function gate2Compositions(
  fighters: readonly ShipDefinition[],
): string[][] {
  const factions = [...new Set(fighters.map((f) => f.faction))];
  return factions
    .map((faction) =>
      GATE_FIGHTER_ROLES.map(
        (role) =>
          fighters.find((f) => f.faction === faction && f.role === role)?.id,
      ).filter((id): id is string => id !== undefined),
    )
    .filter((squad) => squad.length >= 2);
}

/**
 * @returns Gate-2 battle: coordinated average squad on A, solo experts on B.
 */
export function squadSpec(
  composition: readonly string[],
  seed: number,
  rules?: ArenaRules,
): BattleSpec {
  return {
    A: {
      ships: composition.map((definitionId) => ({
        definitionId,
        tier: "average" as const,
      })),
      squad: {},
    },
    B: {
      ships: composition.map((definitionId) => ({
        definitionId,
        tier: "expert" as const,
      })),
      squad: null,
    },
    seed,
    ...(rules ? { rules } : {}),
  };
}

/** Gate 2, measured. */
export interface SquadGateMeasurement {
  /** Squad win rate over every battle of every composition. */
  readonly winRate: number;
  readonly battles: number;
  readonly rows: readonly {
    readonly composition: readonly string[];
    readonly summary: SeriesSummary;
  }[];
}

/**
 * @param compositions - Squad lists (flown by both sides).
 * @param seeds - Battles per composition.
 * @param rules - Rules in force (engine by default).
 * @returns The coordinated squad's win rate overall and per composition.
 */
export function measureGate2(
  compositions: readonly (readonly string[])[],
  seeds: number,
  rules?: ArenaRules,
): SquadGateMeasurement {
  const rows = compositions.map((composition) => ({
    composition,
    summary: runSeries(
      (seed) => squadSpec(composition, seed, rules),
      seedRange(seeds),
    ).summary,
  }));
  const battles = rows.reduce((sum, r) => sum + r.summary.battles, 0);
  const wins = rows.reduce(
    (sum, r) => sum + r.summary.winRate * r.summary.battles,
    0,
  );
  return { winRate: battles > 0 ? wins / battles : 0, battles, rows };
}
