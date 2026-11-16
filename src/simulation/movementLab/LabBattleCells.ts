/**
 * LabBattleCells — the cells of the movement lab's battle emulation and the
 * three sections they make up:
 *
 * - head to head: bots on an analog setting against the same bots on the
 *   template engine (1v1, 2v2, 4v4; the template row is the control);
 * - human-like: the human-like pilot on each setting against bots of each
 *   tier on the same setting (1v1, 2v2);
 * - tier ordering: expert > average > novice, bots vs bots on each setting.
 *
 * Pure: no Phaser; deterministic.
 */

import {
  DEFAULT_ANALOG_TUNING,
  formatAnalogTuning,
  type AnalogTuning,
} from "../../core/analogTuning";
import type { BotTier } from "../../arcade/ai/BotTypes";
import {
  runCell,
  type BattleCell,
  type BattleSetting,
  type CellResult,
} from "./LabBattle";

/** The template engine: the lab's reference. */
export const TEMPLATE_SETTING: BattleSetting = {
  label: "template",
  engine: "template",
};

/** What the battle lab sweeps. */
export interface BattleLabOptions {
  readonly definitionId: string;
  /** Seeded rounds per cell (>= 30 for a report). */
  readonly rounds: number;
  /** Analog bank angles per cycle (°). */
  readonly banks: readonly number[];
  /** Hold-variant thresholds (ms); null = off. */
  readonly holds: readonly (number | null)[];
  /** Ships per side in head-to-head cells. */
  readonly squadFormations: readonly number[];
}

/** One measured cell with its labels. */
export interface BattleRow {
  readonly section: "headToHead" | "human" | "ordering";
  readonly definitionId: string;
  readonly setting: BattleSetting;
  /** What the subject faced, e.g. "average bots" or, in the ordering, "expert > average". */
  readonly versus: string;
  readonly formation: number;
  readonly result: CellResult;
}

/**
 * @param tuning - The analog tuning.
 * @returns The setting flying it.
 */
export function analogSetting(tuning: AnalogTuning): BattleSetting {
  return { label: `analog ${formatAnalogTuning(tuning)}`, engine: "analog", tuning };
}

/**
 * @param options - The sweep.
 * @returns Every analog setting: each bank angle with each hold variant.
 */
export function analogSettings(options: BattleLabOptions): BattleSetting[] {
  return options.banks.flatMap((bankDegrees) =>
    options.holds.map((heldTurnAfterMs) =>
      analogSetting({ ...DEFAULT_ANALOG_TUNING, bankDegrees, heldTurnAfterMs }),
    ),
  );
}

/**
 * @param cell - The cell to fly.
 * @param meta - Its labels.
 * @param options - The sweep.
 * @returns The measured row.
 */
function measured(
  cell: BattleCell,
  meta: Pick<BattleRow, "section" | "versus">,
  options: BattleLabOptions,
): BattleRow {
  return {
    ...meta,
    definitionId: cell.definitionId,
    setting: cell.subject.setting,
    formation: cell.formation,
    result: runCell(cell, options.rounds),
  };
}

/**
 * @param options - The sweep.
 * @param emit - Called with every finished row (progress).
 * @returns Bots on each analog setting (and the template control) against template bots.
 */
export function headToHeadRows(
  options: BattleLabOptions,
  emit: (row: BattleRow) => void,
): BattleRow[] {
  const rows: BattleRow[] = [];
  for (const setting of [TEMPLATE_SETTING, ...analogSettings(options)])
    for (const formation of options.squadFormations) {
      const row = measured(
        {
          definitionId: options.definitionId,
          formation,
          subject: { setting, pilots: { kind: "bot", tier: "average" } },
          opponent: { setting: TEMPLATE_SETTING, pilots: { kind: "bot", tier: "average" } },
          squads: formation > 1,
        },
        { section: "headToHead", versus: "average bots on template" },
        options,
      );
      rows.push(row);
      emit(row);
    }
  return rows;
}

/** Bot tiers of the human-like section and the tier ordering. */
const TIERS: readonly BotTier[] = ["novice", "average", "expert"];

/**
 * @param options - The sweep.
 * @param emit - Called with every finished row (progress).
 * @returns The human-like pilot on each setting against bots of each tier on that setting.
 */
export function humanRows(
  options: BattleLabOptions,
  emit: (row: BattleRow) => void,
): BattleRow[] {
  const rows: BattleRow[] = [];
  for (const setting of [TEMPLATE_SETTING, ...analogSettings(options)])
    for (const tier of TIERS)
      for (const formation of [1, 2]) {
        const row = measured(
          {
            definitionId: options.definitionId,
            formation,
            subject: { setting, pilots: { kind: "human" } },
            opponent: { setting, pilots: { kind: "bot", tier } },
            squads: false,
          },
          { section: "human", versus: `${tier} bots` },
          options,
        );
        rows.push(row);
        emit(row);
      }
  return rows;
}

/** Tier pairs of the ordering check: the higher tier is the subject. */
const ORDER_PAIRS: readonly (readonly [BotTier, BotTier])[] = [
  ["expert", "average"],
  ["average", "novice"],
  ["expert", "novice"],
];

/**
 * @param options - The sweep.
 * @param emit - Called with every finished row (progress).
 * @returns The higher tier of each pair against the lower on each setting (duels).
 */
export function orderingRows(
  options: BattleLabOptions,
  emit: (row: BattleRow) => void,
): BattleRow[] {
  const rows: BattleRow[] = [];
  for (const setting of [TEMPLATE_SETTING, ...analogSettings(options)])
    for (const [high, low] of ORDER_PAIRS) {
      const row = measured(
        {
          definitionId: options.definitionId,
          formation: 1,
          subject: { setting, pilots: { kind: "bot", tier: high } },
          opponent: { setting, pilots: { kind: "bot", tier: low } },
          squads: false,
        },
        { section: "ordering", versus: `${high} > ${low}` },
        options,
      );
      rows.push(row);
      emit(row);
    }
  return rows;
}
