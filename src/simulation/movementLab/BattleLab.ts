/**
 * BattleLab — runs the movement lab's battle emulation (head to head, the
 * human-like pilot, tier ordering) and formats its section of
 * docs/balance/movement-lab.md. Rows are plain data, so runs for different
 * ships or sections can be flown in separate processes and merged
 * (scripts/movement_lab.ts --battle-json / --battle-merge).
 *
 * Pure: no Phaser; deterministic.
 */

import {
  DEFAULT_ANALOG_TUNING,
  formatAnalogTuning,
} from "../../core/analogTuning";
import {
  headToHeadRows,
  humanRows,
  orderingRows,
  type BattleLabOptions,
  type BattleRow,
} from "./LabBattleCells";
import {
  headToHeadTable,
  humanTable,
  orderingTable,
  recommend,
  recommendationTable,
  type Recommendation,
} from "./LabBattleReport";

/** The sections of the battle emulation. */
export type BattleSection = BattleRow["section"];

/** Every section, in report order. */
export const BATTLE_SECTIONS: readonly BattleSection[] = ["headToHead", "human", "ordering"];

/** Everything the battle emulation measured, by section. */
export interface BattleLabReport {
  readonly headToHead: readonly BattleRow[];
  readonly human: readonly BattleRow[];
  readonly ordering: readonly BattleRow[];
  readonly recommendation: readonly Recommendation[];
}

/**
 * @param options - The sweep (ship, rounds, bank angles, hold variants, formations).
 * @param sections - Which sections to fly.
 * @param emit - Called with every finished row (progress output).
 * @returns The rows of the chosen sections.
 */
export function runBattleRows(
  options: BattleLabOptions,
  sections: readonly BattleSection[] = BATTLE_SECTIONS,
  emit: (row: BattleRow) => void = () => undefined,
): BattleRow[] {
  return [
    ...(sections.includes("headToHead") ? headToHeadRows(options, emit) : []),
    ...(sections.includes("human") ? humanRows(options, emit) : []),
    ...(sections.includes("ordering") ? orderingRows(options, emit) : []),
  ];
}

/**
 * @param rows - Rows from any number of runs (ships, sections).
 * @returns The report: the sections and the recommendation.
 */
export function assembleBattleReport(rows: readonly BattleRow[]): BattleLabReport {
  const of = (section: BattleSection): BattleRow[] =>
    rows.filter((row) => row.section === section);
  return {
    headToHead: of("headToHead"),
    human: of("human"),
    ordering: of("ordering"),
    recommendation: recommend(of("human"), of("headToHead")),
  };
}

/**
 * @param report - The battle emulation's results.
 * @returns The markdown section.
 */
export function formatBattleReport(report: BattleLabReport): string {
  const all = [...report.headToHead, ...report.human, ...report.ordering];
  const ships = [...new Set(all.map((row) => row.definitionId))];
  const rounds = Math.min(...all.map((row) => row.result.rounds));
  return [
    "## Battle emulation (real skill arena, seeded)",
    "",
    `Ships ${ships.map((ship) => `\`${ship}\``).join(", ")} (same hull on both sides; results are pooled over the ships), at least ${rounds} seeded rounds per cell and ship (seed = round + 1; the subject flies side A in even rounds and B in odd ones), 120 s game-time limit (timeouts are decided on points). Squads (2v2, 4v4 bots) coordinate with orders and a squad mark; the human-like pilot ignores orders and flies on its own.`,
    "*Human-like pilot*: sees enemies 150-250 ms late (drawn per pilot), chases the nearest, presses the proportional-policy keys (template: Q/E ≥ 18°, arrow ≥ 5°, instant cut; analog: the one key while there is error), slows to its hard-turn speed to line up a shot and opens up on a far target; no specials, boost or rolls.",
    "Meters are the subject's: wedge % = time with an enemy inside the ship's own firing arc and range; stress = mean stress level (0-1); turns = key-down starts (analog) or turning cycles started (template); at speed cap = ticks flown below the set throttle; heading accel RMS = roughness of the heading rate.",
    "",
    ...headToHeadTable(report.headToHead),
    ...humanTable(report.human),
    ...orderingTable(report.ordering),
    ...recommendationTable(report.recommendation),
    `Applied default: **${formatAnalogTuning(DEFAULT_ANALOG_TUNING)}** (\`DEFAULT_ANALOG_TUNING\`): the best human-like win rate and head-to-head result of the settings that keep the tier ordering and the squad gate (80° ranks higher on some proxies but turns a bank almost as hard as a hard turn). Skill gate 1 under analog is marginal for every setting (the gate table and the feel-test list are in docs/specs/flight-controls.md). The human-like pilot is crude (no specials, no lead): read the cells as relative, not as absolute win rates.`,
  ].join("\n");
}
