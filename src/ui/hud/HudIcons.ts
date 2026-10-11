/**
 * Procedural HUD glyphs drawn into Phaser Graphics — icons instead of text,
 * no texture assets. Geometry is expressed as fractions of the icon size so
 * every glyph scales cleanly. Glyph functions only add draw commands; the
 * caller owns clear() and object lifetime.
 */

import type Phaser from "phaser";
import type { WeaponKind } from "./types";

type Graphics = Phaser.GameObjects.Graphics;

/** Laser: two parallel bolts above an emitter bar. */
const LASER = {
  boltOffset: 0.17,
  boltWidth: 0.08,
  boltTop: -0.4,
  boltLength: 0.58,
  baseWidth: 0.56,
  baseHeight: 0.08,
  baseY: 0.26,
} as const;
/** Missile / torpedo body proportions (torpedo is the fat variant). */
const MISSILE = {
  halfWidth: 0.07,
  top: -0.22,
  bottom: 0.3,
  noseTip: -0.42,
  finSpan: 0.18,
  finTop: 0.14,
} as const;
const TORPEDO = {
  halfWidth: 0.13,
  top: -0.18,
  bottom: 0.3,
  noseTip: -0.38,
  finSpan: 0.24,
  finTop: 0.16,
} as const;
/** Turret: ring base with an angled barrel. */
const TURRET = {
  baseY: 0.12,
  baseRadius: 0.22,
  ringWidth: 0.07,
  barrelTipX: 0.3,
  barrelTipY: -0.32,
  barrelWidth: 0.1,
} as const;
/** Bomb: round body, fuse and spark. */
const BOMB = {
  bodyY: 0.08,
  bodyRadius: 0.27,
  fuseX: 0.24,
  fuseY: -0.26,
  fuseWidth: 0.06,
  sparkRadius: 0.08,
} as const;
/** Mine: core with radial spikes. */
const MINE = {
  coreRadius: 0.19,
  spikeInner: 0.17,
  spikeOuter: 0.38,
  spikeWidth: 0.07,
  spikeCount: 8,
} as const;
/** Notched arrowhead pointing +x. */
const ARROW = { tip: 1, backX: -0.6, backY: 0.7, notchX: -0.2 } as const;
/** Locked-target reticle ring drawn around an arrow. */
const TARGET_BRACKET = {
  radius: 1.45,
  lineWidth: 1.5,
  dotRadius: 0.16,
} as const;
/** Radar blip: isosceles triangle pointing along its heading. */
const BLIP = { tip: 1.5, backX: 0.95, backY: 0.9 } as const;
const FULL_TURN = Math.PI * 2;

interface BodyShape {
  readonly halfWidth: number;
  readonly top: number;
  readonly bottom: number;
  readonly noseTip: number;
  readonly finSpan: number;
  readonly finTop: number;
}

function drawProjectile(
  g: Graphics,
  cx: number,
  cy: number,
  s: number,
  shape: BodyShape,
): void {
  const hw = shape.halfWidth * s;
  g.fillRect(
    cx - hw,
    cy + shape.top * s,
    hw * 2,
    (shape.bottom - shape.top) * s,
  );
  g.fillTriangle(
    cx - hw,
    cy + shape.top * s,
    cx + hw,
    cy + shape.top * s,
    cx,
    cy + shape.noseTip * s,
  );
  const finY = cy + shape.finTop * s;
  const baseY = cy + shape.bottom * s;
  g.fillTriangle(cx - hw, finY, cx - hw, baseY, cx - shape.finSpan * s, baseY);
  g.fillTriangle(cx + hw, finY, cx + hw, baseY, cx + shape.finSpan * s, baseY);
}

function drawLaser(g: Graphics, cx: number, cy: number, s: number): void {
  const w = LASER.boltWidth * s;
  for (const side of [-1, 1] as const) {
    g.fillRect(
      cx + side * LASER.boltOffset * s - w / 2,
      cy + LASER.boltTop * s,
      w,
      LASER.boltLength * s,
    );
  }
  g.fillRect(
    cx - (LASER.baseWidth * s) / 2,
    cy + LASER.baseY * s,
    LASER.baseWidth * s,
    LASER.baseHeight * s,
  );
}

function drawTurret(
  g: Graphics,
  cx: number,
  cy: number,
  s: number,
  color: number,
  alpha: number,
): void {
  const by = cy + TURRET.baseY * s;
  g.lineStyle(TURRET.ringWidth * s, color, alpha);
  g.strokeCircle(cx, by, TURRET.baseRadius * s);
  g.lineStyle(TURRET.barrelWidth * s, color, alpha);
  g.lineBetween(cx, by, cx + TURRET.barrelTipX * s, cy + TURRET.barrelTipY * s);
}

function drawBomb(
  g: Graphics,
  cx: number,
  cy: number,
  s: number,
  color: number,
  alpha: number,
): void {
  g.fillCircle(cx, cy + BOMB.bodyY * s, BOMB.bodyRadius * s);
  g.lineStyle(BOMB.fuseWidth * s, color, alpha);
  g.lineBetween(
    cx,
    cy + BOMB.bodyY * s,
    cx + BOMB.fuseX * s,
    cy + BOMB.fuseY * s,
  );
  g.fillCircle(cx + BOMB.fuseX * s, cy + BOMB.fuseY * s, BOMB.sparkRadius * s);
}

function drawMine(
  g: Graphics,
  cx: number,
  cy: number,
  s: number,
  color: number,
  alpha: number,
): void {
  g.fillCircle(cx, cy, MINE.coreRadius * s);
  g.lineStyle(MINE.spikeWidth * s, color, alpha);
  for (let i = 0; i < MINE.spikeCount; i++) {
    const a = (i / MINE.spikeCount) * FULL_TURN;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    g.lineBetween(
      cx + cos * MINE.spikeInner * s,
      cy + sin * MINE.spikeInner * s,
      cx + cos * MINE.spikeOuter * s,
      cy + sin * MINE.spikeOuter * s,
    );
  }
}

/**
 * Draw a weapon icon centred on (cx, cy).
 *
 * @param g - Target graphics.
 * @param kind - Weapon category.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param size - Icon box size in pixels.
 * @param color - Icon colour.
 * @param alpha - Icon opacity.
 */
export function drawWeaponIcon(
  g: Graphics,
  kind: WeaponKind,
  cx: number,
  cy: number,
  size: number,
  color: number,
  alpha: number,
): void {
  g.fillStyle(color, alpha);
  switch (kind) {
    case "primary":
      return drawLaser(g, cx, cy, size);
    case "missile":
      return drawProjectile(g, cx, cy, size, MISSILE);
    case "torpedo":
      return drawProjectile(g, cx, cy, size, TORPEDO);
    case "turret":
      return drawTurret(g, cx, cy, size, color, alpha);
    case "bomb":
      return drawBomb(g, cx, cy, size, color, alpha);
    case "mine":
      return drawMine(g, cx, cy, size, color, alpha);
  }
}

/**
 * Draw a notched arrowhead at the origin pointing +x (rotate the object to aim).
 *
 * @param g - Target graphics.
 * @param size - Distance from origin to tip.
 * @param color - Fill colour.
 */
export function drawArrowGlyph(g: Graphics, size: number, color: number): void {
  const tip = ARROW.tip * size;
  const backX = ARROW.backX * size;
  const backY = ARROW.backY * size;
  const notchX = ARROW.notchX * size;
  g.fillStyle(color, 1);
  g.fillTriangle(tip, 0, backX, -backY, notchX, 0);
  g.fillTriangle(tip, 0, notchX, 0, backX, backY);
}

/**
 * Draw the locked-target arrow: arrowhead inside a reticle ring. The ring is
 * rotation-invariant, so the glyph reads the same on every edge.
 *
 * @param g - Target graphics.
 * @param size - Arrow size.
 * @param color - Arrow (side) colour.
 * @param bracketColor - Target ring colour.
 */
export function drawTargetArrowGlyph(
  g: Graphics,
  size: number,
  color: number,
  bracketColor: number,
): void {
  drawArrowGlyph(g, size, color);
  g.lineStyle(TARGET_BRACKET.lineWidth, bracketColor, 1);
  g.strokeCircle(0, 0, TARGET_BRACKET.radius * size);
  g.fillStyle(bracketColor, 1);
  g.fillCircle(0, 0, TARGET_BRACKET.dotRadius * size);
}

/** Readout glyph geometry (fractions of icon size). */
const STAT = {
  chevronHalf: 0.32,
  chevronDepth: 0.22,
  chevronGap: 0.24,
  chevronWidth: 0.12,
  shieldRadius: 0.4,
  shieldSweep: 0.8,
  shieldWidth: 0.14,
  shieldDrop: 0.18,
  hullHalf: 0.32,
  hullCut: 0.14,
} as const;

/** Readout glyph categories. */
export type StatGlyph = "speed" | "shield" | "hull";

/**
 * Draw a small readout glyph centred on (cx, cy).
 *
 * @param g - Target graphics.
 * @param glyph - Which stat.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param size - Icon box size.
 * @param color - Glyph colour.
 */
export function drawStatGlyph(
  g: Graphics,
  glyph: StatGlyph,
  cx: number,
  cy: number,
  size: number,
  color: number,
): void {
  if (glyph === "speed") {
    g.lineStyle(STAT.chevronWidth * size, color, 1);
    for (const offset of [-STAT.chevronGap / 2, STAT.chevronGap / 2]) {
      const y = cy + offset * size;
      g.lineBetween(
        cx - STAT.chevronHalf * size,
        y + STAT.chevronDepth * size,
        cx,
        y,
      );
      g.lineBetween(
        cx,
        y,
        cx + STAT.chevronHalf * size,
        y + STAT.chevronDepth * size,
      );
    }
    return;
  }
  if (glyph === "shield") {
    const domeCenter = -Math.PI / 2;
    const halfSweep = (STAT.shieldSweep * Math.PI) / 2;
    g.lineStyle(STAT.shieldWidth * size, color, 1);
    g.beginPath();
    g.arc(
      cx,
      cy + STAT.shieldDrop * size,
      STAT.shieldRadius * size,
      domeCenter - halfSweep,
      domeCenter + halfSweep,
      false,
    );
    g.strokePath();
    return;
  }
  const h = STAT.hullHalf * size;
  const c = STAT.hullCut * size;
  g.fillStyle(color, 1);
  g.fillRect(cx - h, cy - h + c, h * 2, h * 2 - c);
  g.fillRect(cx - h + c, cy - h, h * 2 - c * 2, c);
}

/**
 * Stroke a diamond (square rotated 45°).
 *
 * @param g - Target graphics.
 * @param cx - Centre x.
 * @param cy - Centre y.
 * @param radius - Centre-to-vertex distance.
 * @param lineWidth - Stroke width.
 * @param color - Stroke colour.
 * @param alpha - Stroke opacity.
 */
export function drawDiamond(
  g: Graphics,
  cx: number,
  cy: number,
  radius: number,
  lineWidth: number,
  color: number,
  alpha: number,
): void {
  g.lineStyle(lineWidth, color, alpha);
  g.beginPath();
  g.moveTo(cx, cy - radius);
  g.lineTo(cx + radius, cy);
  g.lineTo(cx, cy + radius);
  g.lineTo(cx - radius, cy);
  g.closePath();
  g.strokePath();
}

/**
 * Fill a heading-oriented radar blip.
 *
 * @param g - Target graphics.
 * @param x - Centre x.
 * @param y - Centre y.
 * @param radius - Nominal blip radius.
 * @param headingRad - Heading in radians, 0 = up, clockwise.
 */
export function fillBlip(
  g: Graphics,
  x: number,
  y: number,
  radius: number,
  headingRad: number,
): void {
  const fx = Math.sin(headingRad);
  const fy = -Math.cos(headingRad);
  const back = BLIP.backX * radius;
  const wing = BLIP.backY * radius;
  g.fillTriangle(
    x + fx * BLIP.tip * radius,
    y + fy * BLIP.tip * radius,
    x - fx * back - fy * wing,
    y - fy * back + fx * wing,
    x - fx * back + fy * wing,
    y - fy * back - fx * wing,
  );
}
