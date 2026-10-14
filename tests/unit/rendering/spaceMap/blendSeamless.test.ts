import { describe, expect, it } from "vitest";
import { blendSeamless } from "../../../../src/rendering/spaceMap/canvasDraw";

const SIZE = 64;

/** A tile that is NOT seamless: a left-to-right brightness ramp. */
function rampTile(): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const o = (y * SIZE + x) * 4;
      const value = Math.round((x / (SIZE - 1)) * 255);
      pixels[o] = value;
      pixels[o + 1] = (y / (SIZE - 1)) * 255;
      pixels[o + 2] = 40;
      pixels[o + 3] = 255;
    }
  }
  return pixels;
}

function blended(): Uint8ClampedArray {
  const out = new Uint8ClampedArray(SIZE * SIZE * 4);
  blendSeamless(rampTile(), SIZE, out);
  return out;
}

describe("blendSeamless", () => {
  it("makes opposite edges match (no seam when tiled)", () => {
    const out = blended();
    const red = (x: number, y: number): number => out[(y * SIZE + x) * 4]!;
    const green = (x: number, y: number): number => out[(y * SIZE + x) * 4 + 1]!;
    // Step across the wrap (last column → first column) is no bigger than a normal step.
    let worstWrapStep = 0;
    let worstInnerStep = 0;
    for (let y = 0; y < SIZE; y++) {
      worstWrapStep = Math.max(worstWrapStep, Math.abs(red(SIZE - 1, y) - red(0, y)));
      for (let x = 0; x < SIZE - 1; x++) {
        worstInnerStep = Math.max(worstInnerStep, Math.abs(red(x + 1, y) - red(x, y)));
      }
    }
    expect(worstWrapStep).toBeLessThanOrEqual(worstInnerStep + 1);
    // Same vertically.
    let wrapY = 0;
    let innerY = 0;
    for (let x = 0; x < SIZE; x++) {
      wrapY = Math.max(wrapY, Math.abs(green(x, SIZE - 1) - green(x, 0)));
      for (let y = 0; y < SIZE - 1; y++) {
        innerY = Math.max(innerY, Math.abs(green(x, y + 1) - green(x, y)));
      }
    }
    expect(wrapY).toBeLessThanOrEqual(innerY + 1);
  });

  it("keeps the original at the centre of the tile", () => {
    const out = blended();
    const source = rampTile();
    const o = (SIZE / 2 * SIZE + SIZE / 2) * 4;
    expect(out[o]).toBe(source[o]);
    expect(out[o + 1]).toBe(source[o + 1]);
  });

  it("writes opaque pixels", () => {
    const out = blended();
    expect(out[3]).toBe(255);
    expect(out[out.length - 1]).toBe(255);
  });
});
