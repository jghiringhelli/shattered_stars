/**
 * MenuIcons — procedural line glyphs for menus (no texture assets).
 *
 * Geometry is expressed as fractions of the icon size, centred on (cx, cy),
 * so glyphs scale cleanly. Drawers only add draw commands; the caller owns
 * the Graphics object and its clear().
 */

import Phaser from "phaser";

type Graphics = Phaser.GameObjects.Graphics;

/** Names of the available menu glyphs. */
export type MenuIconName =
  | "back"
  | "next"
  | "close"
  | "plus"
  | "gear"
  | "gamepad"
  | "book"
  | "star"
  | "network"
  | "crosshair"
  | "shield"
  | "fleet"
  | "crown"
  | "dogfight"
  | "duel"
  | "flag"
  | "speaker"
  | "eye"
  | "refresh"
  | "key"
  | "keyboard"
  | "touch";

/** Stroke width as a fraction of icon size (clamped to ≥ 1.5 px). */
const STROKE_FRACTION = 0.09;
const MIN_STROKE = 1.5;
const FULL_TURN = Math.PI * 2;
const GEAR_TEETH = 8;

/** Draw context handed to each glyph: unit u = size / 2. */
interface GlyphPen {
  readonly g: Graphics;
  readonly cx: number;
  readonly cy: number;
  readonly u: number;
}

/** Draw a polyline from unit-space points. */
function line(
  pen: GlyphPen,
  points: ReadonlyArray<readonly [number, number]>,
): void {
  const pts = points.map(
    ([x, y]) => new Phaser.Math.Vector2(pen.cx + x * pen.u, pen.cy + y * pen.u),
  );
  pen.g.strokePoints(pts, false);
}

/** Draw a closed, filled triangle from unit-space points. */
function tri(
  pen: GlyphPen,
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
): void {
  const { g, cx, cy, u } = pen;
  g.fillTriangle(
    cx + a[0] * u,
    cy + a[1] * u,
    cx + b[0] * u,
    cy + b[1] * u,
    cx + c[0] * u,
    cy + c[1] * u,
  );
}

function circle(pen: GlyphPen, x: number, y: number, r: number): void {
  pen.g.strokeCircle(pen.cx + x * pen.u, pen.cy + y * pen.u, r * pen.u);
}

function drawGear(pen: GlyphPen): void {
  circle(pen, 0, 0, 0.32);
  for (let i = 0; i < GEAR_TEETH; i++) {
    const a = (i / GEAR_TEETH) * FULL_TURN;
    line(pen, [
      [Math.cos(a) * 0.55, Math.sin(a) * 0.55],
      [Math.cos(a) * 0.85, Math.sin(a) * 0.85],
    ]);
  }
  circle(pen, 0, 0, 0.6);
}

function drawGamepad(pen: GlyphPen): void {
  const { g, cx, cy, u } = pen;
  g.strokeRoundedRect(cx - 0.85 * u, cy - 0.45 * u, 1.7 * u, 0.9 * u, 0.4 * u);
  line(pen, [
    [-0.55, 0],
    [-0.25, 0],
  ]);
  line(pen, [
    [-0.4, -0.15],
    [-0.4, 0.15],
  ]);
  g.fillCircle(cx + 0.35 * u, cy - 0.1 * u, 0.09 * u);
  g.fillCircle(cx + 0.55 * u, cy + 0.1 * u, 0.09 * u);
}

function drawStar(pen: GlyphPen): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 10; i++) {
    const r = i % 2 === 0 ? 0.85 : 0.36;
    const a = -Math.PI / 2 + (i / 10) * FULL_TURN;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  line(pen, pts);
}

function drawNetwork(pen: GlyphPen): void {
  const nodes: Array<[number, number]> = [
    [0, -0.6],
    [-0.6, 0.45],
    [0.6, 0.45],
  ];
  line(pen, [...nodes, nodes[0]!]);
  for (const [x, y] of nodes)
    pen.g.fillCircle(pen.cx + x * pen.u, pen.cy + y * pen.u, 0.2 * pen.u);
}

function drawShield(pen: GlyphPen): void {
  line(pen, [
    [0, -0.85],
    [0.7, -0.55],
    [0.6, 0.2],
    [0, 0.85],
    [-0.6, 0.2],
    [-0.7, -0.55],
    [0, -0.85],
  ]);
}

function drawKeyboard(pen: GlyphPen): void {
  const { g, cx, cy, u } = pen;
  const key = 0.14;
  g.strokeRoundedRect(cx - 0.9 * u, cy - 0.5 * u, 1.8 * u, u, 0.15 * u);
  for (const y of [-0.2, 0.05]) {
    for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) {
      g.fillRect(
        cx + (x - key / 2) * u,
        cy + (y - key / 2) * u,
        key * u,
        key * u,
      );
    }
  }
  line(pen, [
    [-0.4, 0.3],
    [0.4, 0.3],
  ]);
}

function drawRefresh(pen: GlyphPen): void {
  const { g, cx, cy, u } = pen;
  g.beginPath();
  g.arc(cx, cy, 0.6 * u, -Math.PI * 0.35, Math.PI * 1.35, false);
  g.strokePath();
  tri(pen, [0.25, -0.85], [0.75, -0.6], [0.3, -0.3]);
}

/** Glyph drawers, keyed by name. */
const GLYPHS: Readonly<Record<MenuIconName, (pen: GlyphPen) => void>> = {
  back: (p) =>
    line(p, [
      [0.35, -0.7],
      [-0.35, 0],
      [0.35, 0.7],
    ]),
  next: (p) =>
    line(p, [
      [-0.35, -0.7],
      [0.35, 0],
      [-0.35, 0.7],
    ]),
  close: (p) => {
    line(p, [
      [-0.6, -0.6],
      [0.6, 0.6],
    ]);
    line(p, [
      [0.6, -0.6],
      [-0.6, 0.6],
    ]);
  },
  plus: (p) => {
    line(p, [
      [0, -0.7],
      [0, 0.7],
    ]);
    line(p, [
      [-0.7, 0],
      [0.7, 0],
    ]);
  },
  gear: drawGear,
  gamepad: drawGamepad,
  book: (p) => {
    line(p, [
      [0, -0.55],
      [-0.8, -0.75],
      [-0.8, 0.6],
      [0, 0.8],
      [0.8, 0.6],
      [0.8, -0.75],
      [0, -0.55],
      [0, 0.8],
    ]);
  },
  star: drawStar,
  network: drawNetwork,
  crosshair: (p) => {
    circle(p, 0, 0, 0.55);
    line(p, [
      [0, -0.9],
      [0, -0.3],
    ]);
    line(p, [
      [0, 0.3],
      [0, 0.9],
    ]);
    line(p, [
      [-0.9, 0],
      [-0.3, 0],
    ]);
    line(p, [
      [0.3, 0],
      [0.9, 0],
    ]);
  },
  shield: drawShield,
  fleet: (p) => {
    tri(p, [0, -0.8], [0.3, -0.2], [-0.3, -0.2]);
    tri(p, [-0.5, 0.05], [-0.2, 0.65], [-0.8, 0.65]);
    tri(p, [0.5, 0.05], [0.8, 0.65], [0.2, 0.65]);
  },
  crown: (p) =>
    line(p, [
      [-0.8, 0.55],
      [-0.8, -0.45],
      [-0.4, 0],
      [0, -0.7],
      [0.4, 0],
      [0.8, -0.45],
      [0.8, 0.55],
      [-0.8, 0.55],
    ]),
  dogfight: (p) => {
    tri(p, [-0.15, -0.55], [-0.85, -0.2], [-0.85, -0.9]);
    tri(p, [0.85, 0.55], [0.15, 0.9], [0.15, 0.2]);
  },
  duel: (p) => {
    tri(p, [-0.15, 0], [-0.85, 0.4], [-0.85, -0.4]);
    tri(p, [0.15, 0], [0.85, -0.4], [0.85, 0.4]);
  },
  flag: (p) => {
    line(p, [
      [-0.6, 0.85],
      [-0.6, -0.85],
    ]);
    line(p, [
      [-0.6, -0.8],
      [0.7, -0.55],
      [-0.6, -0.1],
    ]);
  },
  speaker: (p) => {
    line(p, [
      [-0.8, -0.3],
      [-0.4, -0.3],
      [0.1, -0.75],
      [0.1, 0.75],
      [-0.4, 0.3],
      [-0.8, 0.3],
      [-0.8, -0.3],
    ]);
    line(p, [
      [0.45, -0.35],
      [0.6, 0],
      [0.45, 0.35],
    ]);
  },
  eye: (p) => {
    line(p, [
      [-0.9, 0],
      [-0.45, -0.45],
      [0, -0.55],
      [0.45, -0.45],
      [0.9, 0],
      [0.45, 0.45],
      [0, 0.55],
      [-0.45, 0.45],
      [-0.9, 0],
    ]);
    p.g.fillCircle(p.cx, p.cy, 0.22 * p.u);
  },
  refresh: drawRefresh,
  key: (p) => {
    circle(p, -0.45, 0, 0.32);
    line(p, [
      [-0.13, 0],
      [0.85, 0],
      [0.85, 0.3],
    ]);
    line(p, [
      [0.5, 0],
      [0.5, 0.3],
    ]);
  },
  keyboard: drawKeyboard,
  touch: (p) => {
    p.g.fillCircle(p.cx, p.cy, 0.22 * p.u);
    circle(p, 0, 0, 0.5);
    circle(p, 0, 0, 0.85);
  },
};

/**
 * Draw a menu glyph centred on (cx, cy).
 *
 * @param g - Target graphics.
 * @param name - Glyph name.
 * @param center - Centre point in the graphics' local space.
 * @param size - Icon box size in pixels.
 * @param color - Stroke / fill colour.
 */
export function drawMenuIcon(
  g: Graphics,
  name: MenuIconName,
  center: { readonly x: number; readonly y: number },
  size: number,
  color: number,
): void {
  g.lineStyle(Math.max(MIN_STROKE, size * STROKE_FRACTION), color, 1);
  g.fillStyle(color, 1);
  GLYPHS[name]({ g, cx: center.x, cy: center.y, u: size / 2 });
}

/**
 * Create a standalone Graphics holding one glyph at (x, y).
 *
 * @param scene - Owning scene.
 * @param name - Glyph name.
 * @param position - Centre in scene / parent space.
 * @param size - Icon box size in pixels.
 * @param color - Glyph colour.
 * @returns The graphics object (already on the display list).
 */
export function createMenuIcon(
  scene: Phaser.Scene,
  name: MenuIconName,
  position: { readonly x: number; readonly y: number },
  size: number,
  color: number,
): Graphics {
  const g = scene.add.graphics({ x: position.x, y: position.y });
  drawMenuIcon(g, name, { x: 0, y: 0 }, size, color);
  return g;
}
