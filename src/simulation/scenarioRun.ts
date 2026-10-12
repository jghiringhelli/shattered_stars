/**
 * scenarioRun — the Scenario mode's layers on a headless arena battle,
 * wired as the Skirmish scene wires them (ScenarioController): the
 * ScenarioDirector hands bots their objective goals (BotPilot safe points),
 * the ScenarioFrameTracker notes evasive flying and builds each tick's
 * frame, stepScenario scores it. Side A is the player's side.
 *
 * Mutates the run. Pure: no Phaser.
 */

import { BATTLEFIELD_SIZE } from "../config";
import { startManeuver } from "../core/ArcadeControls";
import {
  createScenarioState,
  deploymentPoses,
  stepScenario,
  type ScenarioDefinition,
  type ScenarioFrame,
  type ScenarioState,
} from "../arcade/scenarios";
import {
  ScenarioFrameTracker,
  isEvasiveFlightEvent,
} from "../scenes/scenario/scenarioFrameTracker";
import { ScenarioDirector } from "../scenes/scenario/ScenarioDirector";
import type { ArenaLoop, LoopHooks } from "./arenaLoop";
import { setArenaFlight, type ArenaShip } from "./skill/ArenaShip";
import { TICK_MS } from "./skill/ArenaSpec";

/** Arena side → its team (side A is the player's team). */
const SIDE_TEAM = { A: 0, B: 1 } as const;

/** A scenario being played on an arena loop. */
export interface ScenarioRun {
  readonly tracker: ScenarioFrameTracker;
  readonly director: ScenarioDirector;
  state: ScenarioState;
  /** Crates picked up so far. */
  pickups: number;
}

/**
 * @param definition - The scenario (classic or reinforced variant).
 * @returns A fresh run.
 */
export function createScenarioRun(definition: ScenarioDefinition): ScenarioRun {
  return {
    tracker: new ScenarioFrameTracker(SIDE_TEAM.A, BATTLEFIELD_SIZE),
    director: new ScenarioDirector(BATTLEFIELD_SIZE),
    state: createScenarioState(definition, BATTLEFIELD_SIZE),
    pickups: 0,
  };
}

/**
 * Put each side's opening ships on its deployment line, flying straight.
 * @param ships - The opening ships.
 */
export function deployOnScenarioLines(ships: readonly ArenaShip[]): void {
  for (const sideId of ["A", "B"] as const) {
    const own = ships.filter((s) => s.side === sideId);
    const poses = deploymentPoses(
      own.length,
      sideId === "A" ? "player" : "enemy",
      BATTLEFIELD_SIZE,
    );
    own.forEach((ship, i) => {
      const pose = poses[i]!;
      const control = startManeuver(
        pose,
        ship.flight.motion.control,
        "straight",
      );
      setArenaFlight(ship, { ...ship.flight, motion: { ...pose, control } });
    });
  }
}

/**
 * Before the frame: the director re-plans objective goals.
 * @param run - The scenario.
 * @param loop - The battle.
 */
export function directScenario(run: ScenarioRun, loop: ArenaLoop): void {
  run.director.update({
    nowMs: loop.nowMs,
    state: run.state,
    ships: loop.ships
      .filter((s) => s.alive)
      .map((s) => ({
        id: s.id,
        side: s.side === "A" ? "player" : "enemy",
        x: s.x,
        y: s.y,
        isHuman: false,
      })),
    markActive: false,
  });
}

/**
 * @param run - The scenario.
 * @returns The frame hooks: objective goals and evasive-flight notes.
 */
export function scenarioHooks(run: ScenarioRun): LoopHooks {
  return {
    goalFor: (shipId) => run.director.goalFor(shipId),
    onFlown: (ship, events, origin) => {
      if (events.some(isEvasiveFlightEvent))
        run.tracker.noteEvasive(ship.id, origin);
    },
  };
}

/**
 * After the frame: score it.
 * @param run - The scenario (state replaced, pickups counted).
 * @param loop - The battle.
 * @param reserves - Reinforced battles: whether each side can still field a ship.
 */
export function scoreScenario(
  run: ScenarioRun,
  loop: ArenaLoop,
  reserves?: ScenarioFrame["reserves"],
): void {
  const carried = (): number =>
    run.state.crates.filter((c) => c.carrierId).length;
  const before = carried();
  run.state = stepScenario(
    run.state,
    run.tracker.build(
      loop.ships.map((s) => ({
        ...s,
        team: SIDE_TEAM[s.side],
        hull: s.alive ? s.hull : 0,
        stress: { isStressed: s.flight.stress.isStressed },
      })),
      TICK_MS,
      reserves,
    ),
  );
  run.pickups += Math.max(0, carried() - before);
}
