/**
 * ArcadeFlightRecorder — flies one ship through the REAL arcade motion code
 * (ShipMotion.stepMotion, the same step ArcadeBattleScene runs) on a fixed
 * flight plan and records its telemetry.
 *
 * Positions are recorded both wrapped (what the scene stores) and unwrapped
 * (accumulated torus displacement), so a ship crossing the battlefield seam can
 * still be compared against the oracle in one continuous frame of reference.
 *
 * Pure: no Phaser. Consumed by the flight-telemetry test battery.
 */

import { BATTLEFIELD_SIZE } from "../../config";
import { stepMotion, type MotionState } from "../../arcade/systems/ShipMotion";
import {
  dueQueuesOf,
  initialControl,
  newTape,
  performDue,
  queueStep,
  recordTick,
  spawnShip,
  tickLength,
} from "./ArcadeFlightTape";
import type { FlightOptions, FlightRecord } from "./ArcadeFlightTypes";
import type { FlightStep } from "./XWingFlightOracle";

export {
  ARCADE_FIXED_TICK_MS,
  type FlightOptions,
  type FlightRecord,
  type TelemetrySample,
  type TimedAction,
  type TimedInterrupt,
} from "./ArcadeFlightTypes";

/** Ticks after which a plan is declared stuck (no cycle ever completes). */
const MAX_TICKS = 20000;

/**
 * Fly a ship through a plan, one maneuver per cycle, and record telemetry.
 *
 * @param definitionId - Ship definition id.
 * @param plan - Maneuvers, one per cycle (must be non-empty).
 * @param options - Start pose, tick schedule, boosts, interrupts, world size.
 * @returns The recorded flight.
 */
export function flyArcadeShip(
  definitionId: string,
  plan: ReadonlyArray<FlightStep>,
  options: FlightOptions = {},
): FlightRecord {
  const worldSize = options.worldSize ?? BATTLEFIELD_SIZE;
  const mid = worldSize / 2;
  const start = options.start ?? { x: mid, y: mid, angle: 0 };
  const due = dueQueuesOf(options);

  const ship = spawnShip(definitionId, start);
  const { control, baseSize } = initialControl(
    ship,
    plan[0]!,
    options.dialCaps ?? true,
  );
  let state: MotionState = {
    x: start.x,
    y: start.y,
    angle: start.angle,
    control: queueStep(control, plan[1]),
  };
  const tape = newTape(start);
  let tMs = 0;

  for (
    let tick = 0;
    tape.cyclePoses.length < plan.length && tick < MAX_TICKS;
    tick++
  ) {
    const dt = tickLength(options, tick);
    const prior = state;
    const step = stepMotion(
      performDue(state, ship, due, { tMs, worldSize }),
      ship,
      dt,
      worldSize,
    );
    state = step.state;
    tMs += dt;
    const cycles = tape.cyclePoses.length;
    recordTick(tape, prior, step, { tMs, dtMs: dt, worldSize });
    if (tape.cyclePoses.length > cycles)
      state = {
        ...state,
        control: queueStep(state.control, plan[tape.cyclePoses.length + 1]),
      };
  }

  return { baseSize, ...tape };
}
