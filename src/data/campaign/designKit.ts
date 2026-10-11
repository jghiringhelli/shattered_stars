/**
 * designKit — terse builders for authoring campaign mission designs:
 * objectives (offsets from the battlefield centre), script beats and
 * actions, hazards and bonus objectives. Pure data constructors.
 */

import type {
  ObjectiveDefinition,
  ObjectivePoint,
  ObjectiveSide,
  ObjectiveStatus,
} from "../../arcade/objectives";
import type {
  DialogueMood,
  FlagCondition,
  MusicCue,
  ScriptAction,
  ScriptBeat,
  ScriptSpawnGroup,
  ScriptTrigger,
} from "../../campaign/scripting/scriptTypes";
import type { HazardDefinition } from "../../campaign/hazards/hazardTypes";

/** A comms speaker. */
export interface Speaker {
  readonly name: string;
  readonly portraitKey: string;
}

/** Research points a typical bonus objective grants. */
export const BONUS_RESEARCH = 1;
/** Credits a typical bonus objective grants. */
export const BONUS_CREDITS = 50;

let beatSequence = 0;

/**
 * @param when - Trigger.
 * @param actions - Actions.
 * @param extra - Conditions, delay, repeat.
 * @returns A beat with a unique id.
 */
export function beat(
  when: ScriptTrigger,
  actions: readonly ScriptAction[],
  extra: {
    if?: readonly FlagCondition[];
    delaySeconds?: number;
    repeat?: boolean;
  } = {},
): ScriptBeat {
  beatSequence += 1;
  return { id: `beat_${beatSequence}`, when, actions, ...extra };
}

// ── Triggers ────────────────────────────────────────────────────────────────
export const onStart = (...actions: ScriptAction[]): ScriptBeat =>
  beat({ on: "start" }, actions);
export const atTime = (
  atSeconds: number,
  ...actions: ScriptAction[]
): ScriptBeat => beat({ on: "time", atSeconds }, actions);
export const onObjective = (
  objectiveId: string,
  status: ObjectiveStatus | "revealed",
  ...actions: ScriptAction[]
): ScriptBeat => beat({ on: "objective", objectiveId, status }, actions);
export const onDestroyed = (
  tag: string,
  count: number,
  side: ObjectiveSide,
  ...actions: ScriptAction[]
): ScriptBeat => beat({ on: "destroyed", tag, count, side }, actions);
export const onArea = (
  x: number,
  y: number,
  radius: number,
  ...actions: ScriptAction[]
): ScriptBeat => beat({ on: "area", at: { x, y }, radius }, actions);
export const onFlag = (flag: string, ...actions: ScriptAction[]): ScriptBeat =>
  beat({ on: "flag", flag }, actions);

// ── Actions ─────────────────────────────────────────────────────────────────
export const say = (
  speaker: Speaker,
  text: string,
  mood?: DialogueMood,
): ScriptAction => ({
  do: "say",
  speaker: speaker.name,
  portraitKey: speaker.portraitKey,
  text,
  ...(mood ? { mood } : {}),
});
export const wave = (
  shipId: string,
  count: number,
  faction: string,
  options: Omit<ScriptSpawnGroup, "shipId" | "count" | "side" | "faction"> = {},
): ScriptAction => ({
  do: "spawn",
  group: { shipId, count, side: "enemy", faction, at: "flank", ...options },
});
export const reinforce = (
  shipId: string,
  count: number,
  tag: string,
  at: ScriptSpawnGroup["at"] = "behind",
): ScriptAction => ({
  do: "spawn",
  group: { shipId, count, side: "ally", tag, at },
});
export const banner = (title: string, subtitle: string): ScriptAction => ({
  do: "banner",
  title,
  subtitle,
});
export const setFlag = (flag: string, persist = false): ScriptAction => ({
  do: "setFlag",
  flag,
  ...(persist ? { persist: true } : {}),
});
export const reveal = (objectiveId: string): ScriptAction => ({
  do: "revealObjective",
  objectiveId,
});
export const complete = (objectiveId: string): ScriptAction => ({
  do: "completeObjective",
  objectiveId,
});
export const failObjective = (objectiveId: string): ScriptAction => ({
  do: "failObjective",
  objectiveId,
});
export const hazardOn = (hazardId: string): ScriptAction => ({
  do: "hazard",
  hazardId,
  active: true,
});
export const hazardOff = (hazardId: string): ScriptAction => ({
  do: "hazard",
  hazardId,
  active: false,
});
export const music = (cue: MusicCue): ScriptAction => ({ do: "music", cue });
export const addObjective = (objective: ObjectiveDefinition): ScriptAction => ({
  do: "addObjective",
  objective,
});

// ── Objectives (offsets from the battlefield centre) ───────────────────────
const p = (x: number, y: number): ObjectivePoint => ({ x, y });
const pts = (list: readonly (readonly [number, number])[]): ObjectivePoint[] =>
  list.map(([x, y]) => p(x, y));

export const kill = (
  id: string,
  description: string,
  count: number,
  tag?: string,
): ObjectiveDefinition => ({
  id,
  type: "eliminate",
  description,
  count,
  ...(tag ? { tag } : {}),
});
export const survive = (
  id: string,
  description: string,
  seconds: number,
): ObjectiveDefinition => ({
  id,
  type: "survive",
  description,
  timeLimit: seconds,
});
export const escort = (
  id: string,
  description: string,
  o: {
    path: readonly (readonly [number, number])[];
    shipId: string;
    count: number;
    maxLosses: number;
    speed?: number;
  },
): ObjectiveDefinition => ({
  id,
  type: "escort",
  description,
  path: pts(o.path),
  speed: o.speed ?? 60,
  transports: { shipId: o.shipId, count: o.count },
  maxLosses: o.maxLosses,
});
export const defend = (
  id: string,
  description: string,
  o: {
    at: readonly [number, number];
    shipId: string;
    seconds?: number;
    hullScale?: number;
  },
): ObjectiveDefinition => ({
  id,
  type: "defend",
  description,
  at: p(...o.at),
  stationShipId: o.shipId,
  ...(o.seconds !== undefined ? { timeLimit: o.seconds } : {}),
  ...(o.hullScale !== undefined ? { hullScale: o.hullScale } : {}),
});
export const hold = (
  id: string,
  description: string,
  o: {
    at: readonly [number, number];
    radius?: number;
    seconds: number;
    enemyHoldFails?: boolean;
  },
): ObjectiveDefinition => ({
  id,
  type: "capture",
  description,
  at: p(...o.at),
  radius: o.radius ?? 260,
  holdSeconds: o.seconds,
  ...(o.enemyHoldFails ? { enemyHoldFails: true } : {}),
});
export const hit = (
  id: string,
  description: string,
  o: {
    shipId: string;
    at: readonly [number, number];
    flee?: readonly (readonly [number, number])[];
    fleeAtHull?: number;
    fleeAfter?: number;
    boss?: boolean;
    hullScale?: number;
  },
): ObjectiveDefinition => ({
  id,
  type: "assassinate",
  description,
  targetShipId: o.shipId,
  at: p(...o.at),
  ...(o.flee ? { fleePath: pts(o.flee) } : {}),
  ...(o.fleeAtHull !== undefined ? { fleeAtHullFraction: o.fleeAtHull } : {}),
  ...(o.fleeAfter !== undefined ? { fleeAfterSeconds: o.fleeAfter } : {}),
  ...(o.boss ? { isBoss: true } : {}),
  ...(o.hullScale !== undefined ? { hullScale: o.hullScale } : {}),
});
export const route = (
  id: string,
  description: string,
  points: readonly (readonly [number, number])[],
  o: { radius?: number; extraction?: boolean; seconds?: number } = {},
): ObjectiveDefinition => ({
  id,
  type: "waypoints",
  description,
  points: pts(points),
  radius: o.radius ?? 160,
  ...(o.extraction ? { extraction: true } : {}),
  ...(o.seconds !== undefined ? { timeLimit: o.seconds } : {}),
});
export const sabotage = (
  id: string,
  description: string,
  o: {
    at: readonly [number, number];
    radius?: number;
    seconds: number;
    decay?: number;
  },
): ObjectiveDefinition => ({
  id,
  type: "sabotage",
  description,
  at: p(...o.at),
  radius: o.radius ?? 180,
  holdSeconds: o.seconds,
  ...(o.decay !== undefined ? { decayPerSecond: o.decay } : {}),
});
export const salvage = (
  id: string,
  description: string,
  o: {
    crates: readonly (readonly [number, number])[];
    dropZone: readonly [number, number];
    required: number;
  },
): ObjectiveDefinition => ({
  id,
  type: "salvage",
  description,
  crates: pts(o.crates),
  dropZone: p(...o.dropZone),
  required: o.required,
  pickupRadius: 70,
  dropRadius: 160,
});
export const protect = (
  id: string,
  description: string,
  tag: string,
): ObjectiveDefinition => ({
  id,
  type: "protect",
  description,
  tag,
});
export const stealth = (
  id: string,
  description: string,
  sentries: readonly (readonly [number, number])[],
  o: { radius?: number; grace?: number } = {},
): ObjectiveDefinition => ({
  id,
  type: "stealth",
  description,
  sentries: pts(sentries),
  radius: o.radius ?? 380,
  graceSeconds: o.grace ?? 2,
});

/**
 * @param def - An objective.
 * @param research - Research points it grants.
 * @param credits - Credits it grants.
 * @returns It as an optional bonus objective.
 */
export function bonus(
  def: ObjectiveDefinition,
  research = BONUS_RESEARCH,
  credits = BONUS_CREDITS,
): ObjectiveDefinition {
  return { ...def, optional: true, reward: { research, credits } };
}

/**
 * @param def - An objective.
 * @returns It hidden until a script reveals it.
 */
export function hidden(def: ObjectiveDefinition): ObjectiveDefinition {
  return { ...def, hidden: true };
}

/**
 * @param def - An objective (not survive/defend).
 * @param seconds - Deadline from when it becomes active.
 * @returns It failing if still active after the deadline.
 */
export function within(
  def: ObjectiveDefinition,
  seconds: number,
): ObjectiveDefinition {
  return { ...def, timeLimit: seconds };
}

// ── Hazards ────────────────────────────────────────────────────────────────
export const ionStorm = (
  id: string,
  x: number,
  y: number,
  radius: number,
  drain = 4,
  startsInactive = false,
): HazardDefinition => ({
  id,
  kind: "ion_storm",
  at: p(x, y),
  radius,
  shieldDrainPerSecond: drain,
  stressPerSecond: 0.05,
  ...(startsInactive ? { startsInactive: true } : {}),
});
export const minefield = (
  id: string,
  mines: readonly (readonly [number, number])[],
  damage = 18,
): HazardDefinition => ({
  id,
  kind: "minefield",
  mines: pts(mines),
  triggerRadius: 55,
  damage,
});
export const asteroids = (
  id: string,
  x: number,
  y: number,
  radius: number,
  damage = 6,
  intervalMs = 1500,
): HazardDefinition => ({
  id,
  kind: "asteroid_belt",
  at: p(x, y),
  radius,
  damagePerHit: damage,
  hitIntervalMs: intervalMs,
});
export const flareWall = (
  id: string,
  o: {
    axis: "x" | "y";
    start: number;
    stop: number;
    speed: number;
    dps?: number;
    startsInactive?: boolean;
  },
): HazardDefinition => ({
  id,
  kind: "flare_wall",
  axis: o.axis,
  start: o.start,
  stop: o.stop,
  speed: o.speed,
  damagePerSecond: o.dps ?? 12,
  ...(o.startsInactive ? { startsInactive: true } : {}),
});

/**
 * Grid of mine offsets (a minefield block).
 *
 * @param cx - Block centre x.
 * @param cy - Block centre y.
 * @param columns - Columns.
 * @param rows - Rows.
 * @param gap - Spacing (px).
 * @returns Mine offsets.
 */
export function mineGrid(
  cx: number,
  cy: number,
  columns: number,
  rows: number,
  gap: number,
): [number, number][] {
  const out: [number, number][] = [];
  for (let c = 0; c < columns; c++) {
    for (let r = 0; r < rows; r++) {
      out.push([
        cx + (c - (columns - 1) / 2) * gap,
        cy + (r - (rows - 1) / 2) * gap,
      ]);
    }
  }
  return out;
}
