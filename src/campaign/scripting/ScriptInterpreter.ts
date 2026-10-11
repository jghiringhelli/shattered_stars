/**
 * ScriptInterpreter — runs a mission's declarative beats. Each step reads
 * the mission time, objective statuses, ships destroyed since the last step
 * and ship positions, and returns the actions that fire now. Flags set by
 * actions apply immediately, so flag triggers chain within one step
 * (bounded). Story flags (persist: true) are collected for the save. Pure.
 */

import { withinRange } from "../../arcade/objectives/objectiveGeometry";
import type { ObjectiveSide, ObjectiveStatus } from "../../arcade/objectives";
import type {
  FlagCondition,
  ScriptAction,
  ScriptBeat,
  ScriptTrigger,
} from "./scriptTypes";

/** Milliseconds per second. */
const MS_PER_SECOND = 1000;
/** Most flag-chain passes per step (guards against flag loops). */
export const MAX_CHAIN_PASSES = 8;

/** An objective as triggers see it. */
export interface ScriptObjectiveView {
  readonly id: string;
  readonly status: ObjectiveStatus;
  readonly hidden: boolean;
}

/** A destruction since the last step. */
export interface ScriptDestroyed {
  readonly shipId: string;
  readonly side: ObjectiveSide;
  readonly tags: readonly string[];
}

/** A living ship's position. */
export interface ScriptShip {
  readonly x: number;
  readonly y: number;
  readonly side: ObjectiveSide;
  readonly tags: readonly string[];
}

/** One step's view of the battle. */
export interface ScriptInput {
  readonly elapsedMs: number;
  readonly objectives: readonly ScriptObjectiveView[];
  readonly destroyed: readonly ScriptDestroyed[];
  readonly ships: readonly ScriptShip[];
  readonly worldSize: number;
}

/** Interpreter state. */
export interface ScriptState {
  readonly beats: readonly ScriptBeat[];
  readonly fired: readonly string[];
  readonly pending: readonly {
    readonly beatId: string;
    readonly dueMs: number;
  }[];
  readonly destroyedCounts: Readonly<Record<string, number>>;
  /** Beats whose trigger matched last step (repeat edge detection). */
  readonly matched: readonly string[];
  /** Every flag: the save's story flags plus mission flags. */
  readonly flags: Readonly<Record<string, boolean>>;
  /** Flags to persist into the save on victory. */
  readonly storyFlags: Readonly<Record<string, boolean>>;
  readonly started: boolean;
}

/** One step's result. */
export interface ScriptStepResult {
  readonly state: ScriptState;
  readonly actions: ScriptAction[];
}

/**
 * @param beats - The mission's beats.
 * @param storyFlags - Flags already in the campaign save.
 * @returns A fresh interpreter state.
 */
export function createScriptState(
  beats: readonly ScriptBeat[],
  storyFlags: Readonly<Record<string, boolean>>,
): ScriptState {
  return {
    beats,
    fired: [],
    pending: [],
    destroyedCounts: {},
    matched: [],
    flags: { ...storyFlags },
    storyFlags: {},
    started: false,
  };
}

/**
 * @param conditions - Flag conditions.
 * @param flags - Current flags.
 * @returns Whether every condition holds.
 */
export function conditionsHold(
  conditions: readonly FlagCondition[] | undefined,
  flags: Readonly<Record<string, boolean>>,
): boolean {
  return (conditions ?? []).every(
    (c) => (flags[c.flag] ?? false) === (c.is ?? true),
  );
}

/**
 * @param trigger - A destroyed trigger.
 * @param input - The step.
 * @returns Matching destructions this step.
 */
function destroyedMatches(
  trigger: Extract<ScriptTrigger, { on: "destroyed" }>,
  input: ScriptInput,
): number {
  return input.destroyed.filter(
    (d) =>
      (trigger.side === undefined || d.side === trigger.side) &&
      (trigger.tag === undefined || d.tags.includes(trigger.tag)),
  ).length;
}

/**
 * @param trigger - A trigger (not "destroyed").
 * @param input - The step.
 * @param state - Interpreter state.
 * @returns Whether it matches now.
 */
function triggerMatches(
  trigger: ScriptTrigger,
  input: ScriptInput,
  state: ScriptState,
): boolean {
  switch (trigger.on) {
    case "start":
      return !state.started;
    case "time":
      return input.elapsedMs >= trigger.atSeconds * MS_PER_SECOND;
    case "flag":
      return (state.flags[trigger.flag] ?? false) === (trigger.value ?? true);
    case "area":
      return input.ships.some(
        (ship) =>
          ship.side === (trigger.side ?? "player") &&
          (trigger.tag === undefined || ship.tags.includes(trigger.tag)) &&
          withinRange(ship, trigger.at, trigger.radius, input.worldSize),
      );
    case "objective":
      return input.objectives.some(
        (o) =>
          o.id === trigger.objectiveId &&
          (trigger.status === "revealed"
            ? !o.hidden
            : o.status === trigger.status),
      );
    case "destroyed":
      return false;
  }
}

/**
 * Evaluates every beat once against the step (one chain pass).
 *
 * @param state - Interpreter state.
 * @param input - The step.
 * @returns New state and the beats due now.
 */
function evaluate(
  state: ScriptState,
  input: ScriptInput,
): { state: ScriptState; due: ScriptBeat[] } {
  const due: ScriptBeat[] = [];
  const fired = [...state.fired];
  const pending = [...state.pending];
  const counts = { ...state.destroyedCounts };
  const matched: string[] = [];
  for (const beat of state.beats) {
    if (!beat.repeat && fired.includes(beat.id)) continue;
    let hit: boolean;
    if (beat.when.on === "destroyed") {
      counts[beat.id] =
        (counts[beat.id] ?? 0) + destroyedMatches(beat.when, input);
      hit = (counts[beat.id] ?? 0) >= (beat.when.count ?? 1);
      if (hit) counts[beat.id] = 0;
    } else {
      const now = triggerMatches(beat.when, input, state);
      if (now) matched.push(beat.id);
      hit = now && (!beat.repeat || !state.matched.includes(beat.id));
    }
    if (!hit || !conditionsHold(beat.if, state.flags)) continue;
    fired.push(beat.id);
    if (beat.delaySeconds) {
      pending.push({
        beatId: beat.id,
        dueMs: input.elapsedMs + beat.delaySeconds * MS_PER_SECOND,
      });
    } else due.push(beat);
  }
  return {
    state: { ...state, fired, pending, destroyedCounts: counts, matched },
    due,
  };
}

/**
 * Applies flag actions to the state.
 *
 * @param state - Interpreter state.
 * @param actions - Actions that fired.
 * @returns State with flags updated.
 */
function applyFlags(
  state: ScriptState,
  actions: readonly ScriptAction[],
): ScriptState {
  const flags = { ...state.flags };
  const storyFlags = { ...state.storyFlags };
  for (const action of actions) {
    if (action.do !== "setFlag") continue;
    flags[action.flag] = action.value ?? true;
    if (action.persist) storyFlags[action.flag] = action.value ?? true;
  }
  return { ...state, flags, storyFlags };
}

/**
 * @param state - Interpreter state.
 * @param elapsedMs - Mission time.
 * @returns State without the delayed beats now due, and those beats.
 */
function takeDue(
  state: ScriptState,
  elapsedMs: number,
): { state: ScriptState; due: ScriptBeat[] } {
  const ready = state.pending.filter((p) => p.dueMs <= elapsedMs);
  if (ready.length === 0) return { state, due: [] };
  const due = ready
    .map((p) => state.beats.find((b) => b.id === p.beatId))
    .filter((b): b is ScriptBeat => b !== undefined);
  return {
    state: {
      ...state,
      pending: state.pending.filter((p) => p.dueMs > elapsedMs),
    },
    due,
  };
}

/**
 * Runs one step of the mission script.
 *
 * @param state - Interpreter state.
 * @param input - This step's view of the battle.
 * @returns New state and the actions to perform, in order.
 */
export function stepScript(
  state: ScriptState,
  input: ScriptInput,
): ScriptStepResult {
  const actions: ScriptAction[] = [];
  let current = state;
  const delayed = takeDue(current, input.elapsedMs);
  current = delayed.state;
  let due = delayed.due;
  for (let pass = 0; pass < MAX_CHAIN_PASSES; pass++) {
    const evaluated = evaluate(
      current,
      pass === 0 ? input : { ...input, destroyed: [] },
    );
    const batch = [...due, ...evaluated.due].flatMap((beat) => beat.actions);
    current = { ...applyFlags(evaluated.state, batch), started: true };
    actions.push(...batch);
    due = [];
    if (!batch.some((a) => a.do === "setFlag")) break;
  }
  return { state: current, actions };
}
