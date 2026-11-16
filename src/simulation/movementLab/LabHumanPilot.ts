/**
 * LabHumanPilot — a human-like pilot for the movement lab's battle emulation:
 * it sees the enemies a reaction delay (150-250 ms, drawn once per pilot)
 * late, chases the nearest one, presses the keys the lab's proportional
 * policy presses for the heading error (template: Q/E for a big error, the
 * arrow for a medium one; analog: the one key while there is error) and
 * manages its throttle by hand: it slows to its hard-turn speed to line up a
 * shot and opens up when the target is far and ahead. It never uses specials,
 * boost or rolls.
 *
 * A BotPilot subclass only so the arena can fly it in place of a tier's bot;
 * everything the bots decide is replaced.
 *
 * Pure: no Phaser; draws only from the battle's seeded source.
 */

import { BATTLEFIELD_SIZE } from "../../config";
import { offNoseDeg, torusOffset } from "../../arcade/ai/AiGeometry";
import { BotPilot, type BotFlightFrame } from "../../arcade/ai/BotPilot";
import { IDLE_INTENT, type PerceivedShip, type PilotIntent } from "../../arcade/ai/BotTypes";
import { contactSnapshot } from "../../arcade/ai/BotView";
import { SnapshotHistory } from "../../arcade/ai/Perception";
import {
  applyPilotFlightInput,
  INITIAL_PILOT_CONTROL,
  onPilotCycleCommitted,
  type FlightEdge,
  type PilotControlState,
} from "../../arcade/systems/PilotFlightControls";
import type { FlightControlResult } from "../../arcade/systems/PilotFlightTypes";
import type { ManeuverDirection } from "../../core/types";
import { createLabPilot, type LabPilot } from "./LabPilot";

/** Fastest and slowest reaction a human-like pilot draws (ms). */
export const HUMAN_REACTION_MS = { min: 150, max: 250 } as const;
/** Shortest time between two throttle taps (ms): about four taps a second. */
const THROTTLE_TAP_GAP_MS = 250;
/** Heading error from which the pilot slows to its hard-turn speed (°). */
const SLOW_FOR_TURN_ERROR_DEG = 30;
/** Heading error below which the pilot opens the throttle on a far target (°). */
const OPEN_UP_ERROR_DEG = 15;
/** The pilot opens up beyond this many weapon ranges. */
const OPEN_UP_RANGES = 1.5;
/** Another enemy replaces the target only when this much nearer. */
const RETARGET_RATIO = 0.75;

export class HumanLikePilot extends BotPilot {
  private readonly reactionMs: number;
  private readonly steer: LabPilot;
  private sightings: SnapshotHistory;
  private memory: PilotControlState = INITIAL_PILOT_CONTROL;
  private target: string | null = null;
  private lastTapMs = Number.NEGATIVE_INFINITY;
  private ticks = 0;

  /**
   * @param random - The battle's seeded source (draws the reaction delay).
   * @param engine - Steering engine of the ship it flies.
   */
  constructor(
    random: () => number,
    private readonly engine: "template" | "analog",
  ) {
    super("average", { random });
    this.reactionMs =
      HUMAN_REACTION_MS.min +
      random() * (HUMAN_REACTION_MS.max - HUMAN_REACTION_MS.min);
    this.steer = createLabPilot("proportional", engine);
    this.sightings = new SnapshotHistory(this.reactionMs, BATTLEFIELD_SIZE);
  }

  /** The enemy the pilot is chasing. */
  override get targetId(): string | null {
    return this.target;
  }

  /** What the pilot is doing, as an intent (target only: it has no bot behind it). */
  override get intent(): PilotIntent {
    return { ...IDLE_INTENT, targetId: this.target };
  }

  /**
   * @param frame - The ship, everyone else and the timing.
   * @returns New motion and stress, flown through the player's controls.
   */
  override fly(frame: BotFlightFrame): FlightControlResult {
    this.sightings.record(
      frame.nowMs,
      [frame.self, ...frame.contacts].map(contactSnapshot),
    );
    const enemies = this.sightings
      .perceive(frame.nowMs, this.reactionMs, frame.self.id)
      .filter((ship) => ship.side !== frame.self.side);
    const pose = frame.flight.motion;
    const aim = this.pickTarget(pose, enemies);
    const error = aim ? offNoseDeg(pose, aim, frame.worldSize) : 0;
    const keys = aim
      ? this.steer({
          errorDeg: error,
          tick: this.ticks++,
          currentManeuver: pose.control.currentManeuver,
          nextManeuver: pose.control.nextManeuver,
        })
      : { left: false, right: false, edges: new Set<FlightEdge>() };
    const edges = new Set(keys.edges);
    const tap = aim ? this.throttleTap(frame, error, aim) : null;
    if (tap) edges.add(tap === "up" ? "THRUST_UP" : "THRUST_DOWN");
    const result = applyPilotFlightInput(
      this.memory,
      { ship: pose, motion: pose, stress: frame.flight.stress, dial: frame.dial },
      {
        left: keys.left,
        right: keys.right,
        up: tap === "up",
        down: tap === "down",
        edges,
        nowMs: frame.nowMs,
        deltaMs: frame.deltaMs,
      },
      frame.worldSize,
      { interruptCycles: this.engine === "template" },
    );
    this.memory = result.pilot;
    return result;
  }

  /** @param started - The maneuver the new cycle started. */
  override onCycleCommitted(started: ManeuverDirection): void {
    this.memory = onPilotCycleCommitted(this.memory, started);
  }

  /** Forget everything (new round / respawn). */
  override reset(): void {
    this.memory = INITIAL_PILOT_CONTROL;
    this.target = null;
    this.lastTapMs = Number.NEGATIVE_INFINITY;
    this.sightings = new SnapshotHistory(this.reactionMs, BATTLEFIELD_SIZE);
  }

  /**
   * @param from - Own pose.
   * @param enemies - Enemies as perceived.
   * @returns The enemy to chase (the current one unless another is much nearer).
   */
  private pickTarget(
    from: { x: number; y: number },
    enemies: readonly PerceivedShip[],
  ): PerceivedShip | null {
    const distance = (ship: PerceivedShip): number =>
      torusOffset(from, ship, BATTLEFIELD_SIZE).distance;
    const nearest = [...enemies].sort((a, b) => distance(a) - distance(b))[0];
    const current = enemies.find((ship) => ship.id === this.target);
    const chosen =
      current && nearest && distance(nearest) >= RETARGET_RATIO * distance(current)
        ? current
        : (nearest ?? null);
    this.target = chosen?.id ?? null;
    return chosen;
  }

  /**
   * @param frame - This frame.
   * @param error - Heading error to the target (°).
   * @param aim - The target as perceived.
   * @returns A throttle tap, or null.
   */
  private throttleTap(
    frame: BotFlightFrame,
    error: number,
    aim: PerceivedShip,
  ): "up" | "down" | null {
    if (frame.nowMs - this.lastTapMs < THROTTLE_TAP_GAP_MS) return null;
    const control = frame.flight.motion.control;
    const turnSpeeds = control.capabilities?.dialSpeeds?.turn ?? [];
    const turnSpeed = turnSpeeds.length > 0 ? Math.max(...turnSpeeds) : control.speed;
    const far =
      torusOffset(frame.flight.motion, aim, frame.worldSize).distance >
      frame.self.weaponRange * OPEN_UP_RANGES;
    let tap: "up" | "down" | null = null;
    if (Math.abs(error) >= SLOW_FOR_TURN_ERROR_DEG && control.speed > turnSpeed)
      tap = control.speed > control.minSpeed ? "down" : null;
    else if (far && Math.abs(error) < OPEN_UP_ERROR_DEG && control.speed < control.maxSpeed)
      tap = "up";
    if (tap) this.lastTapMs = frame.nowMs;
    return tap;
  }
}

/**
 * @param engine - Steering engine of the ships.
 * @returns A pilot factory for {@link import("../skill/ArenaSpec").ShipEntry.makePilot}.
 */
export function humanLikePilotFactory(
  engine: "template" | "analog",
): (random: () => number) => HumanLikePilot {
  return (random) => new HumanLikePilot(random, engine);
}
