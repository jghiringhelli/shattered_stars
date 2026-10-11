/**
 * scenarioMatch — one X-Wing 2.0 scenario match, stepped frame by frame:
 * objectives update continuously (control, scrambling, salvage carried and
 * dropped), destruction scores as it happens, and every
 * {@link SCENARIO_ROUND_MS} a round ends and the objectives score
 * (from the scenario's first scoring round on). The match ends at the
 * threshold, on annihilation or at the time limit (scenarioOutcome).
 *
 * Pure: immutable states, no Phaser.
 */

import { stepControlZones, zonesHeldBy } from "./controlRules";
import { scoreDestruction } from "./destructionScoring";
import { cratesCarriedBy, createCrates, stepSalvage } from "./salvageRules";
import { SCENARIO_ROUND_MS } from "./scenarioConstants";
import type { ScenarioDefinition } from "./scenarioDefinitions";
import { decideOutcome } from "./scenarioOutcome";
import { nodesOwnedBy, stepScrambleNode } from "./scrambleRules";
import type {
  ControlZone,
  SalvageCrate,
  ScenarioFrame,
  ScenarioResult,
  ScenarioSide,
  ScrambleNode,
  SidePoints,
} from "./scenarioTypes";

/** Everything a scenario match remembers. */
export interface ScenarioState {
  readonly definition: ScenarioDefinition;
  readonly elapsedMs: number;
  /** Rounds completed. */
  readonly round: number;
  /** Time into the current round (ms). */
  readonly roundElapsedMs: number;
  readonly zones: readonly ControlZone[];
  readonly nodes: readonly ScrambleNode[];
  readonly crates: readonly SalvageCrate[];
  /** Salvage pick-up cooldowns: ship id → battle time (ms). */
  readonly cooldowns: ReadonlyMap<string, number>;
  /** Ships that already conceded half their value. */
  readonly halfAwarded: ReadonlySet<string>;
  readonly points: Readonly<Record<ScenarioSide, SidePoints>>;
  /** Objective points each side scored at the last round's end, or null. */
  readonly lastRoundAwards: Readonly<Record<ScenarioSide, number>> | null;
  readonly result: ScenarioResult | null;
}

const NO_POINTS: SidePoints = { objective: 0, destruction: 0 };

/**
 * @param definition - The scenario.
 * @param worldSize - Torus side (objectives sit around its centre).
 * @returns A fresh match.
 */
export function createScenarioState(
  definition: ScenarioDefinition,
  worldSize: number,
): ScenarioState {
  const centre = worldSize / 2;
  const places = definition.slots.map((slot) => ({
    x: centre + slot.dx,
    y: centre + slot.dy,
    label: slot.label,
  }));
  const radius = definition.controlRadiusPx;
  const kind = definition.objectiveKind;
  return {
    definition,
    elapsedMs: 0,
    round: 0,
    roundElapsedMs: 0,
    zones:
      kind === "control"
        ? places.map((p) => ({
            ...p,
            id: `zone_${p.label}`,
            radius,
            controller: "none",
          }))
        : [],
    nodes:
      kind === "scramble"
        ? places.map((p) => ({
            ...p,
            id: `node_${p.label}`,
            radius,
            owner: null,
            progressSide: null,
            progressMs: 0,
            controller: "none",
          }))
        : [],
    crates: kind === "salvage" ? createCrates(places) : [],
    cooldowns: new Map(),
    halfAwarded: new Set(),
    points: { player: NO_POINTS, enemy: NO_POINTS },
    lastRoundAwards: null,
    result: null,
  };
}

/**
 * @param state - The match.
 * @param frame - This frame.
 * @returns The match after this frame (the same object once it has ended).
 */
export function stepScenario(
  state: ScenarioState,
  frame: ScenarioFrame,
): ScenarioState {
  if (state.result) return state;
  const elapsedMs = state.elapsedMs + frame.deltaMs;
  const destruction = scoreDestruction(state.halfAwarded, frame);
  const salvage = stepSalvage({
    crates: state.crates,
    cooldowns: state.cooldowns,
    frame,
    nowMs: elapsedMs,
  });
  let next: ScenarioState = {
    ...state,
    elapsedMs,
    zones: stepControlZones(state.zones, frame),
    nodes: state.nodes.map((node) => stepScrambleNode(node, frame)),
    crates: salvage.crates,
    cooldowns: salvage.cooldowns,
    halfAwarded: destruction.halfAwarded,
    points: addPoints(state.points, destruction.awards, "destruction"),
  };
  next = endRounds(next, state.roundElapsedMs + frame.deltaMs);
  const alive = (side: ScenarioSide): boolean =>
    frame.ships.some((s) => s.side === side);
  const result = decideOutcome({
    points: next.points,
    threshold: next.definition.threshold,
    elapsedMs,
    timeLimitMs: next.definition.timeLimitMs,
    alive: { player: alive("player"), enemy: alive("enemy") },
    rounds: next.round,
  });
  return result ? { ...next, result } : next;
}

/**
 * @param state - The match.
 * @param side - The side.
 * @param points - Objective points to add (debug hook / handicaps).
 * @returns The match with the points added.
 */
export function withBonusPoints(
  state: ScenarioState,
  side: ScenarioSide,
  points: number,
): ScenarioState {
  const awards = { player: 0, enemy: 0, [side]: points };
  return { ...state, points: addPoints(state.points, awards, "objective") };
}

/**
 * @param state - Objectives as they stand.
 * @returns Objective points each side scores at a round's end.
 */
export function roundAwards(
  state: Pick<ScenarioState, "definition" | "zones" | "nodes" | "crates">,
): Record<ScenarioSide, number> {
  const per = state.definition.pointsPerObjective;
  const score = (side: ScenarioSide): number =>
    per *
    (zonesHeldBy(state.zones, side) +
      nodesOwnedBy(state.nodes, side) +
      cratesCarriedBy(state.crates, side));
  return { player: score("player"), enemy: score("enemy") };
}

/**
 * @param state - The match (objectives already stepped).
 * @param roundElapsedMs - Time into the round including this frame.
 * @returns The match with every round that ended this frame scored.
 */
function endRounds(
  state: ScenarioState,
  roundElapsedMs: number,
): ScenarioState {
  let next = state;
  let remaining = roundElapsedMs;
  while (remaining >= SCENARIO_ROUND_MS) {
    remaining -= SCENARIO_ROUND_MS;
    const round = next.round + 1;
    const scoring = round >= next.definition.firstScoringRound;
    const awards = scoring ? roundAwards(next) : { player: 0, enemy: 0 };
    next = {
      ...next,
      round,
      points: addPoints(next.points, awards, "objective"),
      lastRoundAwards: awards,
    };
  }
  return { ...next, roundElapsedMs: remaining };
}

/**
 * @param points - Both sides' points.
 * @param awards - Points scored now.
 * @param source - Which tally they go to.
 * @returns The updated points.
 */
function addPoints(
  points: Readonly<Record<ScenarioSide, SidePoints>>,
  awards: Readonly<Record<ScenarioSide, number>>,
  source: keyof SidePoints,
): Readonly<Record<ScenarioSide, SidePoints>> {
  if (awards.player === 0 && awards.enemy === 0) return points;
  return {
    player: {
      ...points.player,
      [source]: points.player[source] + awards.player,
    },
    enemy: { ...points.enemy, [source]: points.enemy[source] + awards.enemy },
  };
}
