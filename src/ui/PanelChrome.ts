/**
 * Procedural sci-fi panel chrome.
 *
 * Drawn with Graphics rather than stretched from a bitmap. A panel has to
 * work at 120x40 and at 900x200, and a fixed-size PNG pushed through
 * `setDisplaySize` smears its bevels and edge accents at every size that is
 * not the one it was authored at.
 *
 * The shape is an angled-corner rectangle — the cut corners read as machined
 * plate and match the angular language of the title frame art.
 */

/** Length of the 45-degree cut taken out of each corner, in pixels. */
export const CORNER_CUT = 14;

/** Interior fill of an idle panel. */
const IDLE_FILL = 0x0a1620;
/** Interior fill of the selected panel — lifted, not a different hue. */
const SELECTED_FILL = 0x123048;
/** Edge accent of an idle panel. */
const IDLE_EDGE = 0x2c4a63;
/** Edge accent of the selected panel. */
const SELECTED_EDGE = 0x44ccff;

const IDLE_EDGE_WIDTH = 1;
const SELECTED_EDGE_WIDTH = 2;

/**
 * The Graphics surface `drawPanelChrome` writes to.
 *
 * Declared structurally rather than as `Phaser.GameObjects.Graphics` so the
 * drawing can be verified without standing up a renderer.
 */
export interface ChromeTarget {
  clear(): this;
  fillStyle(color: number, alpha?: number): this;
  lineStyle(width: number, color: number, alpha?: number): this;
  beginPath(): this;
  closePath(): this;
  moveTo(x: number, y: number): this;
  lineTo(x: number, y: number): this;
  fillPath(): this;
  strokePath(): this;
}

/** How a panel should be drawn. */
export interface PanelChromeOptions {
  /** Panel width in pixels. */
  readonly width: number;
  /** Panel height in pixels. */
  readonly height: number;
  /** Whether to draw the highlighted state. */
  readonly selected: boolean;
}

/**
 * The eight corners of an angled-corner rectangle centred on the origin.
 *
 * The cut is clamped to a third of the shorter side so a short panel bevels
 * proportionally instead of the corners meeting in the middle.
 *
 * @param width - Panel width.
 * @param height - Panel height.
 * @returns Path points in draw order.
 */
function chromeOutline(
  width: number,
  height: number,
): ReadonlyArray<readonly [number, number]> {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const cut = Math.min(CORNER_CUT, Math.min(width, height) / 3);

  return [
    [-halfWidth + cut, -halfHeight],
    [halfWidth - cut, -halfHeight],
    [halfWidth, -halfHeight + cut],
    [halfWidth, halfHeight - cut],
    [halfWidth - cut, halfHeight],
    [-halfWidth + cut, halfHeight],
    [-halfWidth, halfHeight - cut],
    [-halfWidth, -halfHeight + cut],
  ];
}

/**
 * Trace an outline onto the target as a closed path.
 *
 * @param target - Graphics surface.
 * @param outline - Points to trace.
 */
function tracePath(
  target: ChromeTarget,
  outline: ReadonlyArray<readonly [number, number]>,
): void {
  target.beginPath();
  const [first, ...rest] = outline;
  target.moveTo(first![0], first![1]);
  for (const [x, y] of rest) {
    target.lineTo(x, y);
  }
  target.closePath();
}

/**
 * Draw a panel's background and frame centred on the target's origin.
 *
 * Clears the target first, so it is safe to call every time selection state
 * changes without stacking overdraw.
 *
 * @param target - Graphics surface to draw into.
 * @param options - Panel size and state.
 */
export function drawPanelChrome(
  target: ChromeTarget,
  options: PanelChromeOptions,
): void {
  const { width, height, selected } = options;
  const outline = chromeOutline(width, height);

  target.clear();

  target.fillStyle(selected ? SELECTED_FILL : IDLE_FILL, selected ? 0.95 : 0.8);
  tracePath(target, outline);
  target.fillPath();

  target.lineStyle(
    selected ? SELECTED_EDGE_WIDTH : IDLE_EDGE_WIDTH,
    selected ? SELECTED_EDGE : IDLE_EDGE,
    1,
  );
  tracePath(target, outline);
  target.strokePath();
}
