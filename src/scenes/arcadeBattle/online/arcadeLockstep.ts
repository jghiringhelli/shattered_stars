/**
 * arcadeLockstep — the parts of ArcadeBattleScene's online lockstep that
 * need no scene: the state hash, and reading / writing the simulation
 * fields of the scene's controllers (reinforcements, scenario) for
 * snapshots — their views (HUD, picker, world glyphs) stay live.
 * Pure: no Phaser.
 */

import { StateHasher } from "../../../net/lockstep/StateHasher";
import {
  addFields,
  addOrdnance,
  addShip,
  type HashedOrdnance,
} from "../../online/battleHash";
import type { ArcadeShip } from "../arcadeShipFactory";

/** Simulation fields of the reinforcement controller (the rest is its views). */
export const REINFORCEMENT_SIM_FIELDS = [
  "director",
  "shield",
  "alive",
  "issuedIds",
  "ended",
  "nowMs",
] as const;

/** Simulation fields of the scenario controller (the rest is its views). */
export const SCENARIO_SIM_FIELDS = [
  "state",
  "tracker",
  "director",
  "ended",
  "playerMarkId",
] as const;

/** What the arcade hash reads. */
export interface ArcadeHashView {
  readonly tick: number;
  readonly battleClockMs: number;
  readonly rngStates: readonly number[];
  readonly ships: Iterable<ArcadeShip>;
  readonly shots: Iterable<HashedOrdnance>;
  readonly devices: Iterable<HashedOrdnance>;
  /** Ordnance id counters of the battle. */
  readonly idCounters?: readonly number[];
  /** Flat scalars (match timer, side scores, flags). */
  readonly scalars: readonly object[];
}

/**
 * @param view - The battle this tick.
 * @returns Its fingerprint.
 */
export function hashArcade(view: ArcadeHashView): number {
  const h = new StateHasher().addInt(view.tick).addFloat(view.battleClockMs);
  for (const state of view.rngStates) h.addInt(state);
  for (const ship of view.ships) {
    addShip(h, ship, [
      ship.control,
      ship.stress,
      {
        cooldown: ship.weaponCooldown,
        crew: ship.crewMode,
        team: ship.team,
        squad: ship.squad,
      },
    ]);
  }
  addOrdnance(h, view.shots, view.devices, view.idCounters);
  for (const scalar of view.scalars) addFields(h, scalar);
  return h.digest();
}

/**
 * @param owner - A controller (or null).
 * @param fields - Its simulation fields.
 * @returns Those fields as a record (snapshot root part), or null.
 */
export function readSimFields(
  owner: object | null,
  fields: readonly string[],
): Record<string, unknown> | null {
  if (!owner) return null;
  const record = owner as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (!(field in record))
      throw new Error(`Online snapshot: ${field} is not a field any more`);
    out[field] = record[field];
  }
  return out;
}

/**
 * @param owner - The controller the fields were read from (or null).
 * @param values - Restored values (readSimFields shape), or null.
 */
export function writeSimFields(
  owner: object | null,
  values: Record<string, unknown> | null,
): void {
  if (!owner || !values) return;
  Object.assign(owner, values);
}
