/**
 * FieldOrdnance — everything secondary weapons leave on the field between
 * frames: missiles/torpedoes in flight and bombs/mines dropped. Each frame
 * shots home and strike, devices fuse, arm, trigger or fizzle, and every
 * impact or blast becomes `hit` events (blasts hit every ship in reach).
 *
 * Pure: no Phaser.
 */

import {
  dropDevice,
  stepDevice,
  type DeviceObject,
  type Dropper,
} from "./Devices";
import { calculateHitChance } from "../../data/ModeBalancing";
import { weaponHitDamage } from "./FireControl";
import {
  flyShot,
  launchShot,
  shotImpact,
  type Launcher,
  type LockedTarget,
  type OrdnanceShot,
} from "./OrdnanceFlight";
import type { DeviceSpec, LauncherSpec, SecondaryKind } from "./weaponSpecs";
import type { WeaponBody, WeaponEvent, WeaponWorld } from "./weaponTypes";

/** Ships on the field this frame, by id, who is cloaked, and the dice. */
export interface FieldView {
  readonly bodies: ReadonlyMap<string, WeaponBody>;
  readonly isCloaked: (shipId: string) => boolean;
  /** Uniform [0, 1) source for a warhead's attack roll. */
  readonly random: () => number;
}

/**
 * @param world - The battle.
 * @returns Its ships by id.
 */
export function indexBodies(world: WeaponWorld): Map<string, WeaponBody> {
  const bodies = new Map<string, WeaponBody>();
  for (const body of world.bodies()) bodies.set(body.id, body);
  return bodies;
}

/** Shots in flight and devices on the field. */
export class FieldOrdnance {
  private shots: OrdnanceShot[] = [];
  private devices: DeviceObject[] = [];
  /** Ids handed out this battle; part of the snapshot and the hash. */
  private shotsLaunched = 0;
  private devicesDropped = 0;

  /** @param worldSize - Map edge length (px). */
  constructor(private readonly worldSize: number) {}

  /** @returns Missiles and torpedoes in flight. */
  get shotsInFlight(): readonly OrdnanceShot[] {
    return this.shots;
  }

  /** @returns Bombs and mines on the field. */
  get devicesOnField(): readonly DeviceObject[] {
    return this.devices;
  }

  /** @returns The id counters (shots launched, devices dropped) for the state hash. */
  get idCounters(): readonly number[] {
    return [this.shotsLaunched, this.devicesDropped];
  }

  /** Remove everything and restart the ids (new battle / restart). */
  clear(): void {
    this.shots = [];
    this.devices = [];
    this.shotsLaunched = 0;
    this.devicesDropped = 0;
  }

  /**
   * @param launcher - The firing ship.
   * @param spec - Its launcher.
   * @param target - The locked target.
   * @returns The launch event.
   */
  launch(
    launcher: Launcher,
    spec: LauncherSpec,
    target: LockedTarget,
  ): WeaponEvent {
    this.shotsLaunched += 1;
    const id = `ordnance_${this.shotsLaunched}`;
    const shot = launchShot(launcher, spec, target, this.worldSize, id);
    this.shots.push(shot);
    return {
      kind: "launch",
      shipId: launcher.id,
      weapon: spec.kind,
      targetId: target.id,
      x: shot.x,
      y: shot.y,
    };
  }

  /**
   * @param dropper - The ship dropping it.
   * @param spec - Its device.
   * @returns The drop event.
   */
  drop(dropper: Dropper, spec: DeviceSpec): WeaponEvent {
    this.devicesDropped += 1;
    const id = `device_${this.devicesDropped}`;
    const device = dropDevice(dropper, spec, this.worldSize, id);
    this.devices.push(device);
    return {
      kind: "drop",
      shipId: dropper.id,
      weapon: spec.kind,
      x: device.x,
      y: device.y,
    };
  }

  /**
   * Fly every shot and step every device one frame.
   *
   * @param field - The ships on the field.
   * @param deltaMs - Frame length (ms).
   * @returns Hits and blasts this frame.
   */
  update(field: FieldView, deltaMs: number): WeaponEvent[] {
    return [
      ...this.flyShots(field, deltaMs),
      ...this.stepDevices(field, deltaMs),
    ];
  }

  private flyShots(field: FieldView, deltaMs: number): WeaponEvent[] {
    const events: WeaponEvent[] = [];
    const flying: OrdnanceShot[] = [];
    const bodies = [...field.bodies.values()];
    for (const shot of this.shots) {
      const target = shot.targetId
        ? field.bodies.get(shot.targetId)
        : undefined;
      const guided =
        target && target.hull > 0 && !field.isCloaked(target.id)
          ? target
          : null;
      const after = flyShot(shot, guided, deltaMs, this.worldSize);
      const struck = shotImpact(shot, after, bodies, this.worldSize);
      if (struck) {
        // X-Wing: the warhead's attack still rolls against the agility.
        const odds = calculateHitChance(shot.attackDice, struck.agilityDice);
        if (field.random() < odds)
          events.push(this.hitOf(shot.ownerId, struck, shot, field));
        continue;
      }
      if (after.lifetimeMs > 0) flying.push(after);
    }
    this.shots = flying;
    return events;
  }

  private hitOf(
    attackerId: string,
    target: WeaponBody,
    weapon: {
      readonly kind: SecondaryKind;
      readonly damage: number;
      readonly stressOnHit: number;
    },
    field: FieldView,
  ): WeaponEvent {
    return {
      kind: "hit",
      attackerId,
      targetId: target.id,
      weapon: weapon.kind,
      damage: weaponHitDamage(
        weapon.damage,
        target,
        field.isCloaked(target.id),
      ),
      stress: weapon.stressOnHit,
    };
  }

  private stepDevices(field: FieldView, deltaMs: number): WeaponEvent[] {
    const events: WeaponEvent[] = [];
    const remaining: DeviceObject[] = [];
    const bodies = [...field.bodies.values()];
    for (const device of this.devices) {
      const step = stepDevice(device, bodies, deltaMs, this.worldSize);
      if (step.device) remaining.push(step.device);
      const blast = step.blast;
      if (!blast) continue;
      events.push({
        kind: "blast",
        ownerId: blast.ownerId,
        weapon: blast.kind,
        x: blast.x,
        y: blast.y,
        radiusPx: blast.radiusPx,
      });
      for (const victimId of blast.victims) {
        const victim = field.bodies.get(victimId);
        if (!victim) continue;
        events.push(
          this.hitOf(
            blast.ownerId,
            victim,
            {
              kind: blast.kind,
              damage: blast.damage,
              stressOnHit: blast.stressOnHit,
            },
            field,
          ),
        );
      }
    }
    this.devices = remaining;
    return events;
  }
}
