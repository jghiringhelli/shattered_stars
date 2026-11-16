/**
 * analogSteering — the pure model of the analog turn key.
 *
 * While the turn key is held, the ship's heading changes at the rate its dial
 * allows at the flown speed: the hard-turn template per cycle (90°) where the
 * dial prints a hard turn, the bank template (45°) where it prints only a
 * bank, and nothing at cruise speeds that print neither (steering then slows
 * the ship to the fastest speed that has a turn, like the template engine's
 * speed cap). Holding a share of the cycle turns that share of the angle.
 *
 * The motion is an exact circular arc per tick whose radius is the template's
 * (chord L = speed × SPEED_SCALE_FACTOR + base), so a full-cycle hold lands on
 * the tabletop template whatever the tick length. Everything here is plain
 * data and pure functions: no Phaser, no clock, no randomness.
 */

import { CYCLE_DURATION_MS, SPEED_SCALE_FACTOR } from "../config";
import type { MovementProfile } from "../data/ShipDefinitions";
import {
  degToRad,
  normalizeAngle,
  rotatePoint,
} from "../systems/MovementSystem";
import type { SteeringMode } from "./steeringMode";
import { flownSpeed, type DialSpeedTable } from "./speedCap";
import type { ManeuverDirection } from "./types";

/** Heading change of the dial's hard turn over one cycle (°). */
export const ANALOG_TURN_DEGREES = 90;
/** Heading change of the dial's bank over one cycle (°). */
export const ANALOG_BANK_DEGREES = 45;

/** Which way the turn key is held. */
export type AnalogSide = "none" | "left" | "right";

/** The dial entry that limits the turn rate. */
export type AnalogTurnKind = "turn" | "bank";

/** What the dial allows while the key is held. */
export interface SteeringCapacity {
  /** Speed the ship flies while turning (the set speed or the nearest turn speed). */
  readonly speed: number;
  /** Heading change per cycle at the key's rate (°); capped under stress. */
  readonly rateDeg: number;
  /** What the dial allows at that speed, whatever the stress (°). */
  readonly dialMaxDeg: number;
  readonly kind: AnalogTurnKind;
}

/** Per-cycle state of the analog steering carried by the control state. */
export interface AnalogSteer {
  /** A free-steer cycle is flying (false during an atomic special / template cycle). */
  readonly free: boolean;
  /** Turn key held now. */
  readonly held: AnalogSide;
  /** A stressed pilot turns at bank rate at most. */
  readonly stressed: boolean;
  /** Speed of the cycle when the key is not held (the set speed through the dial). */
  readonly baseSpeed: number;
  /** Turn rate while held (°/cycle); 0 when not held. */
  readonly rateDeg: number;
  /** Absolute heading turned so far this cycle (°). */
  readonly turnedDeg: number;
  /** Speed the turn was flown at this cycle; null = none. */
  readonly turnSpeed: number | null;
  /** The dial's maximum at that speed (°). */
  readonly dialMaxDeg: number;
  readonly turnKind: AnalogTurnKind;
}

/** What the analog engine reads of a control state (structural: no import cycle). */
export interface AnalogControlView {
  speed: number;
  cycleSpeed: number;
  baseSize: number;
  maneuverProgress: number;
  movementProfile: MovementProfile;
  currentManeuver: ManeuverDirection | null;
  maneuverTarget: { x: number; y: number; angle: number } | null;
  capabilities?:
    | {
        readonly steering?: SteeringMode | undefined;
        readonly dialSpeeds?: DialSpeedTable | undefined;
        readonly analogRateScale?: number | undefined;
      }
    | undefined;
  analog?: AnalogSteer;
}

/** Highest turn speed the stressed-rate cap treats as a bank (°). */
const STRESSED_RATE_DEGREES = ANALOG_BANK_DEGREES;

/**
 * @param control - A control state.
 * @returns Whether its ship steers with the analog key (fighters in analog
 * mode; capital hulls keep the template engine).
 */
export function usesAnalogSteering(
  control: Pick<AnalogControlView, "capabilities" | "movementProfile">,
): boolean {
  return (
    control.capabilities?.steering === "analog" &&
    control.movementProfile !== "capital"
  );
}

/**
 * What the key does at a set speed. A turn (or, failing that, a bank) at the
 * set speed is flown there; at a speed the dial prints neither the ship slows
 * to the highest speed that has one (the nearest above when none is below),
 * the same rule as the speed cap (src/core/speedCap).
 *
 * @param table - The ship's dial speeds (undefined = uncapped: full turn at the set speed).
 * @param setSpeed - The throttle the pilot set.
 * @param stressed - Whether the pilot is stressed (bank rate at most).
 * @param rateScale - Multiplier on the per-cycle turn rate (tuning knob; default 1).
 * @returns Speed and turn rate while the key is held.
 */
export function steeringCapacity(
  table: DialSpeedTable | undefined,
  setSpeed: number,
  stressed: boolean,
  rateScale: number = 1,
): SteeringCapacity {
  const turns = table?.turn ?? [];
  const banks = table?.bank ?? [];
  if (setSpeed <= 0 || (turns.length === 0 && banks.length === 0))
    return capacityOf(setSpeed, "turn", stressed, rateScale);
  const printed = [...new Set([...turns, ...banks])].sort((a, b) => a - b);
  const speed = printed.includes(setSpeed)
    ? setSpeed
    : flownSpeed({ turn: printed }, "turn_left", setSpeed);
  return capacityOf(
    speed,
    turns.includes(speed) ? "turn" : "bank",
    stressed,
    rateScale,
  );
}

/**
 * @param speed - Speed flown while turning.
 * @param kind - The dial entry at that speed.
 * @param stressed - Whether the pilot is stressed.
 * @param rateScale - Multiplier on the per-cycle rate (tuning; 1 = the template's).
 * @returns The capacity.
 */
function capacityOf(
  speed: number,
  kind: AnalogTurnKind,
  stressed: boolean,
  rateScale: number,
): SteeringCapacity {
  const dialMaxDeg =
    kind === "turn" ? ANALOG_TURN_DEGREES : ANALOG_BANK_DEGREES;
  const rate = stressed ? Math.min(dialMaxDeg, STRESSED_RATE_DEGREES) : dialMaxDeg;
  return { speed, rateDeg: rate * rateScale, dialMaxDeg, kind };
}

/**
 * A fresh cycle's steering state: nothing turned yet.
 *
 * @param baseSpeed - Speed of the cycle when the key is not held.
 * @param free - Whether the cycle is a free-steer cycle.
 * @param previous - The key state carried over from the cycle before.
 * @returns The new state.
 */
export function freshAnalogSteer(
  baseSpeed: number,
  free: boolean,
  previous?: AnalogSteer,
): AnalogSteer {
  return {
    free,
    held: previous?.held ?? "none",
    stressed: previous?.stressed ?? false,
    baseSpeed,
    rateDeg: 0,
    turnedDeg: 0,
    turnSpeed: null,
    dialMaxDeg: 0,
    turnKind: "turn",
  };
}

/** One stretch of constant input. */
export interface AnalogLeg {
  /** Speed flown (the template length is taken at it). */
  readonly speed: number;
  readonly baseSize: number;
  /** Turn rate (°/cycle); 0 flies straight. */
  readonly rateDeg: number;
  readonly side: AnalogSide;
  readonly durationMs: number;
}

/**
 * @param speed - Flown speed.
 * @param baseSize - Ship base size (px).
 * @returns The template chord length (px); speed 0 stays put.
 */
export function templateChord(speed: number, baseSize: number): number {
  return speed > 0 ? speed * SPEED_SCALE_FACTOR + baseSize : 0;
}

/**
 * Fly a pose along one leg of constant input: a straight line, or an exact
 * circular arc of the template's radius (r = L / (2·sin(max/2))) swept at the
 * key's rate. Closed form, so the result does not depend on the tick length.
 *
 * @param pose - Pose at the start of the leg.
 * @param leg - Speed, rate, side and duration.
 * @returns The pose at the end of the leg (heading normalised).
 */
export function flyAnalogLeg(
  pose: { readonly x: number; readonly y: number; readonly angle: number },
  leg: AnalogLeg,
): { x: number; y: number; angle: number } {
  const length = templateChord(leg.speed, leg.baseSize);
  const share = leg.durationMs / CYCLE_DURATION_MS;
  if (leg.side === "none" || leg.rateDeg <= 0 || share <= 0) {
    const local = rotatePoint(0, -length * share, pose.angle);
    return { x: pose.x + local.x, y: pose.y + local.y, angle: pose.angle };
  }
  const sweep = degToRad(leg.rateDeg);
  const radius = length / (2 * Math.sin(sweep / 2));
  const phi = sweep * share;
  const side = leg.side === "left" ? -1 : 1;
  const local = rotatePoint(
    side * radius * (1 - Math.cos(phi)),
    -radius * Math.sin(phi),
    pose.angle,
  );
  return {
    x: pose.x + local.x,
    y: pose.y + local.y,
    angle: normalizeAngle(pose.angle + side * leg.rateDeg * share),
  };
}
