/**
 * baseScale — specification: a ship image's un-squashed scale survives the
 * placeholder -> art texture swap, so banking never multiplies a stale scale
 * (the Survival Wasp flagship drew ~1080 px wide after its art loaded).
 */

import { describe, expect, it } from "vitest";
import {
  baseDisplaySize,
  imageBaseScale,
  recordBaseScale,
  type ScalableImage,
} from "../../../src/assets/baseScale";

/** A minimal stand-in for Phaser.GameObjects.Image. */
function fakeImage(
  width: number,
  height: number,
  scale: number,
): ScalableImage {
  const data = new Map<string, unknown>();
  return {
    width,
    height,
    scaleX: scale,
    scaleY: scale,
    getData: (key) => data.get(key),
    setData: (key, value) => {
      data.set(key, value);
      return undefined;
    },
  };
}

describe("imageBaseScale", () => {
  it("returns the scale recorded at creation, not the squashed one in use", () => {
    const image = fakeImage(64, 64, 2);
    recordBaseScale(image);
    image.scaleX = 2.3;
    image.scaleY = 1.8;
    expect(imageBaseScale(image)).toEqual({ x: 2, y: 2 });
  });

  it("falls back to the current scale when nothing was recorded", () => {
    expect(imageBaseScale(fakeImage(64, 64, 3))).toEqual({ x: 3, y: 3 });
  });
});

describe("baseDisplaySize", () => {
  it("is the texture size times the base scale, ignoring the bank squash", () => {
    const image = fakeImage(64, 32, 2);
    recordBaseScale(image);
    image.scaleX = 2.4;
    expect(baseDisplaySize(image)).toEqual({ width: 128, height: 64 });
  });
});
