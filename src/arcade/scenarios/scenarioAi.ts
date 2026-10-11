/**
 * scenarioAi — the squad layer's objective play in Scenario mode, on top of
 * SquadCommand's dogfight orders. For each side it picks who plays the
 * objectives:
 * - carriers (ships holding salvage) run home and are always steered, so
 *   they never boost or barrel-roll the crate away;
 * - 1–2 "runners" ({@link objectiveRunnerCount}) are assigned, greedily by
 *   distance, urgency and stickiness, to hold / contest a satellite or node,
 *   collect a loose crate or hunt an enemy carrier;
 * - everybody else screens (flies the squad's usual orders).
 * The human player never gets an order, and while the player has a target
 * marked (R) the wingmen leave the objectives to follow the mark (carriers
 * keep carrying).
 *
 * Pure: no Phaser. Scenes turn directives into steering with
 * {@link steeringGoal} (BotPilot's safe-point path).
 */

import {
  distanceBetween,
  type ObjectivePoint,
} from "../objectives/objectiveGeometry";
import { opponentOf } from "./destructionScoring";
import { homePoint } from "./scenarioDeployment";
import type { ScenarioState } from "./scenarioMatch";
import type { ObjectiveOwner, ScenarioSide } from "./scenarioTypes";

/** What a ship does for the scenario. */
export type ScenarioRole = "hold" | "collect" | "carry" | "hunt" | "screen";

/** One ship's scenario order. */
export interface ScenarioDirective {
  readonly role: ScenarioRole;
  /** The objective (zone / node / crate id, or the hunted carrier's id). */
  readonly objectiveId: string | null;
  /** Where to fly, or null to fly the squad's orders. */
  readonly goal: ObjectivePoint | null;
  /** Inside this distance of the goal the pilot fights freely; 0 = always steer. */
  readonly leashPx: number;
}

/** A living ship, as the planner sees it. */
export interface PlannerShip extends ObjectivePoint {
  readonly id: string;
  readonly side: ScenarioSide;
  /** Flown by the human player (never ordered). */
  readonly isHuman: boolean;
}

/** One side's planning input. */
export interface SidePlanInput {
  readonly state: ScenarioState;
  readonly side: ScenarioSide;
  /** Every living ship (both sides). */
  readonly ships: readonly PlannerShip[];
  readonly worldSize: number;
  /** The side's directives from the last plan (stickiness). */
  readonly previous: ReadonlyMap<string, ScenarioDirective>;
  /** The player's side has a live mark (R): wingmen follow it instead. */
  readonly markActive: boolean;
}

/** A holder roams this share of the control range before steering back. */
export const HOLD_LEASH_FRACTION = 0.6;

/** A hunter closes to this distance of the carrier, then dogfights (px). */
export const HUNT_LEASH_PX = 500;

/** Each urgency level is worth this much distance in the assignment (px). */
export const URGENCY_WEIGHT_PX = 1000;

/** Keeping last plan's assignment is worth this much distance (px). */
export const STICKY_ASSIGNMENT_PX = 400;

/** AI ships on a side from which it sends a second runner. */
const SECOND_RUNNER_AT = 3;

/** The order of a ship with nothing to do for the scenario. */
const SCREEN: ScenarioDirective = {
  role: "screen",
  objectiveId: null,
  goal: null,
  leashPx: 0,
};

/** Something a runner can be sent to. */
interface Target {
  readonly id: string;
  readonly at: ObjectivePoint;
  readonly role: "hold" | "collect" | "hunt";
  readonly leashPx: number;
  /** 0 = ours already, 1 = open, 2 = urgent. */
  readonly urgency: number;
}

/**
 * @param aiShips - Free AI ships on a side (carriers and the human excluded).
 * @returns How many of them play the objectives: 1, or 2 from three ships on.
 */
export function objectiveRunnerCount(aiShips: number): number {
  if (aiShips <= 0) return 0;
  return aiShips >= SECOND_RUNNER_AT ? 2 : 1;
}

/**
 * @param input - The match, the side, every ship, last plan, mark state.
 * @returns A directive per AI ship of the side.
 */
export function planScenarioSide(
  input: SidePlanInput,
): Map<string, ScenarioDirective> {
  const orders = new Map<string, ScenarioDirective>();
  const own = input.ships.filter((s) => s.side === input.side && !s.isHuman);
  const carriers = new Map(
    input.state.crates
      .filter((c) => c.carrierSide === input.side)
      .map((c) => [c.carrierId, c.id]),
  );
  const home = homePoint(input.side, input.worldSize);
  for (const ship of own) {
    const crateId = carriers.get(ship.id);
    orders.set(
      ship.id,
      crateId
        ? { role: "carry", objectiveId: crateId, goal: home, leashPx: 0 }
        : SCREEN,
    );
  }
  if (input.markActive && input.side === "player") return orders;
  const free = own.filter((s) => !carriers.has(s.id));
  assignRunners(input, free, objectiveRunnerCount(free.length), orders);
  return orders;
}

/**
 * @param directive - A ship's directive.
 * @param ship - The ship's position.
 * @param worldSize - Torus side.
 * @returns Where to steer now, or null to fly the squad's orders.
 */
export function steeringGoal(
  directive: ScenarioDirective,
  ship: ObjectivePoint,
  worldSize: number,
): ObjectivePoint | null {
  if (!directive.goal) return null;
  if (
    directive.leashPx > 0 &&
    distanceBetween(ship, directive.goal, worldSize) <= directive.leashPx
  )
    return null;
  return directive.goal;
}

/**
 * Greedy assignment: the cheapest (ship, target) pair first, each target
 * once while untaken ones remain.
 */
function assignRunners(
  input: SidePlanInput,
  free: readonly PlannerShip[],
  count: number,
  orders: Map<string, ScenarioDirective>,
): void {
  const targets = targetsFor(input);
  if (targets.length === 0) return;
  const taken = new Set<string>();
  const busy = new Set<string>();
  for (let k = 0; k < count; k++) {
    const open = targets.filter((t) => !taken.has(t.id));
    const pool = open.length > 0 ? open : targets;
    let best: { ship: PlannerShip; target: Target; cost: number } | null = null;
    for (const ship of free) {
      if (busy.has(ship.id)) continue;
      for (const target of pool) {
        const cost = assignmentCost(input, ship, target);
        if (!best || cost < best.cost) best = { ship, target, cost };
      }
    }
    if (!best) return;
    busy.add(best.ship.id);
    taken.add(best.target.id);
    const { id, at, role, leashPx } = best.target;
    orders.set(best.ship.id, {
      role,
      objectiveId: id,
      goal: { x: at.x, y: at.y },
      leashPx,
    });
  }
}

/**
 * @returns Distance, less urgency and stickiness bonuses (lower is better).
 */
function assignmentCost(
  input: SidePlanInput,
  ship: PlannerShip,
  target: Target,
): number {
  const sticky =
    input.previous.get(ship.id)?.objectiveId === target.id
      ? STICKY_ASSIGNMENT_PX
      : 0;
  return (
    distanceBetween(ship, target.at, input.worldSize) -
    target.urgency * URGENCY_WEIGHT_PX -
    sticky
  );
}

/**
 * @param input - The planning input.
 * @returns Every objective the side's runners could be sent to.
 */
function targetsFor(input: SidePlanInput): Target[] {
  const { state, side } = input;
  const enemy = opponentOf(side);
  const zones = state.zones.map((zone) => ({
    id: zone.id,
    at: zone,
    role: "hold" as const,
    leashPx: zone.radius * HOLD_LEASH_FRACTION,
    urgency: controlUrgency(zone.controller, enemy),
  }));
  const nodes = state.nodes.map((node) => ({
    id: node.id,
    at: node,
    role: "hold" as const,
    leashPx: node.radius * HOLD_LEASH_FRACTION,
    urgency: node.owner !== side || node.progressSide === enemy ? 2 : 0,
  }));
  const loose = state.crates
    .filter((crate) => crate.carrierId === null)
    .map((crate) => ({
      id: crate.id,
      at: crate,
      role: "collect" as const,
      leashPx: 0,
      urgency: 2,
    }));
  const hunts = state.crates
    .filter((crate) => crate.carrierSide === enemy && crate.carrierId !== null)
    .map((crate) => ({
      id: crate.carrierId!,
      at: crate,
      role: "hunt" as const,
      leashPx: HUNT_LEASH_PX,
      urgency: 1,
    }));
  return [...zones, ...nodes, ...loose, ...hunts];
}

/**
 * @param controller - Who holds a zone.
 * @param enemy - The planning side's opponent.
 * @returns 2 when the opponent holds or contests it, else 1 (keep / take it).
 */
function controlUrgency(
  controller: ObjectiveOwner,
  enemy: ScenarioSide,
): number {
  return controller === enemy || controller === "contested" ? 2 : 1;
}
