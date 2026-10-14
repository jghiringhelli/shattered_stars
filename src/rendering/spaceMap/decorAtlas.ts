/**
 * Procedural decoration sprites: grayscale rocks, debris and crystal shards
 * in one atlas (tinted per theme at draw time) plus planet textures. Drawn
 * once from a fixed seed — the atlas is identical in every battle.
 */

import Phaser from "phaser";
import { createSeededRng, type RandomGenerator } from "../../utils/random";
import type { DecorKind, PlanetKind } from "./mapThemes";
import { DECOR_VARIANTS } from "./parallaxMath";
import { rgba, shade, softBlob } from "./canvasDraw";

/** Texture key of the shared decor atlas. */
export const DECOR_ATLAS_KEY = "space_decor_atlas";
/** Edge of one atlas cell (px). */
export const DECOR_CELL_PX = 96;
/** Planet texture edge (px). */
export const PLANET_TEXTURE_PX = 256;
const ATLAS_SEED = 0x5a7e11;
const ROW: Readonly<Record<DecorKind, number>> = { rock: 0, debris: 1, shard: 2 };

/** @returns The atlas frame name of a decor sprite. */
export function decorFrame(kind: DecorKind, variant: number): string {
  return `${kind}_${variant}`;
}

function rockPath(ctx: CanvasRenderingContext2D, rng: RandomGenerator, r: number): void {
  const points = 11 + Math.floor(rng.next() * 4);
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const radius = r * (0.68 + rng.next() * 0.32);
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius * 0.88;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawRock(ctx: CanvasRenderingContext2D, rng: RandomGenerator): void {
  const r = DECOR_CELL_PX * 0.44;
  rockPath(ctx, rng, r);
  const gradient = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
  gradient.addColorStop(0, "#d8d8d8");
  gradient.addColorStop(0.55, "#8a8a8a");
  gradient.addColorStop(1, "#303030");
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const craters = 2 + Math.floor(rng.next() * 3);
  for (let i = 0; i < craters; i++) {
    const cx = (rng.next() - 0.5) * r;
    const cy = (rng.next() - 0.5) * r * 0.8;
    const cr = r * (0.1 + rng.next() * 0.16);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx - 0.6, cy - 0.6, cr, Math.PI * 0.9, Math.PI * 1.7);
    ctx.stroke();
  }
}

type DebrisShape = (ctx: CanvasRenderingContext2D, rng: RandomGenerator) => void;

const DEBRIS_SHAPES: readonly DebrisShape[] = [
  (ctx, rng) => polygon(ctx, [[-30, -18], [26, -24], [32, 16], [-22, 26]], rng),
  (ctx) => girder(ctx),
  (ctx, rng) => polygon(ctx, [[-30, 24], [0, -30], [30, 18]], rng),
  (ctx) => tank(ctx),
  (ctx, rng) => polygon(ctx, [[-32, -6], [-10, -26], [20, -20], [30, 4], [8, 8], [-4, 28]], rng),
  (ctx, rng) => polygon(ctx, [[-34, -10], [30, -16], [34, -2], [-28, 14]], rng),
];

function plate(ctx: CanvasRenderingContext2D, light = "#b8bcc4", dark = "#4a4e58"): void {
  const gradient = ctx.createLinearGradient(-30, -30, 30, 30);
  gradient.addColorStop(0, light);
  gradient.addColorStop(1, dark);
  ctx.fillStyle = gradient;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
}

function polygon(
  ctx: CanvasRenderingContext2D,
  corners: ReadonlyArray<readonly [number, number]>,
  rng: RandomGenerator,
): void {
  ctx.beginPath();
  corners.forEach(([x, y], i) => {
    const jx = x + (rng.next() - 0.5) * 6;
    const jy = y + (rng.next() - 0.5) * 6;
    if (i === 0) ctx.moveTo(jx, jy);
    else ctx.lineTo(jx, jy);
  });
  ctx.closePath();
  plate(ctx);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.moveTo(corners[0]![0] + 4, corners[0]![1] + 4);
  ctx.lineTo(corners[1]![0] - 4, corners[1]![1] + 4);
  ctx.stroke();
}

function girder(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.rect(-40, -7, 80, 14);
  plate(ctx);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  for (let x = -40; x < 40; x += 14) {
    ctx.moveTo(x, -7);
    ctx.lineTo(x + 14, 7);
    ctx.moveTo(x + 14, -7);
    ctx.lineTo(x, 7);
  }
  ctx.stroke();
}

function tank(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.roundRect(-30, -14, 60, 28, 12);
  plate(ctx, "#c8ccd4", "#3c4050");
  ctx.fillStyle = "rgba(255,160,60,0.55)";
  ctx.fillRect(-4, -14, 8, 28);
}

function drawShard(ctx: CanvasRenderingContext2D, rng: RandomGenerator): void {
  const h = 38 + rng.next() * 6;
  const w = 12 + rng.next() * 8;
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(w, -h * 0.25);
  ctx.lineTo(w * 0.65, h * 0.8);
  ctx.lineTo(-w * 0.2, h);
  ctx.lineTo(-w, h * 0.1);
  ctx.lineTo(-w * 0.6, -h * 0.4);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(-w, -h, w, h);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.5, "rgba(210,210,230,0.7)");
  gradient.addColorStop(1, "rgba(120,120,150,0.5)");
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(w * 0.1, h * 0.9);
  ctx.stroke();
}

/**
 * Create the shared decor atlas if it does not exist yet.
 *
 * @param scene - Any scene (the texture manager is global).
 */
export function ensureDecorAtlas(scene: Phaser.Scene): void {
  if (scene.textures.exists(DECOR_ATLAS_KEY)) return;
  const columns = Math.max(...Object.values(DECOR_VARIANTS));
  const texture = scene.textures.createCanvas(
    DECOR_ATLAS_KEY,
    columns * DECOR_CELL_PX,
    3 * DECOR_CELL_PX,
  )!;
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  const ctx = texture.getContext();
  const rng = createSeededRng(ATLAS_SEED);
  const draw: Record<DecorKind, (variant: number) => void> = {
    rock: () => drawRock(ctx, rng),
    debris: (variant) => DEBRIS_SHAPES[variant]!(ctx, rng),
    shard: () => drawShard(ctx, rng),
  };
  for (const kind of Object.keys(DECOR_VARIANTS) as DecorKind[]) {
    for (let variant = 0; variant < DECOR_VARIANTS[kind]; variant++) {
      const x = variant * DECOR_CELL_PX;
      const y = ROW[kind] * DECOR_CELL_PX;
      ctx.save();
      ctx.translate(x + DECOR_CELL_PX / 2, y + DECOR_CELL_PX / 2);
      draw[kind](variant);
      ctx.restore();
      texture.add(decorFrame(kind, variant), 0, x, y, DECOR_CELL_PX, DECOR_CELL_PX);
    }
  }
  texture.refresh();
}

/**
 * Draw a planet (lit from the upper left, soft atmosphere) into a canvas
 * texture.
 *
 * @param scene - Owning scene.
 * @param key - Texture key to create (replaced if present).
 * @param kind - Planet flavour.
 * @param color - Base colour.
 */
export function createPlanetTexture(
  scene: Phaser.Scene,
  key: string,
  kind: PlanetKind,
  color: number,
): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const size = PLANET_TEXTURE_PX;
  const texture = scene.textures.createCanvas(key, size, size)!;
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  const ctx = texture.getContext();
  const c = size / 2;
  const radius = kind === "ringed" ? size * 0.27 : size * 0.4;
  softBlob(ctx, c, c, radius * 1.25, color, 0.25);
  if (kind === "ringed") drawRing(ctx, c, radius, color, true);
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, radius, 0, Math.PI * 2);
  ctx.clip();
  const body = ctx.createRadialGradient(c - radius * 0.4, c - radius * 0.4, radius * 0.1, c, c, radius * 1.15);
  body.addColorStop(0, rgba(shade(color, 1.35), 1));
  body.addColorStop(0.55, rgba(color, 1));
  body.addColorStop(1, rgba(shade(color, 0.12), 1));
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, size, size);
  if (kind === "gas" || kind === "ringed") drawBands(ctx, c, radius, color);
  ctx.restore();
  if (kind === "ringed") drawRing(ctx, c, radius, color, false);
  texture.refresh();
}

function drawBands(ctx: CanvasRenderingContext2D, c: number, r: number, color: number): void {
  for (let i = 0; i < 9; i++) {
    const y = c - r + (i / 9) * r * 2;
    ctx.fillStyle = rgba(shade(color, i % 2 === 0 ? 0.7 : 1.25), 0.22);
    ctx.fillRect(c - r, y, r * 2, (r * 2) / 14);
  }
}

function drawRing(
  ctx: CanvasRenderingContext2D,
  c: number,
  r: number,
  color: number,
  backHalf: boolean,
): void {
  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(-0.35);
  ctx.scale(1, 0.28);
  ctx.strokeStyle = rgba(shade(color, 1.1), 0.7);
  ctx.lineWidth = r * 0.22;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.6, backHalf ? Math.PI : 0, backHalf ? Math.PI * 2 : Math.PI);
  ctx.stroke();
  ctx.lineWidth = r * 0.08;
  ctx.strokeStyle = rgba(shade(color, 0.7), 0.6);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.38, backHalf ? Math.PI : 0, backHalf ? Math.PI * 2 : Math.PI);
  ctx.stroke();
  ctx.restore();
}
