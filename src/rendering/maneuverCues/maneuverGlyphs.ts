/**
 * maneuverGlyphs — the five cue glyphs drawn with plain Graphics strokes:
 * hairpin (Snap Turn), open loop (Hook Loop), blade (Knife Roll), double
 * chevron (Boost) and ring-with-arrow (Barrel Roll). Shapes differ, so a cue
 * never relies on colour alone; sided glyphs mirror for the left. Only
 * called while a cue is visible, so the small closures cost nothing at rest.
 */

import type Phaser from "phaser";
import type { ManeuverCueSide, ManeuverGlyph } from "./maneuverCueMath";

/** Where and how a glyph is drawn. */
export interface GlyphSpec {
  readonly glyph: ManeuverGlyph;
  readonly side: ManeuverCueSide;
  /** Centre in world px. */
  readonly x: number;
  readonly y: number;
  /** Half-extent in world px. */
  readonly size: number;
  readonly color: number;
  readonly alpha: number;
  /** Stroke width in world px. */
  readonly lineWidth: number;
}

const DEG_TO_RAD = Math.PI / 180;
const ARROW_HEAD_UNITS = 0.32;
const ARROW_HEAD_HALF_ANGLE = 0.5;
const LOOP_RADIUS_UNITS = 0.5;
const LOOP_START_DEG = 90;
const LOOP_SWEEP_DEG = 300;
const LOOP_STEPS = 18;

/**
 * Draw one glyph.
 *
 * @param g - Graphics to draw on (world coordinates; not cleared here).
 * @param spec - Glyph, side, position, size and style.
 */
export function drawCueGlyph(
  g: Phaser.GameObjects.Graphics,
  spec: GlyphSpec,
): void {
  g.lineStyle(spec.lineWidth, spec.color, spec.alpha);
  const mirror = spec.side === "left" ? -1 : 1;
  const at = (u: number, v: number): [number, number] => [
    spec.x + u * mirror * spec.size,
    spec.y + v * spec.size,
  ];
  g.beginPath();
  if (spec.glyph === "hairpin") hairpin(g, at, spec);
  else if (spec.glyph === "loop") loop(g, at);
  else if (spec.glyph === "blade") blade(g, at);
  else if (spec.glyph === "chevrons") chevrons(g, at);
  else ringArrow(g, at, spec);
  g.strokePath();
}

type Place = (u: number, v: number) => [number, number];

function line(g: Phaser.GameObjects.Graphics, from: [number, number], to: [number, number]): void {
  g.moveTo(from[0], from[1]);
  g.lineTo(to[0], to[1]);
}

/** Two short strokes closing an arrow tip at `tip` heading (dirU, dirV). */
function arrowHead(
  g: Phaser.GameObjects.Graphics,
  at: Place,
  tip: { readonly u: number; readonly v: number; readonly dirU: number; readonly dirV: number },
): void {
  for (const sign of [-1, 1]) {
    const turn = sign * ARROW_HEAD_HALF_ANGLE;
    const backU = -(tip.dirU * Math.cos(turn) - tip.dirV * Math.sin(turn));
    const backV = -(tip.dirU * Math.sin(turn) + tip.dirV * Math.cos(turn));
    line(
      g,
      at(tip.u, tip.v),
      at(tip.u + backU * ARROW_HEAD_UNITS, tip.v + backV * ARROW_HEAD_UNITS),
    );
  }
}

function hairpin(g: Phaser.GameObjects.Graphics, at: Place, spec: GlyphSpec): void {
  const [cx, cy] = at(0, -0.1);
  g.moveTo(...at(-0.5, 0.9));
  g.lineTo(...at(-0.5, -0.1));
  g.arc(cx, cy, 0.5 * spec.size, Math.PI, Math.PI * 2, false);
  g.lineTo(...at(0.5, 0.9));
  arrowHead(g, at, { u: 0.5, v: 0.9, dirU: 0, dirV: 1 });
}

function loop(g: Phaser.GameObjects.Graphics, at: Place): void {
  const centreV = -0.2;
  g.moveTo(...at(0, 0.95));
  g.lineTo(...at(0, centreV + LOOP_RADIUS_UNITS));
  for (let i = 1; i <= LOOP_STEPS; i++) {
    const theta = (LOOP_START_DEG + (LOOP_SWEEP_DEG * i) / LOOP_STEPS) * DEG_TO_RAD;
    g.lineTo(
      ...at(
        Math.cos(theta) * LOOP_RADIUS_UNITS,
        centreV + Math.sin(theta) * LOOP_RADIUS_UNITS,
      ),
    );
  }
  const end = (LOOP_START_DEG + LOOP_SWEEP_DEG) * DEG_TO_RAD;
  arrowHead(g, at, {
    u: Math.cos(end) * LOOP_RADIUS_UNITS,
    v: centreV + Math.sin(end) * LOOP_RADIUS_UNITS,
    dirU: -Math.sin(end),
    dirV: Math.cos(end),
  });
}

function blade(g: Phaser.GameObjects.Graphics, at: Place): void {
  g.moveTo(...at(0, -0.95));
  g.lineTo(...at(0.42, 0));
  g.lineTo(...at(0, 0.95));
  g.lineTo(...at(-0.42, 0));
  g.closePath();
  line(g, at(-0.9, 0.55), at(0.9, -0.55));
}

function chevrons(g: Phaser.GameObjects.Graphics, at: Place): void {
  for (const v of [0.1, 0.8]) {
    g.moveTo(...at(-0.6, v));
    g.lineTo(...at(0, v - 0.6));
    g.lineTo(...at(0.6, v));
  }
}

function ringArrow(g: Phaser.GameObjects.Graphics, at: Place, spec: GlyphSpec): void {
  const [cx, cy] = at(0, 0);
  g.moveTo(cx + 0.42 * spec.size, cy);
  g.arc(cx, cy, 0.42 * spec.size, 0, Math.PI * 2, false);
  line(g, at(-0.95, 0), at(0.95, 0));
  arrowHead(g, at, { u: 0.95, v: 0, dirU: 1, dirV: 0 });
}
