/**
 * Parallax and decor-field math — pure, no Phaser.
 *
 * Everything on the space backdrop is screen-pinned and positioned from the
 * camera's *unwrapped* travel (see UnwrappedTravel), so layers tile forever
 * and never jump when the camera crosses the arena seam.
 */

import { createSeededRng } from "../../utils/random";
import type { DecorKind, MapTheme } from "./mapThemes";

/** Edge of the repeating decor field (px of parallax space). Larger than the widest view at the lowest zoom. */
export const DECOR_FIELD_PERIOD = 6144;
/** Procedural texture variants per decor kind (see decorAtlas.ts). */
export const DECOR_VARIANTS: Readonly<Record<DecorKind, number>> = {
  rock: 6,
  debris: 6,
  shard: 4,
};
/** Parallax factors of decor: 1 would move with the world, 0 is a fixed sky. */
export const DECOR_FACTOR_MIN = 0.22;
export const DECOR_FACTOR_MAX = 0.92;
/** The planet limb sits on a very slow layer. */
export const PLANET_FACTOR = 0.07;
/** The planet starts this far (px) from the screen centre: in view, but off to the side. */
const PLANET_START_DISTANCE_MIN = 380;
const PLANET_START_DISTANCE_SPAN = 260;
/** Vertical squash of the start offset (the screen is wider than tall). */
const PLANET_START_Y_SQUASH = 0.7;
/** Salts so decor, planet and textures draw independent random streams. */
const DECOR_SEED_SALT = 0x0dec0de5;

/** One decoration in the decor field. */
export interface DecorItem {
  readonly kind: DecorKind;
  readonly variant: number;
  /** Position in parallax space, 0..DECOR_FIELD_PERIOD. */
  readonly x: number;
  readonly y: number;
  /** Parallax factor (also drives size: nearer = larger). */
  readonly factor: number;
  /** Display scale of the 96 px atlas frame. */
  readonly scale: number;
  readonly rotation: number;
  /** Radians per second. */
  readonly spin: number;
  /** Drift in px per second (parallax space). */
  readonly driftX: number;
  readonly driftY: number;
  readonly tint: number;
  readonly alpha: number;
}

/** Offset of an item from the screen centre. */
export interface DecorOffset {
  x: number;
  y: number;
}

/** Base display scale and spin by kind. */
const KIND_SCALE: Readonly<Record<DecorKind, readonly [number, number]>> = {
  rock: [0.5, 1.7],
  debris: [0.35, 0.8],
  shard: [0.5, 1.2],
};
const MAX_DRIFT_PX_PER_SEC = 9;
const MAX_SPIN_RAD_PER_SEC = 0.25;
/** Nearer layers look bigger: scale multiplier range over the factor range. */
const DEPTH_SCALE_MIN = 0.45;
const DEPTH_SCALE_MAX = 1.15;

/**
 * @param value - Any number.
 * @param period - Wrap length (> 0).
 * @returns `value` wrapped into [−period/2, period/2).
 */
export function wrapSymmetric(value: number, period: number): number {
  const half = period / 2;
  return ((((value + half) % period) + period) % period) - half;
}

/**
 * @param travel - Unwrapped camera position on this axis.
 * @param factor - Layer parallax factor.
 * @param tileScale - On-screen size of one texture pixel.
 * @returns TileSprite tilePosition for the layer (unbounded; the renderer wraps it).
 */
export function tileOffset(
  travel: number,
  factor: number,
  tileScale: number,
): number {
  return (travel * factor) / tileScale;
}

/**
 * Generate a theme's decor field. Same theme + seed → identical field.
 *
 * @param theme - The map theme (counts and tints).
 * @param seed - Battle seed.
 * @returns Items sorted far → near (draw order).
 */
export function generateDecorField(
  theme: MapTheme,
  seed: number,
): DecorItem[] {
  const rng = createSeededRng((seed ^ DECOR_SEED_SALT) >>> 0);
  const items: DecorItem[] = [];
  const next = (): number => rng.next();
  const add = (kind: DecorKind, count: number, tint: number): void => {
    for (let i = 0; i < count; i++) items.push(buildItem(next, kind, tint));
  };
  add("rock", theme.rocks, theme.rockTint);
  add("debris", theme.debris, theme.debrisTint);
  add("shard", theme.shards, theme.shardTint);
  return items.sort((a, b) => a.factor - b.factor);
}

/** Draw one item from the random stream. */
function buildItem(next: () => number, kind: DecorKind, tint: number): DecorItem {
  const factor =
    DECOR_FACTOR_MIN + next() * (DECOR_FACTOR_MAX - DECOR_FACTOR_MIN);
  const depth = (factor - DECOR_FACTOR_MIN) / (DECOR_FACTOR_MAX - DECOR_FACTOR_MIN);
  const [minScale, maxScale] = KIND_SCALE[kind];
  const size = minScale + next() * (maxScale - minScale);
  const depthScale = DEPTH_SCALE_MIN + depth * (DEPTH_SCALE_MAX - DEPTH_SCALE_MIN);
  return {
    kind,
    variant: Math.floor(next() * DECOR_VARIANTS[kind]),
    x: next() * DECOR_FIELD_PERIOD,
    y: next() * DECOR_FIELD_PERIOD,
    factor,
    scale: size * depthScale,
    rotation: next() * Math.PI * 2,
    spin: (next() * 2 - 1) * MAX_SPIN_RAD_PER_SEC,
    driftX: (next() * 2 - 1) * MAX_DRIFT_PX_PER_SEC,
    driftY: (next() * 2 - 1) * MAX_DRIFT_PX_PER_SEC,
    tint,
    alpha: 0.55 + depth * 0.45,
  };
}

/**
 * Where an item sits relative to the screen centre right now.
 *
 * @param item - Decor item.
 * @param travelX - Unwrapped camera x.
 * @param travelY - Unwrapped camera y.
 * @param seconds - Scene time (drift).
 * @param out - Written in place.
 */
export function placeDecor(
  item: Pick<DecorItem, "x" | "y" | "factor" | "driftX" | "driftY">,
  travelX: number,
  travelY: number,
  seconds: number,
  out: DecorOffset,
): void {
  out.x = wrapSymmetric(
    item.x + item.driftX * seconds - travelX * item.factor,
    DECOR_FIELD_PERIOD,
  );
  out.y = wrapSymmetric(
    item.y + item.driftY * seconds - travelY * item.factor,
    DECOR_FIELD_PERIOD,
  );
}

/**
 * Starting position of a theme's planet so that it is on screen at the
 * start of the battle.
 *
 * @param seed - Battle seed.
 * @param travelX - Unwrapped camera x at the start.
 * @param travelY - Unwrapped camera y at the start.
 * @returns Parallax-space position of the planet.
 */
export function planetStart(
  seed: number,
  travelX: number,
  travelY: number,
): { x: number; y: number } {
  const rng = createSeededRng((seed ^ DECOR_SEED_SALT ^ 0x51a7) >>> 0);
  const angle = rng.next() * Math.PI * 2;
  const distance = PLANET_START_DISTANCE_MIN + rng.next() * PLANET_START_DISTANCE_SPAN;
  return {
    x: travelX * PLANET_FACTOR + Math.cos(angle) * distance,
    y: travelY * PLANET_FACTOR + Math.sin(angle) * distance * PLANET_START_Y_SQUASH,
  };
}
