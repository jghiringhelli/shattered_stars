/**
 * objectiveCore — fields every objective state carries and the small helpers
 * the per-kind models share. Pure.
 */

import type { ObjectiveDefinition } from "./objectiveDefinitions";
import type {
  ObjectiveFrame,
  ObjectiveShip,
  ObjectiveStatus,
} from "./objectiveTypes";

/** Milliseconds per second. */
export const MS_PER_SECOND = 1000;

/** Fields shared by every objective state. */
export interface ObjectiveStateCore<D extends ObjectiveDefinition> {
  readonly kind: D["type"];
  readonly def: D;
  readonly status: ObjectiveStatus;
  /** Hidden objectives are neither shown nor stepped until revealed. */
  readonly hidden: boolean;
  /** Mission time it became active (0 at mission start; null until stepped). */
  readonly startedAtMs: number | null;
}

/**
 * @param def - The objective definition.
 * @returns The core fields of its fresh state.
 */
export function coreOf<D extends ObjectiveDefinition>(
  def: D,
): ObjectiveStateCore<D> {
  const hidden = def.hidden === true;
  return {
    kind: def.type,
    def,
    status: "active",
    hidden,
    startedAtMs: hidden ? null : 0,
  };
}

/**
 * @param state - An objective state.
 * @param frame - The frame.
 * @returns Milliseconds it has been active.
 */
export function activeMs(
  state: { readonly startedAtMs: number | null },
  frame: ObjectiveFrame,
): number {
  return frame.elapsedMs - (state.startedAtMs ?? frame.elapsedMs);
}

/**
 * @param frame - The frame.
 * @param id - Ship id.
 * @returns The living ship with that id, if any.
 */
export function shipById(
  frame: ObjectiveFrame,
  id: string,
): ObjectiveShip | undefined {
  return frame.ships.find((ship) => ship.id === id);
}

/**
 * @param frame - The frame.
 * @param id - Ship id.
 * @returns Whether a destroyed event for that ship arrived this frame.
 */
export function wasDestroyed(frame: ObjectiveFrame, id: string): boolean {
  return frame.events.some(
    (event) => event.kind === "destroyed" && event.shipId === id,
  );
}

/**
 * @param frame - The frame.
 * @returns Whether any player-side ship is alive.
 */
export function anyPlayerAlive(frame: ObjectiveFrame): boolean {
  return frame.ships.some((ship) => ship.side === "player");
}

/**
 * @param ms - Milliseconds.
 * @returns Whole seconds, rounded up.
 */
export function secondsLeft(ms: number): number {
  return Math.max(0, Math.ceil(ms / MS_PER_SECOND));
}

/**
 * @param fraction - Hull fraction 0..1.
 * @returns It as a whole percentage.
 */
export function percent(fraction: number): number {
  return Math.round(Math.max(0, Math.min(1, fraction)) * 100);
}
