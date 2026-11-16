/**
 * LabBattle — one battle-emulation cell of the movement lab: the same hull
 * on both sides flown through the real skill arena (runBattle), a subject side
 * (bots or the human-like pilot on one steering setting) against an opponent
 * side (bots on the same or another setting), over many seeded rounds. The
 * subject flies side A in even rounds and side B in odd ones, so the spawn
 * layout cancels out. SideMeter reads the feel proxies off the subject's ships.
 *
 * Pure: no Phaser; deterministic per round index.
 */

import type { BotTier } from "../../arcade/ai/BotTypes";
import type { AnalogTuning } from "../../core/analogTuning";
import type { SteeringMode } from "../../core/steeringMode";
import { shareInterval, type ShareInterval } from "../balance/balanceStats";
import type { ShipEntry, SideSpec } from "../skill/ArenaSpec";
import type { SideId } from "../skill/ArenaSide";
import { TICK_MS } from "../skill/ArenaSpec";
import { runBattle } from "../skill/SkillArena";
import { humanLikePilotFactory } from "./LabHumanPilot";
import { emptyTotals, SideMeter, type MeterTotals } from "./LabMeters";

/** Game-time limit of a lab battle (ms): shorter than the gates', draws decide by points. */
export const LAB_BATTLE_LIMIT_MS = 120_000;

/** A steering engine with its analog tuning. */
export interface BattleSetting {
  readonly label: string;
  readonly engine: SteeringMode;
  /** Analog only; absent = the engine's default tuning. */
  readonly tuning?: AnalogTuning;
}

/** Who flies a side. */
export type BattlePilots =
  | { readonly kind: "bot"; readonly tier: BotTier }
  | { readonly kind: "human" };

/** One side of a cell. */
export interface CellSide {
  readonly setting: BattleSetting;
  readonly pilots: BattlePilots;
}

/** A cell: the subject, its opponent and the battle's shape. */
export interface BattleCell {
  readonly definitionId: string;
  /** Ships per side (1, 2 or 4). */
  readonly formation: number;
  readonly subject: CellSide;
  readonly opponent: CellSide;
  /** Bots' squads coordinate (orders + squad mark); the human-like pilot ignores them. */
  readonly squads: boolean;
}

/** What a cell measured over its rounds. */
export interface CellResult {
  readonly rounds: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly win: ShareInterval;
  /** Rounds in which the subject killed a ship, and their mean time to the first kill (ms). */
  readonly killRounds: number;
  readonly meanFirstKillMs: number;
  readonly meanDurationMs: number;
  readonly shotsPerShipMinute: number;
  readonly wedgePercent: number;
  readonly meanStress: number;
  readonly turnsPerShipMinute: number;
  readonly speedChangesPerShipMinute: number;
  readonly cappedPercent: number;
  /** RMS heading acceleration (°/s²): lower = smoother. */
  readonly headingAccelRms: number;
  readonly shipMinutes: number;
}

/**
 * @param cellSide - A side of the cell.
 * @param cell - The cell.
 * @returns The side's ships.
 */
function entriesOf(cellSide: CellSide, cell: BattleCell): ShipEntry[] {
  const { setting, pilots } = cellSide;
  const entry: ShipEntry = {
    definitionId: cell.definitionId,
    tier: pilots.kind === "bot" ? pilots.tier : "average",
    steering: setting.engine,
    ...(setting.tuning ? { analogTuning: setting.tuning } : {}),
    ...(pilots.kind === "human"
      ? { makePilot: humanLikePilotFactory(setting.engine) }
      : {}),
  };
  return Array.from({ length: cell.formation }, () => entry);
}

/**
 * @param cellSide - A side of the cell.
 * @param cell - The cell.
 * @returns The arena side.
 */
function sideSpecOf(cellSide: CellSide, cell: BattleCell): SideSpec {
  return {
    ships: entriesOf(cellSide, cell),
    squad: cell.squads && cellSide.pilots.kind === "bot" ? {} : null,
  };
}

/** What one round contributed. */
interface Round {
  readonly outcome: "win" | "loss" | "draw";
  readonly durationMs: number;
  readonly totals: MeterTotals;
  /** Primary shots the subject's side fired. */
  readonly shots: number;
}

/**
 * @param cell - The cell.
 * @param round - Round index from 0; its seed is `round + 1`.
 * @returns The round's outcome and the subject's meters.
 */
export function playRound(cell: BattleCell, round: number): Round {
  const subjectSide: SideId = round % 2 === 0 ? "A" : "B";
  const subject = sideSpecOf(cell.subject, cell);
  const opponent = sideSpecOf(cell.opponent, cell);
  const meter = new SideMeter(subjectSide);
  const result = runBattle(
    {
      A: subjectSide === "A" ? subject : opponent,
      B: subjectSide === "A" ? opponent : subject,
      seed: round + 1,
      timeLimitMs: LAB_BATTLE_LIMIT_MS,
    },
    (ships, nowMs) => meter.observe(ships, nowMs),
  );
  const outcome =
    result.winner === "draw"
      ? "draw"
      : result.winner === subjectSide
        ? "win"
        : "loss";
  return {
    outcome,
    durationMs: result.durationMs,
    totals: meter.totals,
    shots: result.tallies[subjectSide].shots,
  };
}

/** Keys of the win tally by outcome. */
const TALLY_KEY = { win: "wins", loss: "losses", draw: "draws" } as const;

/**
 * @param cell - The cell.
 * @param rounds - How many seeded rounds to fly (>= 1).
 * @returns Exact counts and means over the rounds.
 */
export function runCell(cell: BattleCell, rounds: number): CellResult {
  const sum = emptyTotals();
  let shots = 0;
  let durationMs = 0;
  const tally = { wins: 0, losses: 0, draws: 0 };
  const kills: number[] = [];
  for (let round = 0; round < rounds; round++) {
    const played = playRound(cell, round);
    tally[TALLY_KEY[played.outcome]]++;
    durationMs += played.durationMs;
    shots += played.shots;
    addTotals(sum, played.totals);
    if (played.totals.firstKillMs !== null) kills.push(played.totals.firstKillMs);
  }
  return summarise({ rounds, tally, sum, shots, durationMs, kills });
}

/**
 * @param into - Running totals (mutated).
 * @param add - A round's totals.
 */
function addTotals(into: MeterTotals, add: MeterTotals): void {
  into.shipTicks += add.shipTicks;
  into.wedgeTicks += add.wedgeTicks;
  into.stressSum += add.stressSum;
  into.turns += add.turns;
  into.speedChanges += add.speedChanges;
  into.cappedTicks += add.cappedTicks;
  into.headingAccelSq += add.headingAccelSq;
  into.headingAccelSamples += add.headingAccelSamples;
}

/**
 * @param run - Everything the rounds counted.
 * @returns The cell's result.
 */
function summarise(
  run: {
    readonly rounds: number;
    readonly tally: { wins: number; losses: number; draws: number };
    readonly sum: MeterTotals;
    readonly shots: number;
    readonly durationMs: number;
    readonly kills: readonly number[];
  },
): CellResult {
  const { sum, tally } = run;
  const shipMinutes = (sum.shipTicks * TICK_MS) / 60_000;
  const per = (count: number): number => count / shipMinutes;
  return {
    rounds: run.rounds,
    ...tally,
    win: shareInterval(tally),
    killRounds: run.kills.length,
    meanFirstKillMs:
      run.kills.reduce((a, b) => a + b, 0) / Math.max(1, run.kills.length),
    meanDurationMs: run.durationMs / run.rounds,
    shotsPerShipMinute: per(run.shots),
    wedgePercent: (100 * sum.wedgeTicks) / sum.shipTicks,
    meanStress: sum.stressSum / sum.shipTicks,
    turnsPerShipMinute: per(sum.turns),
    speedChangesPerShipMinute: per(sum.speedChanges),
    cappedPercent: (100 * sum.cappedTicks) / sum.shipTicks,
    headingAccelRms: Math.sqrt(sum.headingAccelSq / Math.max(1, sum.headingAccelSamples)),
    shipMinutes,
  };
}
