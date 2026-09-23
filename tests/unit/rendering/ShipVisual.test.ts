/**
 * Gate: ship art composites normally instead of being added to the backdrop.
 *
 * Ship PNGs used to ship without alpha, so the renderer used an ADD blend to
 * make their near-black backdrop disappear. ADD adds every pixel to whatever
 * is behind it, which has three visible costs: ships glow instead of being
 * lit, they never occlude anything they fly over, and over a bright nebula
 * they wash out entirely. Now that the art carries real alpha (see
 * ShipArtAlpha.test.ts) the blend must be left alone.
 */

import { describe, it, expect } from "vitest";
import { addShipVisual } from "../../../src/rendering/ShipVisual";

/** Records the calls a fake image receives, so tests can assert on them. */
class FakeImage {
  blendMode: unknown = "untouched";
  displayWidth = 0;
  displayHeight = 0;

  constructor(readonly textureKey: string) {}

  setDisplaySize(width: number, height: number): this {
    this.displayWidth = width;
    this.displayHeight = height;
    return this;
  }
  setBlendMode(mode: unknown): this {
    this.blendMode = mode;
    return this;
  }
}

/** Swallows draw calls; ShipVisual only needs these to exist. */
class FakeGraphics {
  fillStyle(): this {
    return this;
  }
  lineStyle(): this {
    return this;
  }
  beginPath(): this {
    return this;
  }
  closePath(): this {
    return this;
  }
  moveTo(): this {
    return this;
  }
  lineTo(): this {
    return this;
  }
  fillPath(): this {
    return this;
  }
  strokePath(): this {
    return this;
  }
  strokeCircle(): this {
    return this;
  }
}

/**
 * Build a fake scene whose texture store contains exactly `loadedKeys`.
 *
 * @param loadedKeys - Texture keys that should report as loaded.
 * @returns A scene stand-in plus the container it adds objects to.
 */
function fakeScene(loadedKeys: readonly string[]) {
  const added: unknown[] = [];
  const scene = {
    textures: { exists: (key: string) => loadedKeys.includes(key) },
    add: {
      image: (_x: number, _y: number, key: string) => new FakeImage(key),
      graphics: () => new FakeGraphics(),
    },
  };
  const container = { add: (obj: unknown) => added.push(obj) };
  return { scene, container, added };
}

const OPTIONS = {
  definitionId: "terran_javelin",
  faction: "terran_hegemony",
  fallbackSizeName: "small",
  size: 40,
  isPlayer: true,
} as const;

describe("addShipVisual", () => {
  it("does not force a blend mode on ship art", () => {
    const { scene, container } = fakeScene(["ship_terran_javelin"]);
    const visual = addShipVisual(
      scene as never,
      container as never,
      OPTIONS as never,
    );
    expect((visual.image as unknown as FakeImage).blendMode).toBe("untouched");
  });

  it("prefers the ship's own art over the faction placeholder", () => {
    const { scene, container } = fakeScene([
      "ship_terran_javelin",
      "ship_terran_hegemony_small",
    ]);
    const visual = addShipVisual(
      scene as never,
      container as never,
      OPTIONS as never,
    );
    expect((visual.image as unknown as FakeImage).textureKey).toBe(
      "ship_terran_javelin",
    );
  });

  it("falls back to the faction placeholder when the ship has no art", () => {
    const { scene, container } = fakeScene(["ship_terran_hegemony_small"]);
    const visual = addShipVisual(
      scene as never,
      container as never,
      OPTIONS as never,
    );
    expect((visual.image as unknown as FakeImage).textureKey).toBe(
      "ship_terran_hegemony_small",
    );
  });

  it("draws a vector hull when no texture is loaded at all", () => {
    const { scene, container } = fakeScene([]);
    const visual = addShipVisual(
      scene as never,
      container as never,
      OPTIONS as never,
    );
    expect(visual.image).toBeNull();
    expect(visual.ring).toBeNull();
    expect(visual.hull).not.toBeNull();
  });

  it("sizes the art square, from the requested radius", () => {
    const { scene, container } = fakeScene(["ship_terran_javelin"]);
    const visual = addShipVisual(
      scene as never,
      container as never,
      OPTIONS as never,
    );
    const image = visual.image as unknown as FakeImage;
    expect(image.displayWidth).toBe(image.displayHeight);
    expect(image.displayWidth).toBeGreaterThan(OPTIONS.size);
  });
});
