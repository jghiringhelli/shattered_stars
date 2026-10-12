/**
 * explosionEffect — a ship (or ordnance) blowing up: flash, shock ring,
 * debris, smoke, its sound and (for medium/large) a camera shake.
 * Fire-and-forget: every graphic destroys itself.
 */

import Phaser from "phaser";
import { audioManager } from "../../audio/AudioManager";
import type { SoundEffectType } from "../../audio/SoundDesign";

/** Explosion scale. */
export type ExplosionSize = "small" | "medium" | "large";

/** Quality knobs an explosion honours. */
export interface ExplosionQuality {
  /** Debris/smoke count multiplier (adaptive quality). */
  readonly particleMultiplier: number;
  /** Whether medium/large explosions shake the camera. */
  readonly cameraShake: boolean;
}

interface ExplosionConfig {
  readonly particles: number;
  readonly radius: number;
  readonly duration: number;
}

const SIZE_CONFIG: Readonly<Record<ExplosionSize, ExplosionConfig>> = {
  small: { particles: 8, radius: 30, duration: 300 },
  medium: { particles: 15, radius: 60, duration: 500 },
  large: { particles: 25, radius: 100, duration: 700 },
};

const SOUND_OF_SIZE: Readonly<Record<ExplosionSize, SoundEffectType>> = {
  small: "explosion_small",
  medium: "explosion_medium",
  large: "explosion_large",
};

const DEBRIS_COLORS = [0xff4400, 0xff8800, 0xffaa00, 0xffff00];

/** Camera shake per size: [duration ms, intensity]; small never shakes. */
const SHAKE_OF_SIZE: Readonly<
  Partial<Record<ExplosionSize, [number, number]>>
> = {
  medium: [100, 0.005],
  large: [200, 0.01],
};

interface Blast {
  readonly scene: Phaser.Scene;
  readonly x: number;
  readonly y: number;
  readonly size: ExplosionSize;
  readonly config: ExplosionConfig;
}

/**
 * Draw an explosion and play its sound.
 *
 * @param scene - Scene to draw in.
 * @param at - Centre of the blast.
 * @param size - Explosion scale.
 * @param quality - Particle multiplier and camera-shake preference.
 */
export function drawExplosion(
  scene: Phaser.Scene,
  at: { readonly x: number; readonly y: number },
  size: ExplosionSize,
  quality: ExplosionQuality,
): void {
  audioManager.playSoundAt(SOUND_OF_SIZE[size], at.x, at.y, 0.8);
  const base = SIZE_CONFIG[size];
  const particles = Math.max(
    1,
    Math.round(base.particles * quality.particleMultiplier),
  );
  const blast: Blast = { scene, ...at, size, config: { ...base, particles } };
  addFlash(blast);
  addShockRing(blast);
  for (let i = 0; i < particles; i++) addDebris(blast, i);
  for (let i = 0; i < particles / 2; i++) addSmoke(blast);
  const shake = SHAKE_OF_SIZE[size];
  if (quality.cameraShake && shake) scene.cameras.main.shake(...shake);
}

function addFlash({ scene, x, y, config }: Blast): void {
  const flash = scene.add.graphics();
  flash.setDepth(25);
  flash.fillStyle(0xffffff, 1);
  flash.fillCircle(x, y, config.radius * 0.4);
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 100,
    onComplete: () => flash.destroy(),
  });
}

function addShockRing({ scene, x, y, config }: Blast): void {
  const ring = scene.add.graphics();
  ring.setDepth(24);
  ring.lineStyle(3, 0xff6600, 0.8);
  ring.strokeCircle(x, y, 10);
  scene.tweens.add({
    targets: ring,
    alpha: 0,
    scaleX: config.radius / 10,
    scaleY: config.radius / 10,
    duration: config.duration,
    ease: "Quad.out",
    onComplete: () => ring.destroy(),
  });
}

function addDebris(blast: Blast, index: number): void {
  const { scene, x, y, size, config } = blast;
  const angle = (index / config.particles) * Math.PI * 2 + Math.random() * 0.5;
  const speed = config.radius * (0.5 + Math.random() * 0.5);
  const color = Phaser.Math.RND.pick(DEBRIS_COLORS);
  const particleSize = 2 + Math.random() * (size === "large" ? 6 : 4);
  const particle = scene.add.graphics();
  particle.setDepth(23);
  particle.fillStyle(color, 1);
  particle.fillCircle(0, 0, particleSize);
  particle.setPosition(x, y);
  scene.tweens.add({
    targets: particle,
    x: x + Math.cos(angle) * speed,
    y: y + Math.sin(angle) * speed,
    alpha: 0,
    scaleX: 0.2,
    scaleY: 0.2,
    duration: config.duration * (0.7 + Math.random() * 0.6),
    ease: "Quad.out",
    onComplete: () => particle.destroy(),
  });
}

function addSmoke({ scene, x, y, config }: Blast): void {
  const smoke = scene.add.graphics();
  smoke.setDepth(22);
  smoke.fillStyle(0x333333, 0.4);
  smoke.fillCircle(0, 0, 5 + Math.random() * 10);
  smoke.setPosition(
    x + (Math.random() - 0.5) * 20,
    y + (Math.random() - 0.5) * 20,
  );
  scene.tweens.add({
    targets: smoke,
    y: smoke.y - 30 - Math.random() * 20,
    alpha: 0,
    scaleX: 3,
    scaleY: 3,
    duration: config.duration * 1.5,
    delay: Math.random() * 200,
    ease: "Quad.out",
    onComplete: () => smoke.destroy(),
  });
}
