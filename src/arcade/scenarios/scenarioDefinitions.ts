/**
 * scenarioDefinitions — the four tabletop scenarios, adapted to real time:
 * where their objectives lie (offsets from the battlefield centre, in the
 * middle band between the two deployment lines), how they score and when
 * scoring starts.
 *
 * Pure data.
 */

import {
  CONTROL_RANGE_PX,
  DEFAULT_SCENARIO_THRESHOLD,
  SCENARIO_TIME_LIMIT_MS,
  SCRAMBLE_HOLD_CYCLES,
} from "./scenarioConstants";
import type { ScenarioId, ScenarioObjectiveKind } from "./scenarioTypes";

/** An objective's place: offset from the battlefield centre (px). */
export interface ObjectiveSlot {
  readonly dx: number;
  readonly dy: number;
  readonly label: string;
}

/** One scenario's rules. */
export interface ScenarioDefinition {
  readonly id: ScenarioId;
  /** Full tabletop name. */
  readonly name: string;
  /** Short name for buttons and the HUD. */
  readonly shortName: string;
  /** One-line rule summary (picker, briefing). */
  readonly summary: string;
  readonly objectiveKind: ScenarioObjectiveKind;
  readonly slots: readonly ObjectiveSlot[];
  /** Control radius of zones / nodes (px). */
  readonly controlRadiusPx: number;
  /** First round whose end scores objectives (1 = from the first round). */
  readonly firstScoringRound: number;
  /** Points per objective per scoring round. */
  readonly pointsPerObjective: number;
  /** Score that wins. */
  readonly threshold: number;
  /** Time limit (ms). */
  readonly timeLimitMs: number;
  /**
   * Scenario points per squad point of a destroyed ship (default:
   * SCENARIO_POINTS_PER_SQUAD_POINT; the reinforced variant values ships
   * against the whole pool).
   */
  readonly pointsPerSquadPoint?: number;
}

/** Satellites / nodes are spread this far apart along the centre line (px): range 3. */
const OBJECTIVE_SPREAD_PX = 3 * CONTROL_RANGE_PX;

/** Crates lie this far apart (px): range 1.5. */
const CRATE_SPREAD_PX = 600;

/**
 * Network nodes sit this far off the centre line (px): A toward the
 * player's line, C toward the opponent's, B on the centre — point-symmetric
 * about the centre, so both seats see the same board. (A and C both toward
 * the player and B toward the opponent gave the opponent's seat 65 % of
 * reinforced Scrambles; mirrored, the player's.)
 */
const NODE_STAGGER_PX = 250;

/**
 * Chance Engagement: rounds that pass before the central objective scores
 * (the tabletop starts scoring after the opening rounds).
 */
export const CHANCE_ENGAGEMENT_QUIET_ROUNDS = 3;

const COMMON = {
  controlRadiusPx: CONTROL_RANGE_PX,
  firstScoringRound: 1,
  pointsPerObjective: 1,
  threshold: DEFAULT_SCENARIO_THRESHOLD,
  timeLimitMs: SCENARIO_TIME_LIMIT_MS,
} as const;

/** Every scenario, by id. */
export const SCENARIO_DEFINITIONS: Readonly<
  Record<ScenarioId, ScenarioDefinition>
> = {
  satellite_array: {
    ...COMMON,
    id: "satellite_array",
    name: "Assault at the Satellite Array",
    shortName: "SATELLITE ARRAY",
    summary: "Three satellites — score 1 per satellite you control each round",
    objectiveKind: "control",
    slots: [
      { dx: -OBJECTIVE_SPREAD_PX, dy: 0, label: "A" },
      { dx: 0, dy: 0, label: "B" },
      { dx: OBJECTIVE_SPREAD_PX, dy: 0, label: "C" },
    ],
  },
  chance_engagement: {
    ...COMMON,
    id: "chance_engagement",
    name: "Chance Engagement",
    shortName: "CHANCE ENGAGEMENT",
    summary: `One central objective — scores from round ${CHANCE_ENGAGEMENT_QUIET_ROUNDS + 1}`,
    objectiveKind: "control",
    slots: [{ dx: 0, dy: 0, label: "X" }],
    firstScoringRound: CHANCE_ENGAGEMENT_QUIET_ROUNDS + 1,
  },
  salvage_mission: {
    ...COMMON,
    id: "salvage_mission",
    name: "Salvage Mission",
    shortName: "SALVAGE MISSION",
    summary:
      "Grab crates (unstressed) — carriers score each round; boost / roll / death drops them",
    objectiveKind: "salvage",
    slots: [
      { dx: -CRATE_SPREAD_PX, dy: 0, label: "1" },
      { dx: 0, dy: 0, label: "2" },
      { dx: CRATE_SPREAD_PX, dy: 0, label: "3" },
    ],
  },
  scramble_transmissions: {
    ...COMMON,
    id: "scramble_transmissions",
    name: "Scramble the Transmissions",
    shortName: "SCRAMBLE",
    summary: `Hold a node ${SCRAMBLE_HOLD_CYCLES} cycles to scramble it — scrambled nodes score each round`,
    objectiveKind: "scramble",
    slots: [
      { dx: -OBJECTIVE_SPREAD_PX, dy: NODE_STAGGER_PX, label: "A" },
      { dx: 0, dy: 0, label: "B" },
      { dx: OBJECTIVE_SPREAD_PX, dy: -NODE_STAGGER_PX, label: "C" },
    ],
  },
};

/** Scenario ids in picker order. */
export const SCENARIO_IDS: readonly ScenarioId[] = [
  "satellite_array",
  "chance_engagement",
  "salvage_mission",
  "scramble_transmissions",
];

/**
 * @param value - Anything (a battle config field).
 * @returns Whether it names a scenario.
 */
export function isScenarioId(value: unknown): value is ScenarioId {
  return (
    typeof value === "string" &&
    (SCENARIO_IDS as readonly string[]).includes(value)
  );
}
