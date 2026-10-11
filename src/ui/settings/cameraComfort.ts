/**
 * cameraComfort — applies Settings › Accessibility "screen shake" intensity
 * and "reduce flashes" to EVERY camera shake/flash in the game, by wrapping
 * Phaser's Camera.shake/flash once at boot. One choke point instead of
 * threading the settings through every effect call site.
 */

import Phaser from "phaser";

/** Current comfort levels. */
export interface CameraComfortLevels {
  /** Multiplier on shake intensity; 0 disables shake. */
  readonly shakeScale: number;
  /** Dim and shorten full-screen flashes. */
  readonly reduceFlashes: boolean;
}

/** Flash colour multiplier with "reduce flashes" on. */
const REDUCED_FLASH_BRIGHTNESS = 0.3;
/** Flash duration multiplier with "reduce flashes" on. */
const REDUCED_FLASH_DURATION = 0.5;
const FULL_CHANNEL = 255;

let levels: CameraComfortLevels = { shakeScale: 1, reduceFlashes: false };
let installed = false;

/**
 * @param next - New comfort levels (read on every shake/flash).
 */
export function setCameraComfort(next: CameraComfortLevels): void {
  levels = next;
}

type ShakeArgs = Parameters<Phaser.Cameras.Scene2D.Camera["shake"]>;
type FlashArgs = Parameters<Phaser.Cameras.Scene2D.Camera["flash"]>;

function scaledIntensity(intensity: ShakeArgs[1]): ShakeArgs[1] {
  if (intensity === undefined) return intensity;
  if (typeof intensity === "number") return intensity * levels.shakeScale;
  return new Phaser.Math.Vector2(intensity.x, intensity.y).scale(
    levels.shakeScale,
  );
}

function dim(channel: number | undefined): number {
  return Math.round((channel ?? FULL_CHANNEL) * REDUCED_FLASH_BRIGHTNESS);
}

/** Wrap Camera.shake/flash once. Idempotent. */
export function installCameraComfort(): void {
  if (installed) return;
  installed = true;
  const proto = Phaser.Cameras.Scene2D.Camera.prototype;
  const shake = proto.shake;
  const flash = proto.flash;
  proto.shake = function (
    this: Phaser.Cameras.Scene2D.Camera,
    ...args: ShakeArgs
  ) {
    if (levels.shakeScale <= 0) return this;
    const [duration, intensity, ...rest] = args;
    return shake.call(this, duration, scaledIntensity(intensity), ...rest);
  };
  proto.flash = function (
    this: Phaser.Cameras.Scene2D.Camera,
    ...args: FlashArgs
  ) {
    if (!levels.reduceFlashes) return flash.apply(this, args);
    const [duration, red, green, blue, ...rest] = args;
    const shortened =
      duration === undefined ? duration : duration * REDUCED_FLASH_DURATION;
    return flash.call(
      this,
      shortened,
      dim(red),
      dim(green),
      dim(blue),
      ...rest,
    );
  };
}
