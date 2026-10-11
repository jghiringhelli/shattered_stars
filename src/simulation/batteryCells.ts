/**
 * batteryCells — the cells of the headless telemetry battery: one mode ×
 * tier pairing each, run on the real shared code paths available headless
 * (DuelTempoSim for Dogfight / Ace Duel, the skill arena for squad
 * Skirmish-style eliminations, ScenarioMatchSim for Scenarios, the node sim
 * for Survival). Duel and squad cells accept a what-if tempo.
 *
 * Pure: no Phaser, no I/O.
 */

import type { BotTier } from "../arcade/ai/BotTypes";
import { ACE_MATCHUPS } from "../data/AceMatchups";
import { SCENARIO_IDS } from "../arcade/scenarios";
import { simulateDuelRound } from "./DuelTempoSim";
import { runBattle } from "./skill/SkillArena";
import type { BattleSpec } from "./skill/ArenaSpec";
import {
  runScenarioMatch,
  SCENARIO_ENEMY_LIST,
  SCENARIO_PLAYER_LIST,
} from "./ScenarioMatchSim";
import { sweepRuns } from "./survival/runSweep";
import {
  duelSpec,
  fighterRoster,
  gate1Pairs,
  sampleGate1Pairs,
} from "./skill/SkillGates";
import {
  gate2Compositions,
  squadSpec as gate2SquadSpec,
} from "./skill/SkillGate2";
import type { TempoVariant } from "./TempoVariant";
import {
  arenaSample,
  duelSample,
  scenarioSample,
  survivalSample,
  type MatchSample,
} from "./telemetryBattery";

/** First seed of every cell (cells are reproducible). */
export const BATTERY_SEED_BASE = 1000;

/** One battery cell. */
export interface BatteryCell {
  readonly id: string;
  readonly mode: string;
  readonly pairing: string;
  /** Whether {@link run} honours a tempo variant. */
  readonly tempoAware: boolean;
  run(seeds: number, tempo?: TempoVariant): MatchSample[];
}

type Pair = readonly [BotTier, BotTier];
const PAIRS: Readonly<Record<string, Pair>> = {
  "novice v novice": ["novice", "novice"],
  "average v average": ["average", "average"],
  "expert v expert": ["expert", "expert"],
  "expert v novice": ["expert", "novice"],
};

const seedsOf = (n: number): number[] =>
  Array.from({ length: n }, (_, i) => BATTERY_SEED_BASE + i);

function dogfightCell(label: string, [t1, t2]: Pair): BatteryCell {
  return {
    id: `dogfight:${label}`,
    mode: "Dogfight 1v1",
    pairing: label,
    tempoAware: true,
    run: (n, tempo) =>
      seedsOf(n).map((seed) =>
        duelSample(
          simulateDuelRound({
            side1: ["confed_falcon"],
            side2: ["terran_raptor"],
            seed,
            tier: t1,
            side2Tier: t2,
            ...(tempo ? { tempo } : {}),
          }),
          2,
        ),
      ),
  };
}

function aceCell(label: string, [t1, t2]: Pair): BatteryCell {
  return {
    id: `ace:${label}`,
    mode: "Ace Duel",
    pairing: label,
    tempoAware: true,
    run: (n, tempo) =>
      seedsOf(n).map((seed, i) => {
        const m = ACE_MATCHUPS[i % ACE_MATCHUPS.length]!;
        return duelSample(
          simulateDuelRound({
            side1: m.side1.ships,
            side2: m.side2.ships,
            seed,
            tier: t1,
            side2Tier: t2,
            ...(tempo ? { tempo } : {}),
          }),
          m.side1.ships.length + m.side2.ships.length,
        );
      }),
  };
}

/**
 * @param seed - Battle seed.
 * @param tiers - Tier of side A and of side B.
 * @param tempo - What-if tempo.
 * @returns A 4v4 elimination between two coordinated squads (Skirmish lists).
 */
export function squadSpec(
  seed: number,
  [ta, tb]: Pair,
  tempo?: TempoVariant,
): BattleSpec {
  const side = (ids: readonly string[], tier: BotTier) => ({
    ships: ids.map((definitionId) => ({ definitionId, tier })),
    squad: {},
  });
  return {
    A: side(SCENARIO_PLAYER_LIST, ta),
    B: side(SCENARIO_ENEMY_LIST, tb),
    seed,
    ...(tempo ? { tempo } : {}),
  };
}

function squadCell(label: string, pair: Pair): BatteryCell {
  return {
    id: `squad:${label}`,
    mode: "Squad 4v4 (Skirmish lists)",
    pairing: label,
    tempoAware: true,
    run: (n, tempo) =>
      seedsOf(n).map((seed) =>
        arenaSample(runBattle(squadSpec(seed, pair, tempo)), 8),
      ),
  };
}

function scenarioCell(label: string, [player, enemy]: Pair): BatteryCell {
  return {
    id: `scenario:${label}`,
    mode: "Scenarios (4v4)",
    pairing: label,
    tempoAware: false,
    run: (n) =>
      seedsOf(n).map((seed, i) =>
        scenarioSample(
          runScenarioMatch(SCENARIO_IDS[i % SCENARIO_IDS.length]!, seed, {
            player,
            enemy,
          }),
          8,
        ),
      ),
  };
}

function survivalCell(sector: number): BatteryCell {
  return {
    id: `survival:s${sector}`,
    mode: "Survival nodes (autopilot)",
    pairing: `avg fleet v sector ${sector}`,
    tempoAware: false,
    run: (n) =>
      sweepRuns(n, BATTERY_SEED_BASE)
        .flatMap((r) => r.battles)
        .filter((b) => b.sector === sector)
        .map((b) => survivalSample(b.battle)),
  };
}

/** Every battery cell, in report order. */
export const BATTERY_CELLS: readonly BatteryCell[] = [
  ...Object.entries(PAIRS).map(([label, pair]) => dogfightCell(label, pair)),
  ...["average v average", "expert v expert", "expert v novice"].map((l) =>
    aceCell(l, PAIRS[l]!),
  ),
  ...["average v average", "expert v expert", "expert v novice"].map((l) =>
    squadCell(l, PAIRS[l]!),
  ),
  ...["average v average", "expert v novice"].map((l) =>
    scenarioCell(l, PAIRS[l]!),
  ),
  ...[1, 2].map(survivalCell),
];

/** Gate-1 pairs sampled by the tempo experiment (hardest + spread, per expert ship). */
export const GATE1_SAMPLE_PAIRS = 24;

/** The two piloting gates as cells (tempo experiment; side 1 = the side that should win). */
export const GATE_CELLS: readonly BatteryCell[] = [
  {
    id: "gate1",
    mode: "Gate 1",
    pairing: "expert v novice (sampled fighter pairs)",
    tempoAware: true,
    run: (n, tempo) => {
      const pairs = sampleGate1Pairs(
        gate1Pairs(fighterRoster().fighters),
        GATE1_SAMPLE_PAIRS,
      );
      return seedsOf(n).map((seed, i) =>
        arenaSample(
          runBattle({
            ...duelSpec(pairs[i % pairs.length]!, seed),
            ...(tempo ? { tempo } : {}),
          }),
          2,
        ),
      );
    },
  },
  {
    id: "gate2",
    mode: "Gate 2",
    pairing: "coordinated average squad v solo experts",
    tempoAware: true,
    run: (n, tempo) => {
      const comps = gate2Compositions(fighterRoster().fighters);
      return seedsOf(n).map((seed, i) => {
        const comp = comps[i % comps.length]!;
        return arenaSample(
          runBattle({
            ...gate2SquadSpec(comp, seed),
            ...(tempo ? { tempo } : {}),
          }),
          comp.length * 2,
        );
      });
    },
  },
];

/**
 * @param id - A cell id.
 * @returns The cell (battery or gate), or undefined.
 */
export function batteryCell(id: string): BatteryCell | undefined {
  return [...BATTERY_CELLS, ...GATE_CELLS].find((c) => c.id === id);
}
