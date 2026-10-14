/**
 * FlightSchoolSteps — the Flight School lesson plan as a pure step machine.
 *
 * Each frame the scene hands in a {@link FlightSchoolObservation} read from
 * the player's REAL flight state (the shared cycle engine) and the battle;
 * a lesson completes only when that state shows the taught input took
 * effect — a throttle notch, a maneuver queued or flown, a dash cooldown
 * started, a hit landed, a mark placed. Prompts are built from a key-label
 * function so they always name the player's active bindings.
 *
 * Pure: no Phaser.
 */

import type { ActionIntent } from "../input/InputTypes";
import type { ManeuverDirection } from "../core/types";

/** What the scene sets up for a lesson. */
export type FlightSchoolScenario = "open_space" | "drone" | "beacon" | "bot";

/** Labels a bound key, e.g. "MARK_TARGET" → "R". */
export type KeyLabeler = (intent: ActionIntent) => string;

/** The player's state as observed this frame. */
export interface FlightSchoolObservation {
  readonly nowMs: number;
  readonly speed: number;
  readonly minSpeed: number;
  readonly maxSpeed: number;
  readonly currentManeuver: ManeuverDirection | null;
  readonly nextManeuver: ManeuverDirection | null;
  readonly boostCooldownMs: number;
  readonly barrelRollCooldownMs: number;
  /** Edge intents pressed since the last observation. */
  readonly pressed: ReadonlySet<ActionIntent>;
  /** Primary hits landed on training targets (running total). */
  readonly primaryHits: number;
  /** Secondary-weapon hits landed by the trainee (running total). */
  readonly secondaryHits: number;
  readonly markedTargetId: string | null;
  readonly beaconOnScreen: boolean;
  readonly enemiesAlive: number;
}

/** Per-lesson memory: first and previous observation, speed extremes. */
export interface StepMemo {
  readonly first: FlightSchoolObservation;
  readonly previous: FlightSchoolObservation | null;
  readonly lowSpeed: number;
  readonly highSpeed: number;
  readonly sawEnemy: boolean;
}

/** One lesson. */
export interface FlightSchoolStep {
  readonly id: string;
  readonly title: string;
  readonly scenario: FlightSchoolScenario;
  /** Instruction text naming the bound keys in [brackets]. */
  readonly prompt: (keys: KeyLabeler) => string;
  /** Whether this observation proves the lesson was performed. */
  readonly isDone: (obs: FlightSchoolObservation, memo: StepMemo) => boolean;
}

/** Throttle notches a throttle lesson asks for. */
const THROTTLE_NOTCHES = 2;
/** Primary hits the gunnery lesson asks for. */
export const PRIMARY_HITS_REQUIRED = 3;

const flying =
  (...maneuvers: readonly ManeuverDirection[]) =>
  (obs: FlightSchoolObservation): boolean =>
    maneuvers.includes(obs.currentManeuver as ManeuverDirection) ||
    maneuvers.includes(obs.nextManeuver as ManeuverDirection);

const cooldownStarted =
  (field: "boostCooldownMs" | "barrelRollCooldownMs") =>
  (obs: FlightSchoolObservation, memo: StepMemo): boolean =>
    memo.previous !== null && obs[field] > memo.previous[field];

const either = (keys: KeyLabeler, a: ActionIntent, b: ActionIntent): string =>
  `[${keys(a)}] or [${keys(b)}]`;

/** The lesson plan, in order. */
export const FLIGHT_SCHOOL_STEPS: readonly FlightSchoolStep[] = [
  {
    id: "throttle_up",
    title: "Throttle up",
    scenario: "open_space",
    prompt: (k) =>
      `Tap [${k("THRUST_UP")}] two times, slowly — one speed notch per tap. Speed sets how far you fly every 500 ms cycle. (A quick double-tap is a BOOST.)`,
    isDone: (obs, memo) =>
      obs.speed >= Math.min(memo.lowSpeed + THROTTLE_NOTCHES, obs.maxSpeed),
  },
  {
    id: "throttle_down",
    title: "Throttle down",
    scenario: "open_space",
    prompt: (k) =>
      `Tap [${k("THRUST_DOWN")}] two times, slowly, to bleed off speed. (A quick double-tap is a SNAP TURN.)`,
    isDone: (obs, memo) =>
      obs.speed <= Math.max(memo.highSpeed - THROTTLE_NOTCHES, obs.minSpeed),
  },
  {
    id: "drift",
    title: "Drift — the 500 ms cycle",
    scenario: "open_space",
    prompt: (k) =>
      `Tap ${either(k, "STEER_LEFT", "STEER_RIGHT")} once. Inputs QUEUE the next maneuver: it starts on the next 500 ms beat, so steer a moment early.`,
    isDone: flying("drift_left", "drift_right"),
  },
  {
    id: "bank",
    title: "Bank",
    scenario: "open_space",
    prompt: (k) =>
      `Hold ${either(k, "STEER_LEFT", "STEER_RIGHT")} for a 45° bank on the next beat.`,
    isDone: flying("bank_left", "bank_right"),
  },
  {
    id: "hard_turn",
    title: "Hard turn",
    scenario: "open_space",
    prompt: (k) =>
      `Press ${either(k, "SHARP_TURN_LEFT", "SHARP_TURN_RIGHT")} for a 90° hard turn.`,
    isDone: flying("turn_left", "turn_right"),
  },
  {
    id: "kturn",
    title: "Snap turn",
    scenario: "open_space",
    prompt: (k) =>
      `TAP the maneuver key [${k("MANEUVER")}] (or double-tap [${k("THRUST_DOWN")}]) to flip 180°. Red maneuvers build stress — watch the bottom of your ring.`,
    isDone: flying("kturn"),
  },
  {
    id: "segnor",
    title: "Hook loop",
    scenario: "open_space",
    prompt: (k) =>
      `HOLD the maneuver key [${k("MANEUVER")}] and press ${either(k, "STEER_LEFT", "STEER_RIGHT")} for a Hook loop: a reversing bank.`,
    isDone: flying("segnor_left", "segnor_right"),
  },
  {
    id: "tallon",
    title: "Knife roll",
    scenario: "open_space",
    prompt: (k) =>
      `Double-tap the maneuver key [${k("MANEUVER")}], keep the second press down and add ${either(k, "STEER_LEFT", "STEER_RIGHT")} for a Knife roll: a 90° turn that ends facing sideways.`,
    isDone: flying("tallon_left", "tallon_right"),
  },
  {
    id: "boost",
    title: "Boost",
    scenario: "open_space",
    prompt: (k) => `Double-tap [${k("THRUST_UP")}] quickly to BOOST forward.`,
    isDone: cooldownStarted("boostCooldownMs"),
  },
  {
    id: "barrel_roll",
    title: "Barrel roll",
    scenario: "open_space",
    prompt: (k) =>
      `Double-tap [${k("STEER_LEFT")}] or [${k("STEER_RIGHT")}] — two quick taps of the SAME arrow — to BARREL ROLL that way. (Alternating the arrows is just steering.)`,
    isDone: cooldownStarted("barrelRollCooldownMs"),
  },
  {
    id: "primary_fire",
    title: "Primary weapon & firing arc",
    scenario: "drone",
    prompt: (k) =>
      `Your guns fire by themselves at anything inside your forward arc and in range — once per cycle. Steer with ${either(k, "STEER_LEFT", "STEER_RIGHT")} to keep the drone ahead. Land ${PRIMARY_HITS_REQUIRED} hits.`,
    isDone: (obs, memo) =>
      obs.primaryHits - memo.first.primaryHits >= PRIMARY_HITS_REQUIRED,
  },
  {
    id: "secondary",
    title: "Secondary ordnance",
    scenario: "drone",
    prompt: (k) =>
      `Missiles need a LOCK: keep the drone within range for one cycle until the ring on your missile slot turns green, with it ahead of your nose, then press [${k("FIRE_SECONDARY")}]. [${k("WEAPON_CYCLE")}] switches secondary weapons.`,
    isDone: (obs, memo) => obs.secondaryHits > memo.first.secondaryHits,
  },
  {
    id: "mark",
    title: "Mark a target",
    scenario: "drone",
    prompt: (k) =>
      `Press [${k("MARK_TARGET")}] to MARK the drone: wingmen focus a marked ship and squad shots on it hit harder. Marked ships wear brackets.`,
    isDone: (obs) => obs.markedTargetId !== null,
  },
  {
    id: "radar",
    title: "Radar & edge arrows",
    scenario: "beacon",
    prompt: (k) =>
      `A beacon is behind you. Off-screen ships show as ARROWS on the screen edge and blips on the radar (ringed blips are friendly). Steer ${either(k, "STEER_LEFT", "STEER_RIGHT")} until the beacon is on screen.`,
    isDone: (obs) => obs.beaconOnScreen,
  },
  {
    id: "status_ring",
    title: "Status ring",
    scenario: "open_space",
    prompt: (k) =>
      `The ring around your ship: SHIELDS left arc, HULL right arc (blinks when critical), STRESS bottom, SPEED top. Press [${k("CONFIRM")}] to continue.`,
    isDone: (obs) => obs.pressed.has("CONFIRM"),
  },
  {
    id: "final_fight",
    title: "Final exam",
    scenario: "bot",
    prompt: (k) =>
      `Destroy the novice pilot. Mark it [${k("MARK_TARGET")}], keep it in your arc, and tap [${k("MANEUVER")}] to Snap turn if it gets behind you.`,
    isDone: (obs, memo) => memo.sawEnemy && obs.enemiesAlive === 0,
  },
];

/** Machine state. */
export interface FlightSchoolState {
  readonly index: number;
  readonly memo: StepMemo | null;
  readonly completed: boolean;
  readonly stepStartedAtMs: number;
  /** The previous observation (any lesson), for edge detection. */
  readonly lastObservation: FlightSchoolObservation | null;
}

/** What one observation did. */
export type FlightSchoolEvent = "none" | "step_complete" | "course_complete";

/**
 * @param nowMs - Scene time.
 * @returns The machine on the first lesson.
 */
export function startFlightSchool(nowMs: number): FlightSchoolState {
  return {
    index: 0,
    memo: null,
    completed: false,
    stepStartedAtMs: nowMs,
    lastObservation: null,
  };
}

/**
 * @param state - Machine state.
 * @returns The current lesson, or null once the course is complete.
 */
export function currentStep(state: FlightSchoolState): FlightSchoolStep | null {
  return state.completed ? null : (FLIGHT_SCHOOL_STEPS[state.index] ?? null);
}

function nextState(
  state: FlightSchoolState,
  nowMs: number,
  lastObservation: FlightSchoolObservation | null,
): FlightSchoolState {
  const index = state.index + 1;
  return {
    index,
    memo: null,
    completed: index >= FLIGHT_SCHOOL_STEPS.length,
    stepStartedAtMs: nowMs,
    lastObservation,
  };
}

function remember(
  state: FlightSchoolState,
  obs: FlightSchoolObservation,
): StepMemo {
  const memo = state.memo;
  return {
    first: memo?.first ?? obs,
    previous: state.lastObservation,
    lowSpeed: Math.min(memo?.lowSpeed ?? obs.speed, obs.speed),
    highSpeed: Math.max(memo?.highSpeed ?? obs.speed, obs.speed),
    sawEnemy: (memo?.sawEnemy ?? false) || obs.enemiesAlive > 0,
  };
}

/**
 * Feed one frame's observation.
 *
 * @param state - Machine state.
 * @param obs - The player's observed state.
 * @returns New state and whether a lesson (or the course) just completed.
 */
export function advanceFlightSchool(
  state: FlightSchoolState,
  obs: FlightSchoolObservation,
): { readonly state: FlightSchoolState; readonly event: FlightSchoolEvent } {
  const step = currentStep(state);
  if (!step) return { state, event: "none" };
  const memo = remember(state, obs);
  if (!step.isDone(obs, memo)) {
    return { state: { ...state, memo, lastObservation: obs }, event: "none" };
  }
  const next = nextState(state, obs.nowMs, obs);
  return {
    state: next,
    event: next.completed ? "course_complete" : "step_complete",
  };
}

/**
 * Skip the current lesson (the player is stuck or already knows it).
 *
 * @param state - Machine state.
 * @param nowMs - Scene time.
 * @returns State on the next lesson.
 */
export function skipFlightSchoolStep(
  state: FlightSchoolState,
  nowMs: number,
): FlightSchoolState {
  return state.completed
    ? state
    : nextState(state, nowMs, state.lastObservation);
}
