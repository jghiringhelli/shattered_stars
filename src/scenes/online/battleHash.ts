/**
 * battleHash — the state fingerprint online battles exchange every 30
 * ticks (and trace every tick): every ship's pose, durability, speed and
 * stress, the ordnance in flight and on the field, plus each scene's own
 * scalars. Floats are quantized by StateHasher. Pure.
 */

import { StateHasher } from "../../net/lockstep/StateHasher";

/** What the hash reads of a ship. */
export interface HashedShip {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly hull: number;
  readonly shields: number;
}

/** A shot or device on the field. */
export interface HashedOrdnance {
  readonly x: number;
  readonly y: number;
}

/**
 * Add the flat numeric, boolean and string fields of a record (in its own
 * key order — identical on every client, which builds it the same way).
 *
 * @param hasher - The hasher.
 * @param record - A plain record (nested objects are skipped).
 * @returns The hasher.
 */
export function addFields(hasher: StateHasher, record: object): StateHasher {
  for (const value of Object.values(record)) {
    if (typeof value === "number") hasher.addFloat(value);
    else if (typeof value === "boolean") hasher.addBool(value);
    else if (typeof value === "string") hasher.addString(value);
  }
  return hasher;
}

/**
 * @param hasher - The hasher.
 * @param ship - A ship.
 * @param extras - Records of the ship's state to add flat (control, stress...).
 * @returns The hasher.
 */
export function addShip(
  hasher: StateHasher,
  ship: HashedShip,
  extras: readonly object[],
): StateHasher {
  hasher
    .addString(ship.id)
    .addFloat(ship.x)
    .addFloat(ship.y)
    .addFloat(ship.angle)
    .addFloat(ship.hull)
    .addFloat(ship.shields);
  for (const extra of extras) addFields(hasher, extra);
  return hasher;
}

/**
 * @param hasher - The hasher.
 * @param shots - Missiles and torpedoes in flight.
 * @param devices - Bombs and mines on the field.
 * @returns The hasher.
 */
export function addOrdnance(
  hasher: StateHasher,
  shots: Iterable<HashedOrdnance>,
  devices: Iterable<HashedOrdnance>,
): StateHasher {
  for (const group of [shots, devices]) {
    const items = [...group];
    hasher.addInt(items.length);
    for (const item of items) hasher.addFloat(item.x).addFloat(item.y);
  }
  return hasher;
}
