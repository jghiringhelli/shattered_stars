/**
 * MovementLab — runs every measurement for both steering engines and the
 * two pilot styles, plus the turn-rate-scale sweep of the analog engine.
 *
 * Pure: no Phaser; deterministic. Printed by scripts/movement_lab.ts.
 */

import type { SteeringMode } from "../../core/steeringMode";
import { DEFAULT_ANALOG_TUNING } from "../../core/analogTuning";
import { measureDuel, type DuelResult } from "./LabDuel";
import {
  measureConstancy,
  measureLatency,
  type ConstancyResult,
  type LabConfig,
  type LatencyResult,
} from "./LabMetrics";
import type { LabPilotKind } from "./LabPilot";
import { pickLabShip } from "./LabShip";
import {
  measureSmoothness,
  measureTurn,
  type SmoothnessResult,
  type TurnResult,
} from "./LabTurns";

export const LAB_ENGINES: readonly SteeringMode[] = ["template", "analog"];
export const LAB_PILOTS: readonly LabPilotKind[] = [
  "proportional",
  "tapper",
  "fast-tapper",
];

/** What the lab flies. */
export interface LabOptions {
  /** Ship id; omitted = {@link pickLabShip}. */
  readonly definitionId?: string;
  /** Throttles to measure turns at (the first one also runs the duels). */
  readonly speeds: readonly number[];
  /** Duels per engine and pilot. */
  readonly seeds: number;
  /** Length of a duel (ms). */
  readonly durationMs: number;
  /** Analog turn-rate multipliers to sweep. */
  readonly rateScales: readonly number[];
}

/** Turn quality and smoothness of one engine, pilot and throttle. */
export interface TurnRow {
  readonly engine: SteeringMode;
  readonly pilot: LabPilotKind;
  readonly speed: number;
  readonly uTurn: TurnResult;
  readonly correction: TurnResult;
  readonly smoothness: SmoothnessResult;
}

/** A duel batch of one engine and pilot. */
export interface DuelRow {
  readonly engine: SteeringMode;
  readonly pilot: LabPilotKind;
  readonly rateScale: number;
  readonly duel: DuelResult;
}

/** One row of the turn-rate sweep (analog engine). */
export interface SweepRow {
  readonly rateScale: number;
  readonly pilot: LabPilotKind;
  readonly uTurn: TurnResult;
  readonly duel: DuelResult;
}

/** Everything the lab measured. */
export interface LabReport {
  readonly options: LabOptions & { readonly definitionId: string };
  readonly latency: Readonly<Record<SteeringMode, LatencyResult>>;
  readonly constancy: Readonly<Record<SteeringMode, ConstancyResult>>;
  readonly turns: readonly TurnRow[];
  readonly duels: readonly DuelRow[];
  readonly sweep: readonly SweepRow[];
}

/**
 * @param engine - Steering engine.
 * @param config - Ship and throttle.
 * @returns Latency and constancy of the engine.
 */
function inputFeel(
  engine: SteeringMode,
  config: LabConfig,
): { latency: LatencyResult; constancy: ConstancyResult } {
  return {
    latency: measureLatency(engine, config),
    constancy: measureConstancy(engine, config),
  };
}

/**
 * @param options - What the lab flies.
 * @param definitionId - The ship.
 * @returns Turn rows for every engine, pilot and throttle.
 */
function turnRows(options: LabOptions, definitionId: string): TurnRow[] {
  const rows: TurnRow[] = [];
  for (const speed of options.speeds)
    for (const engine of LAB_ENGINES)
      for (const pilot of LAB_PILOTS) {
        const config = { definitionId, speed };
        rows.push({
          engine,
          pilot,
          speed,
          uTurn: measureTurn(engine, pilot, config, 180),
          correction: measureTurn(engine, pilot, config, 45),
          smoothness: measureSmoothness(engine, pilot, config),
        });
      }
  return rows;
}

/**
 * @param options - What the lab flies.
 * @param definitionId - The ship.
 * @returns Duel rows for every engine and pilot at the first throttle.
 */
function duelRows(options: LabOptions, definitionId: string): DuelRow[] {
  const config = { definitionId, speed: options.speeds[0]! };
  const rows: DuelRow[] = [];
  for (const engine of LAB_ENGINES)
    for (const pilot of LAB_PILOTS)
      rows.push({
        engine,
        pilot,
        rateScale: 1,
        duel: measureDuel(engine, pilot, config, options),
      });
  return rows;
}

/**
 * @param options - What the lab flies.
 * @param definitionId - The ship.
 * @returns The analog engine at each turn-rate multiplier.
 */
function sweepRows(options: LabOptions, definitionId: string): SweepRow[] {
  const rows: SweepRow[] = [];
  for (const rateScale of options.rateScales)
    for (const pilot of LAB_PILOTS) {
      const config = {
        definitionId,
        speed: options.speeds[0]!,
        tuning: { ...DEFAULT_ANALOG_TUNING, rateScale },
      };
      rows.push({
        rateScale,
        pilot,
        uTurn: measureTurn("analog", pilot, config, 180),
        duel: measureDuel("analog", pilot, config, options),
      });
    }
  return rows;
}

/**
 * @param options - What the lab flies.
 * @returns The full report.
 */
export function runMovementLab(options: LabOptions): LabReport {
  const definitionId = options.definitionId ?? pickLabShip();
  const config = { definitionId, speed: options.speeds[0]! };
  const feel = {
    template: inputFeel("template", config),
    analog: inputFeel("analog", config),
  };
  return {
    options: { ...options, definitionId },
    latency: { template: feel.template.latency, analog: feel.analog.latency },
    constancy: {
      template: feel.template.constancy,
      analog: feel.analog.constancy,
    },
    turns: turnRows(options, definitionId),
    duels: duelRows(options, definitionId),
    sweep: sweepRows(options, definitionId),
  };
}
