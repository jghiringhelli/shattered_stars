/**
 * weaponEffects — one-shot laser bolt and shield-impact visuals (with their
 * positional sounds). Fire-and-forget: every graphic destroys itself.
 */

import Phaser from "phaser";
import type { FactionId } from "../../config";
import { FACTION_COLORS } from "../../config";
import { audioManager } from "../../audio/AudioManager";

/** Laser colour per faction. */
const FACTION_LASER_COLORS: Record<FactionId, number> = {
  terran_hegemony: 0x00aaff,
  free_confederation: 0x44ff88,
  synthetic_collective: 0xff4444,
  void_corsairs: 0xffaa00,
  ascendant_empire: 0xaa44ff,
};

/** Spread (px) of a missed bolt around its target. */
const MISS_SPREAD_PX = 40;
/** Draw depth of laser bolts. */
const LASER_DEPTH = 15;
/** Draw depth of shield ripples. */
const SHIELD_DEPTH = 20;
/** Rings in a shield ripple. */
const SHIELD_RIPPLE_RINGS = 3;
/** Delay between successive shield-ripple rings (ms). */
const SHIELD_RIPPLE_STEP_MS = 50;

/** A laser bolt from shooter to target. */
export interface LaserShot {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly faction: FactionId;
  readonly hit: boolean;
}

/**
 * Draw a laser bolt (muzzle flash, beam, impact flash on a hit) and play
 * its sound from the shooter's position.
 *
 * @param scene - Scene to draw in.
 * @param shot - The bolt.
 */
export function drawLaser(scene: Phaser.Scene, shot: LaserShot): void {
  const { fromX, fromY, toX, toY, hit } = shot;
  // Fired from the shooter's position, so a distant exchange sits back in
  // the mix instead of on top of the player's own guns.
  audioManager.playSoundAt("laser_fire", fromX, fromY, hit ? 0.8 : 0.5);
  const color = FACTION_LASER_COLORS[shot.faction];
  const graphics = scene.add.graphics();
  graphics.setDepth(LASER_DEPTH);
  const missOffset = hit ? 0 : (Math.random() - 0.5) * MISS_SPREAD_PX;
  const targetX = toX + missOffset;
  const targetY = toY + missOffset;
  graphics.lineStyle(hit ? 3 : 2, color, hit ? 0.9 : 0.5);
  graphics.lineBetween(fromX, fromY, targetX, targetY);
  graphics.lineStyle(1, 0xffffff, hit ? 0.7 : 0.3);
  graphics.lineBetween(fromX, fromY, targetX, targetY);
  graphics.fillStyle(color, 0.8);
  graphics.fillCircle(fromX, fromY, 4);
  graphics.fillStyle(0xffffff, 0.6);
  graphics.fillCircle(fromX, fromY, 2);
  if (hit) {
    graphics.fillStyle(0xffffff, 0.8);
    graphics.fillCircle(toX, toY, 6);
    graphics.fillStyle(color, 0.6);
    graphics.fillCircle(toX, toY, 10);
  }
  scene.tweens.add({
    targets: graphics,
    alpha: 0,
    duration: hit ? 150 : 100,
    onComplete: () => graphics.destroy(),
  });
}

/**
 * Draw a shield impact: expanding ripple rings and a shield bubble.
 *
 * @param scene - Scene to draw in.
 * @param x - Impact x.
 * @param y - Impact y.
 * @param faction - Shielded ship's faction (ripple colour).
 */
export function drawShieldImpact(
  scene: Phaser.Scene,
  x: number,
  y: number,
  faction: FactionId,
): void {
  audioManager.playSoundAt("shield_hit", x, y, 0.6);
  const color = FACTION_COLORS[faction];
  const bubble = scene.add.graphics();
  bubble.setDepth(SHIELD_DEPTH);
  bubble.setPosition(x, y);
  for (let i = 0; i < SHIELD_RIPPLE_RINGS; i++) {
    addShieldRipple(scene, { x, y, color, ring: i });
  }
  bubble.lineStyle(2, color, 0.8);
  bubble.strokeCircle(0, 0, 25);
  bubble.lineStyle(1, 0xffffff, 0.5);
  bubble.strokeCircle(0, 0, 20);
  scene.tweens.add({
    targets: bubble,
    alpha: 0,
    duration: 300,
    onComplete: () => bubble.destroy(),
  });
}

interface RippleSpec {
  readonly x: number;
  readonly y: number;
  readonly color: number;
  /** 0 = innermost, first ring. */
  readonly ring: number;
}

function addShieldRipple(scene: Phaser.Scene, spec: RippleSpec): void {
  const { ring: i } = spec;
  const ring = scene.add.graphics();
  ring.setDepth(SHIELD_DEPTH);
  ring.setPosition(spec.x, spec.y);
  ring.setAlpha(0);
  scene.time.delayedCall(i * SHIELD_RIPPLE_STEP_MS, () => {
    ring.lineStyle(3 - i, spec.color, 0.8 - i * 0.2);
    ring.strokeCircle(0, 0, 20 + i * 10);
    ring.setAlpha(1);
    scene.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 200,
      onComplete: () => ring.destroy(),
    });
  });
}
