/**
 * reinforcementReadout — a plain snapshot of a reinforced battle for e2e
 * tests and telemetry: rules, every side's pool and field, the picker's
 * rows (with enabled state and reason), the clock, the result and what
 * the HUD shows.
 *
 * Pure.
 */

import type {
  CoalitionStats,
  ReinforcedResult,
  ReinforcedSide,
  ReinforcementDirector,
  SideSummary,
} from "../../../arcade/reinforcements";

/** One picker row as tests read it. */
export interface PickerRowReadout {
  readonly definitionId: string;
  readonly loadoutId: string | null;
  readonly cost: number;
  readonly allowed: boolean;
  readonly reason: string;
  readonly isDefault: boolean;
  readonly source: "reserve" | "catalog";
}

/** The battle's reinforcement state. */
export interface ReinforcementReadout {
  readonly format: string;
  readonly poolPoints: number;
  readonly fieldCapPoints: number;
  readonly choice: string;
  readonly sides: readonly SideSummary[];
  readonly playerShipId: string | null;
  readonly picker: {
    readonly rows: readonly PickerRowReadout[];
    readonly remainingMs: number;
    readonly counting: boolean;
    readonly shown: { rows: string[]; enabled: boolean[]; countdown: string };
  } | null;
  readonly elapsedMs: number;
  readonly remainingMs: number;
  readonly result: ReinforcedResult | null;
  readonly stats: Readonly<Record<ReinforcedSide, CoalitionStats>>;
  readonly hud: { rows: string[]; next: string; toasts: string[] };
}

/**
 * @param director - The match.
 * @param hud - What the panel shows.
 * @param shownPicker - What the picker shows.
 * @returns The snapshot.
 */
export function buildReadout(
  director: ReinforcementDirector,
  hud: ReinforcementReadout["hud"],
  shownPicker: { rows: string[]; enabled: boolean[]; countdown: string },
): ReinforcementReadout {
  const picker = director.picker;
  return {
    format: director.rules.format,
    poolPoints: director.rules.poolPoints,
    fieldCapPoints: director.rules.fieldCapPoints,
    choice: director.rules.choice,
    sides: director.summaries(),
    playerShipId: director.playerShipId,
    picker: picker && {
      rows: picker.options.map((row) => ({
        definitionId: row.option.definitionId,
        loadoutId: row.option.loadoutId,
        cost: row.option.cost,
        allowed: row.check.allowed,
        reason: row.check.reason,
        isDefault: row.isDefault,
        source: row.source,
      })),
      remainingMs: picker.remainingMs,
      counting: picker.counting,
      shown: shownPicker,
    },
    elapsedMs: director.elapsedMs,
    remainingMs: director.remainingMs,
    result: director.result,
    stats: director.matchStats(),
    hud,
  };
}
