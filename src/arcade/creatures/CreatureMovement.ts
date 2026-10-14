/**
 * CreatureMovement — how a creature moves. None of it is the ship dial: a
 * serpent undulates toward its prey, a drifter holds a standoff orbit on a
 * smoothed current, a hive core spins slowly while its pods orbit, a stalker
 * circles. Motion is continuous (px/s, deg/s), uses the torus-short way to
 * its goal, and is contained either by a circular arena (Survival's belt, no
 * wrap) or by wrapping across the map seam (Campaign). Mutates the body in
 * place; allocation-free. Pure.
 */

import type {
  CreatureMovementSpec,
  CreatureMovementStyle,
} from "../../data/creatures/creatureTypes";
import { torusDelta } from "../../core/Torus";
import { wrapCoordinatePx } from "../weapons/FiringGeometry";
import {
  clamp,
  DEG_TO_RAD,
  forwardX,
  forwardY,
  headingOfVector,
  seconds,
  turnToward,
} from "./creatureMath";

/** A circular arena a creature never leaves (no wrap). */
export interface ArenaCircle {
  readonly x: number;
  readonly y: number;
  readonly radiusPx: number;
}

/** Where the creature is and how it moves. */
export interface CreatureBody {
  x: number;
  y: number;
  /** Heading (deg, 0 = up, clockwise). */
  angle: number;
  vx: number;
  vy: number;
}

/** What one movement step needs. */
export interface MovementInput {
  readonly style: CreatureMovementStyle;
  readonly spec: CreatureMovementSpec;
  /** Phase and wind-up multiplier on speed. */
  readonly speedScale: number;
  readonly deltaMs: number;
  readonly nowMs: number;
  readonly worldSize: number;
  readonly arena: ArenaCircle | null;
  /** True when there is something to hunt or feed on. */
  readonly hasGoal: boolean;
  readonly goalX: number;
  readonly goalY: number;
  /** +1 / −1: which way it circles (fixed per encounter). */
  readonly orbitSign: number;
}

/** Radial correction per px of standoff error (1/s). */
const RADIAL_GAIN = 0.8;
/** How fast velocity follows its target (1/s). */
const VELOCITY_SMOOTHING = 2.2;
/** Share of the standoff inside which a serpent peels away. */
const PEEL_SHARE = 0.7;
/** Degrees a serpent peels off its prey when too close. */
const PEEL_DEG = 100;
/** Idle drift speed share with nothing to hunt. */
const IDLE_SPEED_SHARE = 0.3;
/** Share of the arena radius where the inward push starts. */
const ARENA_SOFT_EDGE = 0.8;
/** Orbit speed share of tangential motion per style. */
const TANGENT_SHARE: Readonly<Record<CreatureMovementStyle, number>> = {
  serpentine: 0,
  drift: 0.4,
  hive: 0.3,
  blink: 0.8,
  orbit_lunge: 1,
};
/** Hive cores spin instead of facing their prey. */
const SPINNING_STYLES: ReadonlySet<CreatureMovementStyle> = new Set(["hive"]);

/**
 * One movement step.
 *
 * @param body - The body (mutated).
 * @param input - Style, goal, containment and timing.
 */
export function stepBody(body: CreatureBody, input: MovementInput): void {
  solveVelocity(body, input);
  const dt = seconds(input.deltaMs);
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  contain(body, input);
}

/**
 * Moves the body without solving velocity (a lunge sets its own).
 *
 * @param body - The body (mutated).
 * @param input - Containment and timing.
 */
export function coastBody(body: CreatureBody, input: MovementInput): void {
  const dt = seconds(input.deltaMs);
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  contain(body, input);
}

function solveVelocity(body: CreatureBody, input: MovementInput): void {
  const { spec } = input;
  const speed = spec.speedPxPerS * input.speedScale;
  const dt = seconds(input.deltaMs);
  if (!input.hasGoal) {
    body.vx = forwardX(body.angle) * speed * IDLE_SPEED_SHARE;
    body.vy = forwardY(body.angle) * speed * IDLE_SPEED_SHARE;
    return;
  }
  const { dx, dy } = torusDelta(
    body.x,
    body.y,
    input.goalX,
    input.goalY,
    input.worldSize,
  );
  const distance = Math.hypot(dx, dy);
  if (input.style === "serpentine") {
    steerSerpent(body, input, headingOfVector(dx, dy), distance, speed, dt);
    return;
  }
  steerOrbit(body, input, { dx, dy, distance, speed, dt });
}

function steerSerpent(
  body: CreatureBody,
  input: MovementInput,
  heading: number,
  distance: number,
  speed: number,
  dt: number,
): void {
  const { spec } = input;
  const peel = distance < spec.standoffPx * PEEL_SHARE ? PEEL_DEG : 0;
  const wave =
    spec.amplitude * Math.sin((2 * Math.PI * input.nowMs) / spec.periodMs);
  const desired = heading + peel * input.orbitSign + wave;
  body.angle = turnToward(body.angle, desired, spec.turnDegPerS * dt);
  body.vx = forwardX(body.angle) * speed;
  body.vy = forwardY(body.angle) * speed;
}

interface OrbitFrame {
  readonly dx: number;
  readonly dy: number;
  readonly distance: number;
  readonly speed: number;
  readonly dt: number;
}

function steerOrbit(
  body: CreatureBody,
  input: MovementInput,
  frame: OrbitFrame,
): void {
  const { spec, style } = input;
  const nx = frame.distance > 0 ? frame.dx / frame.distance : 0;
  const ny = frame.distance > 0 ? frame.dy / frame.distance : 0;
  const radial = clamp(
    (frame.distance - spec.standoffPx) * RADIAL_GAIN,
    -frame.speed,
    frame.speed,
  );
  const tangent = frame.speed * TANGENT_SHARE[style] * input.orbitSign;
  const targetX = nx * radial - ny * tangent;
  const targetY = ny * radial + nx * tangent;
  const follow = Math.min(1, VELOCITY_SMOOTHING * frame.dt);
  body.vx += (targetX - body.vx) * follow;
  body.vy += (targetY - body.vy) * follow;
  body.angle = SPINNING_STYLES.has(style)
    ? (body.angle + spec.turnDegPerS * frame.dt * input.orbitSign + 360) % 360
    : turnToward(
        body.angle,
        headingOfVector(frame.dx, frame.dy),
        spec.turnDegPerS * frame.dt,
      );
}

function contain(body: CreatureBody, input: MovementInput): void {
  const { arena } = input;
  if (!arena) {
    body.x = wrapCoordinatePx(body.x, input.worldSize);
    body.y = wrapCoordinatePx(body.y, input.worldSize);
    return;
  }
  const dx = body.x - arena.x;
  const dy = body.y - arena.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= arena.radiusPx * ARENA_SOFT_EDGE) return;
  const nx = dx / distance;
  const ny = dy / distance;
  const outward = body.vx * nx + body.vy * ny;
  if (outward > 0) {
    body.vx -= nx * outward;
    body.vy -= ny * outward;
  }
  if (distance <= arena.radiusPx) return;
  body.x = arena.x + nx * arena.radiusPx;
  body.y = arena.y + ny * arena.radiusPx;
}

/**
 * @param angleDeg - A heading.
 * @param speed - Speed (px/s).
 * @param body - Body to set (mutated).
 */
export function setHeadingVelocity(
  body: CreatureBody,
  angleDeg: number,
  speed: number,
): void {
  body.vx = Math.sin(angleDeg * DEG_TO_RAD) * speed;
  body.vy = -Math.cos(angleDeg * DEG_TO_RAD) * speed;
}
