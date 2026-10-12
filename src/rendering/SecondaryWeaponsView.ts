/**
 * SecondaryWeaponsView — draws the shared secondary-weapons runtime in any
 * battle scene: missiles and torpedoes in flight (oriented bolts), bombs
 * (orb with a shrinking fuse ring) and mines (spiked, amber while arming,
 * blinking red with their trigger ring once armed), plus short-lived
 * effects for turret shots, launches and blasts.
 *
 * Reads the runtime's state each frame (sync) and its events (play); owns
 * and destroys every game object it creates.
 */

import Phaser from "phaser";
import { audioManager } from "../audio/AudioManager";
import type { DeviceObject } from "../arcade/weapons/Devices";
import type { OrdnanceShot } from "../arcade/weapons/OrdnanceFlight";
import type { WeaponEvent } from "../arcade/weapons/weaponTypes";
import { drawEnergyBolt, drawEnergyOrb } from "./BoltRenderer";

/** Above ships' trails, below ships (10) and overlays. */
const WEAPON_DEPTH = 6;
const FRIENDLY_COLOR = 0xffaa33;
const HOSTILE_COLOR = 0xff3355;
const TURRET_FRIENDLY_COLOR = 0x33e0ff;
const TURRET_HOSTILE_COLOR = 0xff44dd;
const ARMING_COLOR = 0xffc94a;
const ARMED_COLOR = 0xff2a2a;
const MISSILE_BOLT = { length: 14, width: 5 } as const;
const TORPEDO_BOLT = { length: 18, width: 8 } as const;
const BOMB_RADIUS_PX = 6;
const MINE_RADIUS_PX = 7;
const MINE_SPIKES = 6;
const MINE_SPIKE_PX = 4;
/** Armed mines blink with this period (ms). */
const MINE_BLINK_MS = 400;
const TRIGGER_RING_ALPHA = 0.25;
const TURRET_BOLT_MS = 140;
const TURRET_BOLT_WIDTH = 2;
const BLAST_MS = 450;
const BLAST_START_SCALE = 0.2;
const LAUNCH_FLASH_RADIUS_PX = 10;
const LAUNCH_FLASH_MS = 160;
const FULL_TURN_RAD = Math.PI * 2;
/** Mix levels for ordnance sounds (same scale as EffectsManager). */
const LAUNCH_VOLUME = 0.7;
const BLAST_VOLUME = 0.8;

/** What the view needs to colour things by side. */
export interface WeaponsViewConfig {
  /** The player's side key (friendly colours). */
  readonly playerSide: () => string;
  /** Side of a ship (for event colours). */
  readonly sideOf: (shipId: string) => string | null;
}

export class SecondaryWeaponsView {
  private readonly shotSprites = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly deviceSprites = new Map<
    string,
    Phaser.GameObjects.Graphics
  >();

  /**
   * @param scene - The battle scene.
   * @param config - Side lookups for colours.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: WeaponsViewConfig,
  ) {}

  /**
   * Bring the sprites in line with the runtime's shots and devices.
   *
   * @param shots - Missiles/torpedoes in flight.
   * @param devices - Bombs/mines on the field.
   * @param nowMs - Scene time (blinking).
   */
  sync(
    shots: readonly OrdnanceShot[],
    devices: readonly DeviceObject[],
    nowMs: number,
  ): void {
    const liveShots = new Set<string>();
    for (const shot of shots) {
      liveShots.add(shot.id);
      const sprite = this.shotSprites.get(shot.id) ?? this.createShot(shot);
      sprite.setPosition(shot.x, shot.y).setAngle(shot.angle);
    }
    prune(this.shotSprites, liveShots);
    const liveDevices = new Set<string>();
    for (const device of devices) {
      liveDevices.add(device.id);
      const sprite =
        this.deviceSprites.get(device.id) ?? this.createDevice(device);
      this.drawDevice(sprite, device, nowMs);
    }
    prune(this.deviceSprites, liveDevices);
  }

  /**
   * Play the effects of this frame's events (hits are the scene's job).
   *
   * @param events - Runtime events.
   */
  play(events: readonly WeaponEvent[]): void {
    for (const event of events) {
      if (event.kind === "turret") this.turretBolt(event);
      else if (event.kind === "blast") {
        this.blast(event.x, event.y, event.radiusPx);
        audioManager.playSoundAt(
          "explosion_medium",
          event.x,
          event.y,
          BLAST_VOLUME,
        );
      } else if (event.kind === "launch") {
        this.flash(event.x, event.y, event.shipId);
        audioManager.playSoundAt(
          "missile_launch",
          event.x,
          event.y,
          LAUNCH_VOLUME,
        );
      }
    }
  }

  /** Destroy every sprite. */
  destroy(): void {
    prune(this.shotSprites, new Set());
    prune(this.deviceSprites, new Set());
  }

  private friendly(sideOrShip: { side?: string; shipId?: string }): boolean {
    const side = sideOrShip.side ?? this.config.sideOf(sideOrShip.shipId ?? "");
    return side === this.config.playerSide();
  }

  private createShot(shot: OrdnanceShot): Phaser.GameObjects.Graphics {
    const sprite = this.scene.add.graphics().setDepth(WEAPON_DEPTH);
    const size = shot.kind === "torpedo" ? TORPEDO_BOLT : MISSILE_BOLT;
    drawEnergyBolt(sprite, {
      color: this.friendly({ side: shot.ownerSide })
        ? FRIENDLY_COLOR
        : HOSTILE_COLOR,
      ...size,
    });
    this.shotSprites.set(shot.id, sprite);
    return sprite;
  }

  private createDevice(device: DeviceObject): Phaser.GameObjects.Graphics {
    const sprite = this.scene.add.graphics().setDepth(WEAPON_DEPTH);
    this.deviceSprites.set(device.id, sprite);
    return sprite;
  }

  private drawDevice(
    sprite: Phaser.GameObjects.Graphics,
    device: DeviceObject,
    nowMs: number,
  ): void {
    sprite.clear().setPosition(device.x, device.y);
    if (device.kind === "bomb") {
      drawEnergyOrb(sprite, { color: ARMING_COLOR, radius: BOMB_RADIUS_PX });
      const left = 1 - device.ageMs / Math.max(1, device.spec.fuseMs);
      sprite.lineStyle(2, ARMED_COLOR, 1);
      sprite.beginPath();
      sprite.arc(
        0,
        0,
        BOMB_RADIUS_PX * 2,
        -Math.PI / 2,
        -Math.PI / 2 + left * FULL_TURN_RAD,
      );
      sprite.strokePath();
      return;
    }
    const armed = device.ageMs >= device.spec.armMs;
    const lit = !armed || Math.floor(nowMs / MINE_BLINK_MS) % 2 === 0;
    const color = armed ? ARMED_COLOR : ARMING_COLOR;
    sprite.fillStyle(color, lit ? 1 : 0.45);
    sprite.fillCircle(0, 0, MINE_RADIUS_PX);
    sprite.lineStyle(2, color, lit ? 1 : 0.45);
    for (let i = 0; i < MINE_SPIKES; i++) {
      const a = (i / MINE_SPIKES) * FULL_TURN_RAD;
      sprite.lineBetween(
        Math.cos(a) * MINE_RADIUS_PX,
        Math.sin(a) * MINE_RADIUS_PX,
        Math.cos(a) * (MINE_RADIUS_PX + MINE_SPIKE_PX),
        Math.sin(a) * (MINE_RADIUS_PX + MINE_SPIKE_PX),
      );
    }
    if (armed) {
      sprite.lineStyle(1, ARMED_COLOR, TRIGGER_RING_ALPHA);
      sprite.strokeCircle(0, 0, device.spec.triggerRadiusPx);
    }
  }

  private turretBolt(event: Extract<WeaponEvent, { kind: "turret" }>): void {
    const line = this.scene.add.graphics().setDepth(WEAPON_DEPTH);
    const color = this.friendly({ shipId: event.shipId })
      ? TURRET_FRIENDLY_COLOR
      : TURRET_HOSTILE_COLOR;
    line.lineStyle(TURRET_BOLT_WIDTH, color, event.hit ? 1 : 0.5);
    line.lineBetween(event.fromX, event.fromY, event.toX, event.toY);
    this.fade(line, TURRET_BOLT_MS);
  }

  private blast(x: number, y: number, radiusPx: number): void {
    const ring = this.scene.add.graphics().setDepth(WEAPON_DEPTH);
    ring.setPosition(x, y);
    ring.fillStyle(ARMING_COLOR, 0.35);
    ring.fillCircle(0, 0, radiusPx);
    ring.lineStyle(3, ARMED_COLOR, 1);
    ring.strokeCircle(0, 0, radiusPx);
    ring.setScale(BLAST_START_SCALE);
    this.scene.tweens.add({
      targets: ring,
      scale: 1,
      alpha: 0,
      duration: BLAST_MS,
      onComplete: () => ring.destroy(),
    });
  }

  private flash(x: number, y: number, shipId: string): void {
    const flash = this.scene.add.graphics().setDepth(WEAPON_DEPTH);
    drawEnergyOrb(flash, {
      color: this.friendly({ shipId }) ? FRIENDLY_COLOR : HOSTILE_COLOR,
      radius: LAUNCH_FLASH_RADIUS_PX,
    });
    flash.setPosition(x, y);
    this.fade(flash, LAUNCH_FLASH_MS);
  }

  private fade(object: Phaser.GameObjects.Graphics, durationMs: number): void {
    this.scene.tweens.add({
      targets: object,
      alpha: 0,
      duration: durationMs,
      onComplete: () => object.destroy(),
    });
  }
}

/**
 * Destroy the sprites whose objects are gone.
 *
 * @param sprites - Sprites by object id (mutated).
 * @param live - Ids still present.
 */
function prune(
  sprites: Map<string, Phaser.GameObjects.Graphics>,
  live: ReadonlySet<string>,
): void {
  for (const [id, sprite] of sprites) {
    if (live.has(id)) continue;
    sprite.destroy();
    sprites.delete(id);
  }
}
