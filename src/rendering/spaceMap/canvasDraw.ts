/**
 * Canvas drawing helpers shared by the procedural space textures.
 */

/** @returns A CSS colour string for a 0xRRGGBB colour and alpha. */
export function rgba(color: number, alpha: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Scale a colour's brightness.
 *
 * @param color - 0xRRGGBB.
 * @param factor - 1 = same, <1 darker, >1 lighter (clamped per channel).
 * @returns The new 0xRRGGBB colour.
 */
export function shade(color: number, factor: number): number {
  const scale = (channel: number): number =>
    Math.max(0, Math.min(255, Math.round(channel * factor)));
  return (
    (scale((color >> 16) & 0xff) << 16) |
    (scale((color >> 8) & 0xff) << 8) |
    scale(color & 0xff)
  );
}

/**
 * Call `draw` once at (x, y) and again at every wrapped offset where a
 * shape of `radius` crosses the edge of a `size`×`size` tile, so tiles join
 * without seams.
 *
 * @param size - Tile edge (px).
 * @param x - Shape centre x.
 * @param y - Shape centre y.
 * @param radius - Shape half-extent.
 * @param draw - Draws the shape centred at the given point.
 */
export function drawWrapped(
  size: number,
  x: number,
  y: number,
  radius: number,
  draw: (cx: number, cy: number) => void,
): void {
  const xs = x - radius < 0 ? [x, x + size] : x + radius > size ? [x, x - size] : [x];
  const ys = y - radius < 0 ? [y, y + size] : y + radius > size ? [y, y - size] : [y];
  for (const cx of xs) for (const cy of ys) draw(cx, cy);
}

/**
 * Fill a soft round blob (alpha fades to 0 at the rim).
 *
 * @param ctx - Canvas context.
 * @param x - Centre x.
 * @param y - Centre y.
 * @param radius - Blob radius.
 * @param color - 0xRRGGBB.
 * @param alpha - Peak alpha at the centre.
 */
export function softBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha: number,
): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, rgba(color, alpha));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Cross-blend an image tile with copies of itself shifted by half a tile, so
 * the result wraps without a seam and without the mirror symmetry of a
 * flipped tiling. At the tile edge only the shifted copy is shown (it is
 * continuous across the wrap); at the centre only the original.
 *
 * @param source - RGBA pixels of a square tile.
 * @param size - Tile edge in px.
 * @param out - Destination RGBA pixels (same size).
 */
export function blendSeamless(
  source: Uint8ClampedArray,
  size: number,
  out: Uint8ClampedArray,
): void {
  const half = size / 2;
  const weight = new Float32Array(size);
  for (let i = 0; i < size; i++) weight[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
  for (let y = 0; y < size; y++) {
    const y2 = (y + half) % size;
    for (let x = 0; x < size; x++) {
      const x2 = (x + half) % size;
      const wA = weight[x]! * weight[y]!;
      const wB = (1 - weight[x]!) * weight[y]!;
      const wC = weight[x]! * (1 - weight[y]!);
      const wD = (1 - weight[x]!) * (1 - weight[y]!);
      const o = (y * size + x) * 4;
      const a = o;
      const b = (y * size + x2) * 4;
      const c = (y2 * size + x) * 4;
      const d = (y2 * size + x2) * 4;
      for (let k = 0; k < 3; k++) {
        out[o + k] = source[a + k]! * wA + source[b + k]! * wB + source[c + k]! * wC + source[d + k]! * wD;
      }
      out[o + 3] = 255;
    }
  }
}
