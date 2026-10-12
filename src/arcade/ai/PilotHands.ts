/**
 * PilotHands — a bot's hands on the keyboard. Turns a {@link PilotIntent}
 * into the exact key frames a human produces (arrow taps and holds, Q/E,
 * K-turn/Segnor/Tallon keys, boost key, ↑/↓ throttle taps, the left+right
 * barrel-roll chord) and feeds them through the shared PilotFlightControls.
 *
 * The bot gets no shortcut a human lacks: a bank needs the arrow held long
 * enough before the boundary, a second bank needs a re-press, a throttle tap
 * steps one notch, a roll needs the chord. Pure: no Phaser.
 */

import { canBarrelRoll, canKTurn } from "../../core/ArcadeControls";
import type { ManeuverDirection } from "../../core/types";
import { DOUBLE_TAP_WINDOW_MS } from "../ArcadeInputGestures";
import {
  applyPilotFlightInput,
  INITIAL_PILOT_CONTROL,
  onPilotCycleCommitted,
  type FlightControlResult,
  type FlightEdge,
  type FlownShip,
  type PilotControlState,
} from "../systems/PilotFlightControls";
import {
  IDLE_INTENT,
  type PilotIntent,
  type SpecialManeuver,
} from "./BotTypes";

/** Gap between two throttle taps, so two taps never read as a ↑↑/↓↓ gesture (ms). */
export const THROTTLE_TAP_GAP_MS = DOUBLE_TAP_WINDOW_MS + 20;

/** Keys a special maneuver is queued with. */
const SPECIAL_EDGE: Readonly<Record<SpecialManeuver, FlightEdge>> = {
  kturn: "KTURN",
  segnor_left: "SEGNOR_LEFT",
  segnor_right: "SEGNOR_RIGHT",
  tallon_left: "TALLON_LEFT",
  tallon_right: "TALLON_RIGHT",
};

/** Arrow keys held this frame. */
interface Keys {
  readonly left: boolean;
  readonly right: boolean;
}

const NO_KEYS: Keys = { left: false, right: false };

/** Barrel-roll chord, frame by frame: release, first key, both, release. */
const ROLL_CHORD_FRAMES = 4;

/** One frame of a ship under the hands' control. */
export interface HandsFrame {
  readonly flown: FlownShip;
  readonly nowMs: number;
  readonly deltaMs: number;
  readonly worldSize: number;
}

export class PilotHands {
  private memory: PilotControlState = INITIAL_PILOT_CONTROL;
  private intent: PilotIntent = IDLE_INTENT;
  private keys: Keys = NO_KEYS;
  private pendingSpecial: SpecialManeuver | null = null;
  private pendingBoost = false;
  private pendingRoll: "left" | "right" | null = null;
  private rollFrame = -1;
  private lastThrottleTapMs = Number.NEGATIVE_INFINITY;
  private sharpTurnSent = false;
  /**
   * The cycle committed since the last decision: the intent was judged from
   * where the old maneuver ended — where the new one starts — so its sharp
   * turn (a one-shot key) waits for the pilot's next decision.
   */
  private steeringStale = false;

  /**
   * Take a new decision: steering/throttle persist, one-shots arm once.
   * @param intent - The pilot's latest intent.
   */
  setIntent(intent: PilotIntent): void {
    this.intent = intent;
    this.steeringStale = false;
    if (intent.special) this.pendingSpecial = intent.special;
    if (intent.boost) this.pendingBoost = true;
    if (intent.barrelRoll && this.rollFrame < 0)
      this.pendingRoll = intent.barrelRoll;
  }

  /** @returns The intent being carried out. */
  currentIntent(): PilotIntent {
    return this.intent;
  }

  /**
   * Press this frame's keys and run them through the pilot flight controls.
   * @param frame - The ship, timing and world size.
   * @returns New motion, stress and the flight events.
   */
  fly(frame: HandsFrame): FlightControlResult {
    const edges = new Set<FlightEdge>();
    const control = frame.flown.motion.control;
    let up = false;
    let down = false;
    if (this.rollFrame >= 0 || (this.pendingRoll && canBarrelRoll(control))) {
      this.keys = this.rollChord();
    } else {
      this.pressSpecials(edges, canKTurn(control));
      const throttle = this.throttleTap(control.speed, frame.nowMs);
      if (throttle === "up") edges.add("THRUST_UP");
      if (throttle === "down") edges.add("THRUST_DOWN");
      up = throttle === "up";
      down = throttle === "down";
      this.keys = this.steerKeys(control.nextManeuver, edges);
    }
    const result = applyPilotFlightInput(
      this.memory,
      frame.flown,
      {
        ...this.keys,
        up,
        down,
        edges,
        nowMs: frame.nowMs,
        deltaMs: frame.deltaMs,
        allowChordBarrelRoll: true,
      },
      frame.worldSize,
    );
    this.memory = result.pilot;
    return result;
  }

  /**
   * Tell the hands a cycle committed on their ship.
   * @param started - The maneuver the new cycle started.
   */
  onCycleCommitted(started: ManeuverDirection): void {
    this.memory = onPilotCycleCommitted(this.memory, started);
    this.sharpTurnSent = false;
    this.steeringStale = true;
  }

  /**
   * Special keys and the boost key, each pressed once per arming.
   * @param edges - This frame's edges (mutated).
   * @param specialReady - Whether a special can be queued now.
   */
  private pressSpecials(edges: Set<FlightEdge>, specialReady: boolean): void {
    if (this.pendingSpecial && specialReady) {
      edges.add(SPECIAL_EDGE[this.pendingSpecial]);
    }
    this.pendingSpecial = null;
    if (this.pendingBoost) edges.add("BOOST");
    this.pendingBoost = false;
  }

  /**
   * One throttle tap toward the wanted speed, spaced so taps never chord.
   * @param speed - Current throttle.
   * @param nowMs - Arena time (ms).
   * @returns Which throttle key to tap this frame, if any.
   */
  private throttleTap(speed: number, nowMs: number): "up" | "down" | null {
    const wanted = this.intent.targetSpeed;
    if (wanted === null || wanted === speed) return null;
    if (nowMs - this.lastThrottleTapMs < THROTTLE_TAP_GAP_MS) return null;
    this.lastThrottleTapMs = nowMs;
    return wanted > speed ? "up" : "down";
  }

  /**
   * The barrel-roll chord: release, hold the first key, add the second
   * (the roll fires), release both.
   * @returns Arrow keys for this frame of the chord.
   */
  private rollChord(): Keys {
    if (this.rollFrame < 0) this.rollFrame = 0;
    const frame = this.rollFrame;
    const side = this.pendingRoll ?? "left";
    this.rollFrame = frame + 1 >= ROLL_CHORD_FRAMES ? -1 : frame + 1;
    if (this.rollFrame < 0) this.pendingRoll = null;
    if (frame === 1)
      return side === "left"
        ? { left: true, right: false }
        : { left: false, right: true };
    if (frame === 2) return { left: true, right: true };
    return NO_KEYS;
  }

  /**
   * Arrow keys (and Q/E) for the wanted maneuver.
   * @param queued - Maneuver currently queued on the ship.
   * @param edges - This frame's edges (mutated for Q/E).
   * @returns Arrow keys held this frame.
   */
  private steerKeys(
    queued: ManeuverDirection | null,
    edges: Set<FlightEdge>,
  ): Keys {
    const wanted = this.intent.maneuver;
    if (wanted === "straight") return NO_KEYS;
    const side = wanted.endsWith("left") ? "left" : "right";
    if (wanted.startsWith("turn")) {
      // One edge per cycle: a stale turn would use it up and block the fix.
      if (queued !== wanted && !this.sharpTurnSent && !this.steeringStale) {
        edges.add(side === "left" ? "SHARP_TURN_LEFT" : "SHARP_TURN_RIGHT");
        this.sharpTurnSent = true;
      }
      return NO_KEYS;
    }
    return wanted.startsWith("bank")
      ? this.bankKeys(side)
      : this.driftKeys(side);
  }

  /**
   * A bank: a fresh hold of the arrow (re-press after a bank already flown).
   * @param side - Bank side.
   * @returns Arrow keys held this frame.
   */
  private bankKeys(side: "left" | "right"): Keys {
    const steering = this.memory.steering;
    if (steering.side === side && steering.banksFlown > 0) return NO_KEYS;
    return side === "left"
      ? { left: true, right: false }
      : { left: false, right: true };
  }

  /**
   * A drift: keep holding after a bank, otherwise tap (press one frame,
   * release) until a drift is owed for the coming boundary.
   * @param side - Drift side.
   * @returns Arrow keys held this frame.
   */
  private driftKeys(side: "left" | "right"): Keys {
    const steering = this.memory.steering;
    if (steering.side === side && steering.banksFlown > 0) return this.keys;
    if (steering.tap === side || this.keys[side]) return NO_KEYS;
    return side === "left"
      ? { left: true, right: false }
      : { left: false, right: true };
  }
}
