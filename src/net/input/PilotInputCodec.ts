/**
 * PilotInputCodec — one tick of a human pilot's input as lockstep words.
 *
 * Word 0 (buttons): bits 0–3 held actions, bits 4–19 one-shot presses,
 * bit 30 INPUT_AI_CONTROL (set only by the relay for absent seats).
 * Optional word 1: turret aim (gunner mode), a 16-bit fraction of a turn.
 * Optional words 2–3: a command opcode and its argument (e.g. which reserve
 * ship to deploy). Changing this layout requires a PROTOCOL_VERSION bump.
 * Pure.
 */

import { INPUT_AI_CONTROL, type TickInput } from "../protocol";

/** Actions that matter while held (continuous steering / throttle). */
export const HELD_ACTIONS = [
  "STEER_LEFT",
  "STEER_RIGHT",
  "THRUST_UP",
  "THRUST_DOWN",
] as const;

/** Actions that fire once per press. */
export const EDGE_ACTIONS = [
  "THRUST_UP",
  "THRUST_DOWN",
  "KTURN",
  "SHARP_TURN_LEFT",
  "SHARP_TURN_RIGHT",
  "SEGNOR_LEFT",
  "SEGNOR_RIGHT",
  "TALLON_LEFT",
  "TALLON_RIGHT",
  "BOOST",
  "BARREL_ROLL",
  "FIRE_SECONDARY",
  "WEAPON_CYCLE",
  "MARK_TARGET",
  "CREW_CYCLE",
  "CLOAK",
] as const;

export type HeldAction = (typeof HELD_ACTIONS)[number];
export type EdgeAction = (typeof EDGE_ACTIONS)[number];

/** Command opcodes carried in words 2–3. */
export const PILOT_COMMANDS = {
  /** Deploy a reinforcement: arg = index in the side's offered options. */
  deployReserve: 1,
} as const;

/** A command with its argument. */
export interface PilotCommand {
  readonly op: number;
  readonly arg: number;
}

/** One tick of pilot input. */
export interface PilotInputFrame {
  readonly held: ReadonlySet<HeldAction>;
  readonly edges: ReadonlySet<EdgeAction>;
  /** Turret aim (radians), gunner mode only. */
  readonly aimRad?: number;
  readonly command?: PilotCommand;
}

/** A decoded tick input. */
export interface DecodedPilotInput extends PilotInputFrame {
  /** The relay handed this seat to the AI for this tick. */
  readonly aiControl: boolean;
}

/** First bit of the press range. */
const EDGE_SHIFT = HELD_ACTIONS.length;
/** 16-bit aim resolution. */
const AIM_STEPS = 0x10000;
const FULL_TURN = Math.PI * 2;

/** Bits of word 0 that are one-shot presses (LockstepSession's edge mask). */
export const EDGE_MASK = EDGE_ACTIONS.reduce(
  (mask, _, i) => mask | (1 << (EDGE_SHIFT + i)),
  0,
);

/**
 * @param frame - Held actions, presses, optional aim and command.
 * @returns The tick input (a single word when nothing else is set).
 */
export function encodePilotInput(frame: PilotInputFrame): TickInput {
  let buttons = 0;
  HELD_ACTIONS.forEach((action, i) => {
    if (frame.held.has(action)) buttons |= 1 << i;
  });
  EDGE_ACTIONS.forEach((action, i) => {
    if (frame.edges.has(action)) buttons |= 1 << (EDGE_SHIFT + i);
  });
  if (frame.aimRad === undefined && !frame.command) return buttons;
  const aim = frame.aimRad === undefined ? 0 : encodeAim(frame.aimRad);
  if (!frame.command) return [buttons, aim];
  return [buttons, aim, frame.command.op, frame.command.arg];
}

/**
 * @param input - A tick input (local or relayed).
 * @returns Held actions, presses, aim, command and the AI-control flag.
 */
export function decodePilotInput(input: TickInput): DecodedPilotInput {
  const words = typeof input === "number" ? [input] : input;
  const buttons = words[0] ?? 0;
  const held = new Set<HeldAction>(
    HELD_ACTIONS.filter((_, i) => buttons & (1 << i)),
  );
  const edges = new Set<EdgeAction>(
    EDGE_ACTIONS.filter((_, i) => buttons & (1 << (EDGE_SHIFT + i))),
  );
  const decoded: DecodedPilotInput = {
    held,
    edges,
    aiControl: (buttons & INPUT_AI_CONTROL) !== 0,
  };
  const aimWord = words[1];
  const op = words[2];
  return {
    ...decoded,
    ...(aimWord !== undefined && words.length >= 2
      ? { aimRad: (aimWord / AIM_STEPS) * FULL_TURN }
      : {}),
    ...(op !== undefined && op !== 0
      ? { command: { op, arg: words[3] ?? 0 } }
      : {}),
  };
}

function encodeAim(rad: number): number {
  const turns = (((rad % FULL_TURN) + FULL_TURN) % FULL_TURN) / FULL_TURN;
  return Math.round(turns * AIM_STEPS) % AIM_STEPS;
}
