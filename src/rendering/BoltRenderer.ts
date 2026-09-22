/**
 * BoltRenderer — the look of every projectile in flight.
 *
 * Projectiles used to be drawn inline at each fire site: a flat 10x34
 * rectangle for cannon bolts and a flat disc for ordnance. Both read as bare
 * geometry. These helpers give every projectile the same four-layer build —
 * outer glow, bright rim, saturated body, hot white core — so bolts look
 * rounded and rimmed instead of like filled primitives.
 *
 * Pure drawing: takes a Graphics to draw into, owns no state, creates nothing.
 */

import type Phaser from "phaser";

/** Additive spread of the outer glow beyond the bolt body, in pixels. */
const GLOW_SPREAD_PX = 5;
/** Opacity of the outer glow. Low enough to read as light bleed, not mass. */
const GLOW_ALPHA = 0.2;
/** Opacity of the saturated body between the rim and the core. */
const BODY_ALPHA = 0.92;
/** Stroke width of the bright rim that outlines the bolt. */
const RIM_WIDTH_PX = 2;
/** Opacity of the rim stroke. */
const RIM_ALPHA = 0.95;
/** Core width as a fraction of total bolt width. */
const CORE_WIDTH_RATIO = 0.36;
/** Opacity of the hot white core. */
const CORE_ALPHA = 0.85;
/** How far the rim colour is pushed toward white, 0–1. */
const RIM_LIGHTEN = 0.55;
/** Core radius as a fraction of an orb's radius. */
const ORB_CORE_RATIO = 0.45;
/** Glow radius as a multiple of an orb's radius. */
const ORB_GLOW_RATIO = 2.1;

/** Pure white, used for the hot core of every projectile. */
const WHITE = 0xffffff;

/** Length of a standard ship cannon bolt along its travel axis, in pixels. */
export const CANNON_BOLT_LENGTH_PX = 30;
/** Width of a standard ship cannon bolt across its travel axis, in pixels. */
export const CANNON_BOLT_WIDTH_PX = 9;

/**
 * Blends a colour toward white.
 *
 * The rim has to stay recognisably the weapon's colour while reading as a
 * lit edge, so it is the body colour lightened rather than a second hue.
 *
 * @param color - Base RGB colour, 0xRRGGBB.
 * @param amount - How far to push toward white, 0 (unchanged) to 1 (white).
 * @returns The blended colour as 0xRRGGBB.
 */
export function lighten(color: number, amount: number): number {
  const clamped = Math.min(1, Math.max(0, amount));
  const blend = (channel: number): number =>
    Math.round(channel + (0xff - channel) * clamped);
  const red = blend((color >> 16) & 0xff);
  const green = blend((color >> 8) & 0xff);
  const blue = blend(color & 0xff);
  return (red << 16) | (green << 8) | blue;
}

/** Geometry and colour of an elongated cannon bolt. */
export interface BoltStyle {
  /** Body colour, 0xRRGGBB. */
  readonly color: number;
  /** Bolt length along its travel axis, in pixels. */
  readonly length: number;
  /** Bolt width across its travel axis, in pixels. */
  readonly width: number;
}

/**
 * Draws a rounded, rimmed energy bolt centred on the Graphics origin and
 * pointing along −Y, matching the sprite-angle convention used for ships.
 *
 * Each layer is a stadium (a rounded rect whose corner radius is half its
 * width), so the bolt has no square corners at any size.
 *
 * @param graphics - Graphics to draw into. Not cleared first.
 * @param style - Bolt colour and dimensions.
 */
export function drawEnergyBolt(
  graphics: Phaser.GameObjects.Graphics,
  style: BoltStyle,
): void {
  const { color, length, width } = style;
  const rimColor = lighten(color, RIM_LIGHTEN);

  const stadium = (w: number, h: number): [number, number, number, number] => [
    -w / 2,
    -h / 2,
    w,
    h,
  ];

  const glowWidth = width + GLOW_SPREAD_PX * 2;
  const glowLength = length + GLOW_SPREAD_PX * 2;
  graphics.fillStyle(color, GLOW_ALPHA);
  graphics.fillRoundedRect(
    ...stadium(glowWidth, glowLength),
    Math.min(glowWidth, glowLength) / 2,
  );

  graphics.fillStyle(color, BODY_ALPHA);
  graphics.fillRoundedRect(
    ...stadium(width, length),
    Math.min(width, length) / 2,
  );

  graphics.lineStyle(RIM_WIDTH_PX, rimColor, RIM_ALPHA);
  graphics.strokeRoundedRect(
    ...stadium(width, length),
    Math.min(width, length) / 2,
  );

  const coreWidth = width * CORE_WIDTH_RATIO;
  const coreLength = length - width;
  graphics.fillStyle(WHITE, CORE_ALPHA);
  graphics.fillRoundedRect(
    ...stadium(coreWidth, coreLength),
    Math.min(coreWidth, coreLength) / 2,
  );
}

/** Geometry and colour of a round projectile (missile, bomb, turret pulse). */
export interface OrbStyle {
  /** Body colour, 0xRRGGBB. */
  readonly color: number;
  /** Body radius in pixels. */
  readonly radius: number;
}

/**
 * Draws a rimmed glowing orb centred on the Graphics origin, for projectiles
 * with no travel axis to align to.
 *
 * @param graphics - Graphics to draw into. Not cleared first.
 * @param style - Orb colour and radius.
 */
export function drawEnergyOrb(
  graphics: Phaser.GameObjects.Graphics,
  style: OrbStyle,
): void {
  const { color, radius } = style;

  graphics.fillStyle(color, GLOW_ALPHA);
  graphics.fillCircle(0, 0, radius * ORB_GLOW_RATIO);

  graphics.fillStyle(color, BODY_ALPHA);
  graphics.fillCircle(0, 0, radius);

  graphics.lineStyle(RIM_WIDTH_PX, lighten(color, RIM_LIGHTEN), RIM_ALPHA);
  graphics.strokeCircle(0, 0, radius);

  graphics.fillStyle(WHITE, CORE_ALPHA);
  graphics.fillCircle(0, 0, radius * ORB_CORE_RATIO);
}
