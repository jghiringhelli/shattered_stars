/**
 * resolveOffsets — moves authored mission geometry (offsets from the
 * battlefield centre) into world coordinates: objectives, script triggers
 * and actions, hazards. Pure.
 */

import type {
  ObjectiveDefinition,
  ObjectivePoint,
} from "../../arcade/objectives";
import type { HazardDefinition } from "../hazards/hazardTypes";
import type { ScriptAction, ScriptBeat } from "../scripting/scriptTypes";

/**
 * @param p - Offset.
 * @param origin - Battlefield centre.
 * @returns World point.
 */
export function at(p: ObjectivePoint, origin: ObjectivePoint): ObjectivePoint {
  return { x: origin.x + p.x, y: origin.y + p.y };
}

const all = (
  points: readonly ObjectivePoint[],
  origin: ObjectivePoint,
): ObjectivePoint[] => points.map((p) => at(p, origin));

/**
 * @param def - Objective with offsets.
 * @param origin - Battlefield centre.
 * @returns It in world coordinates.
 */
export function resolveObjective(
  def: ObjectiveDefinition,
  origin: ObjectivePoint,
): ObjectiveDefinition {
  switch (def.type) {
    case "escort":
      return { ...def, path: all(def.path, origin) };
    case "defend":
    case "capture":
    case "sabotage":
      return { ...def, at: at(def.at, origin) };
    case "assassinate":
      return {
        ...def,
        at: at(def.at, origin),
        ...(def.fleePath ? { fleePath: all(def.fleePath, origin) } : {}),
      };
    case "waypoints":
      return { ...def, points: all(def.points, origin) };
    case "salvage":
      return {
        ...def,
        crates: all(def.crates, origin),
        dropZone: at(def.dropZone, origin),
      };
    case "stealth":
      return { ...def, sentries: all(def.sentries, origin) };
    default:
      return def;
  }
}

/**
 * @param action - Script action with offsets.
 * @param origin - Battlefield centre.
 * @returns It in world coordinates.
 */
function resolveAction(
  action: ScriptAction,
  origin: ObjectivePoint,
): ScriptAction {
  if (action.do === "addObjective") {
    return { ...action, objective: resolveObjective(action.objective, origin) };
  }
  if (action.do === "spawn" && typeof action.group.at === "object") {
    return {
      ...action,
      group: { ...action.group, at: at(action.group.at, origin) },
    };
  }
  return action;
}

/**
 * @param beat - Script beat with offsets.
 * @param origin - Battlefield centre.
 * @returns It in world coordinates.
 */
export function resolveBeat(
  beat: ScriptBeat,
  origin: ObjectivePoint,
): ScriptBeat {
  const when =
    beat.when.on === "area"
      ? { ...beat.when, at: at(beat.when.at, origin) }
      : beat.when;
  return {
    ...beat,
    when,
    actions: beat.actions.map((a) => resolveAction(a, origin)),
  };
}

/**
 * @param hazard - Hazard with offsets.
 * @param origin - Battlefield centre.
 * @returns It in world coordinates.
 */
export function resolveHazard(
  hazard: HazardDefinition,
  origin: ObjectivePoint,
): HazardDefinition {
  switch (hazard.kind) {
    case "ion_storm":
    case "asteroid_belt":
      return { ...hazard, at: at(hazard.at, origin) };
    case "minefield":
      return { ...hazard, mines: all(hazard.mines, origin) };
    case "flare_wall": {
      const base = hazard.axis === "x" ? origin.x : origin.y;
      return {
        ...hazard,
        start: base + hazard.start,
        stop: base + hazard.stop,
      };
    }
  }
}
