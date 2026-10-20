/**
 * Devices — bombs and mines as real objects on the battlefield.
 *
 * - Dropped one speed-1 template astern of the ship (tabletop drop).
 * - Bomb: a timed fuse; at the end it blasts.
 * - Mine: arms after one cycle; the first ENEMY whose hull touches it sets
 *   it off (IFF, so a squad flying over its own mines is safe); untouched
 *   mines fizzle after their lifetime.
 * - A blast hits EVERY living ship within its radius, friend or foe
 *   (tabletop devices are indiscriminate: friendly fire applies).
 *
 * Pure: no Phaser.
 */

import { pointAstern, torusRangePx, type FiringPose } from "./FiringGeometry";
import { DEFAULT_HULL_RADIUS_PX } from "./OrdnanceFlight";
import {
  DEVICE_DROP_DISTANCE_PX,
  type DeviceKind,
  type DeviceSpec,
} from "./weaponSpecs";
import type { WeaponBody } from "./weaponTypes";

/** A bomb or mine on the field. */
export interface DeviceObject {
  readonly id: string;
  readonly ownerId: string;
  readonly ownerSide: string;
  readonly kind: DeviceKind;
  readonly x: number;
  readonly y: number;
  /** Time since the drop (ms). */
  readonly ageMs: number;
  readonly spec: DeviceSpec;
}

/** A detonation. */
export interface Blast {
  readonly deviceId: string;
  readonly ownerId: string;
  readonly kind: DeviceKind;
  readonly x: number;
  readonly y: number;
  readonly radiusPx: number;
  readonly damage: number;
  readonly stressOnHit: number;
  /** Ids of every ship caught in the radius. */
  readonly victims: readonly string[];
}

/** One frame of a device. */
export interface DeviceStep {
  /** The device still on the field, or null once it blew or fizzled. */
  readonly device: DeviceObject | null;
  readonly blast: Blast | null;
}

/** The dropping ship. */
export interface Dropper extends FiringPose {
  readonly id: string;
  readonly side: string;
}

/**
 * @param dropper - The ship dropping it.
 * @param spec - The device's rules.
 * @param worldSize - Map edge length (px).
 * @param id - The battle's next device id (per-battle, see FieldOrdnance).
 * @returns The device, astern of the ship.
 */
export function dropDevice(
  dropper: Dropper,
  spec: DeviceSpec,
  worldSize: number,
  id: string,
): DeviceObject {
  const at = pointAstern(dropper, DEVICE_DROP_DISTANCE_PX, worldSize);
  return {
    id,
    ownerId: dropper.id,
    ownerSide: dropper.side,
    kind: spec.kind,
    x: at.x,
    y: at.y,
    ageMs: 0,
    spec,
  };
}

/**
 * @param device - A device on the field.
 * @returns True once a mine can be set off (bombs never are).
 */
export function isArmed(device: DeviceObject): boolean {
  return device.kind === "mine" && device.ageMs >= device.spec.armMs;
}

/**
 * Advance a device one frame: fuse, arming, trigger, fizzle.
 *
 * @param device - The device before the frame.
 * @param bodies - Every ship on the field.
 * @param deltaMs - Frame length (ms).
 * @param worldSize - Map edge length (px).
 * @returns The device after the frame and its blast, if it went off.
 */
export function stepDevice(
  device: DeviceObject,
  bodies: Iterable<WeaponBody>,
  deltaMs: number,
  worldSize: number,
): DeviceStep {
  const aged: DeviceObject = { ...device, ageMs: device.ageMs + deltaMs };
  const living = [...bodies].filter((body) => body.hull > 0);
  if (aged.kind === "bomb") {
    if (aged.ageMs < aged.spec.fuseMs) return { device: aged, blast: null };
    return { device: null, blast: blastOf(aged, living, worldSize) };
  }
  if (isArmed(aged) && touchedByEnemy(aged, living, worldSize)) {
    return { device: null, blast: blastOf(aged, living, worldSize) };
  }
  if (aged.ageMs >= aged.spec.lifetimeMs) return { device: null, blast: null };
  return { device: aged, blast: null };
}

function touchedByEnemy(
  mine: DeviceObject,
  living: readonly WeaponBody[],
  worldSize: number,
): boolean {
  return living.some(
    (body) =>
      body.side !== mine.ownerSide &&
      torusRangePx(mine, body, worldSize) <=
        mine.spec.triggerRadiusPx + hullRadius(body) - DEFAULT_HULL_RADIUS_PX,
  );
}

function hullRadius(body: WeaponBody): number {
  return body.hitRadiusPx ?? DEFAULT_HULL_RADIUS_PX;
}

function blastOf(
  device: DeviceObject,
  living: readonly WeaponBody[],
  worldSize: number,
): Blast {
  const reach = device.spec.blastRadiusPx;
  return {
    deviceId: device.id,
    ownerId: device.ownerId,
    kind: device.kind,
    x: device.x,
    y: device.y,
    radiusPx: reach,
    damage: device.spec.damage,
    stressOnHit: device.spec.stressOnHit,
    victims: living
      .filter((body) => torusRangePx(device, body, worldSize) <= reach)
      .map((body) => body.id),
  };
}
