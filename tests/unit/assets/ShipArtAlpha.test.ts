/**
 * Gate: every ship sprite ships with a real alpha channel.
 *
 * The art was generated on an opaque near-black backdrop with no alpha, so the
 * renderer faked transparency with an ADD blend. ADD adds each pixel to what is
 * behind it: ships glow, never occlude anything, and wash out completely over a
 * bright background. Keeping alpha in the asset is what lets the renderer use
 * normal blending.
 *
 * The colour type is read straight out of the PNG header rather than decoding
 * the image, so this stays a fast pure-Node check with no image dependency.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const SHIP_ART_ROOT = join(process.cwd(), "public", "assets", "ships");

/** PNG colour-type byte values that carry per-pixel alpha. */
const COLOR_TYPE_GREYSCALE_ALPHA = 4;
const COLOR_TYPE_RGBA = 6;

/** Byte offset of the colour-type field inside a PNG's IHDR chunk. */
const COLOR_TYPE_OFFSET = 25;

/** PNG magic number — guards against reading a truncated or non-PNG file. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/**
 * Read the colour type out of a PNG header.
 *
 * @param path - Absolute path to a PNG file.
 * @returns The IHDR colour-type byte.
 */
function pngColorType(path: string): number {
  const header = readFileSync(path).subarray(0, COLOR_TYPE_OFFSET + 1);
  expect(header.subarray(0, 4).equals(PNG_SIGNATURE)).toBe(true);
  return header[COLOR_TYPE_OFFSET]!;
}

/**
 * Collect every ship art PNG on disk.
 *
 * @returns Absolute paths, one per ship sprite.
 */
function shipArtFiles(): string[] {
  if (!existsSync(SHIP_ART_ROOT)) return [];
  return readdirSync(SHIP_ART_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((faction) => {
      const dir = join(SHIP_ART_ROOT, faction.name);
      return readdirSync(dir)
        .filter((file) => file.endsWith(".png"))
        .map((file) => join(dir, file));
    });
}

describe("ship art alpha", () => {
  const files = shipArtFiles();

  it("finds the ship art directory", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("stores every ship sprite with an alpha channel", () => {
    const opaque = files.filter((path) => {
      const colorType = pngColorType(path);
      return (
        colorType !== COLOR_TYPE_RGBA &&
        colorType !== COLOR_TYPE_GREYSCALE_ALPHA
      );
    });

    expect(opaque.map((p) => p.split(/[\\/]/).pop())).toEqual([]);
  });
});
