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
  readonly active = true;

  constructor(public textureKey: string) {}

  get texture(): { key: string } {
    return { key: this.textureKey };
  }
  setTexture(key: string): this {
    this.textureKey = key;
    return this;
  }
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

/** Minimal once/on/off/emit emitter, standing in for Phaser's. */
class FakeEmitter {
  private readonly handlers = new Map<
    string,
    Array<(...a: unknown[]) => void>
  >();
  on(event: string, fn: (...a: unknown[]) => void): this {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), fn]);
    return this;
  }
  once(event: string, fn: (...a: unknown[]) => void): this {
    return this.on(event, fn);
  }
  off(event: string, fn: (...a: unknown[]) => void): this {
    this.handlers.set(
      event,
      (this.handlers.get(event) ?? []).filter((h) => h !== fn),
    );
    return this;
  }
  emit(event: string, ...args: unknown[]): void {
    for (const fn of this.handlers.get(event) ?? []) fn(...args);
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
  const loaded = new Set(loadedKeys);
  const textures = Object.assign(new FakeEmitter(), {
    exists: (key: string) => loaded.has(key),
  });
  const requested: string[] = [];
  const load = Object.assign(new FakeEmitter(), {
    image: (key: string) => requested.push(key),
    atlas: (key: string) => requested.push(key),
    isLoading: () => false,
    start: () => undefined,
  });
  const scene = {
    textures,
    load,
    events: new FakeEmitter(),
    add: {
      image: (_x: number, _y: number, key: string) => new FakeImage(key),
      graphics: () => new FakeGraphics(),
    },
  };
  const container = { add: (obj: unknown) => added.push(obj) };
  /** Simulate the requested texture finishing its download. */
  const finishLoad = (key: string): void => {
    loaded.add(key);
    textures.emit(`addtexture-${key}`);
  };
  return { scene, container, added, requested, finishLoad };
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

  it("downloads missing ship art on demand and swaps the placeholder at the same size", () => {
    const { scene, container, requested, finishLoad } = fakeScene([
      "ship_terran_hegemony_small",
    ]);
    const visual = addShipVisual(
      scene as never,
      container as never,
      OPTIONS as never,
    );
    const image = visual.image as unknown as FakeImage;
    const sizeBefore = image.displayWidth;
    expect(requested).toEqual(["ship_terran_javelin"]);
    finishLoad("ship_terran_javelin");
    expect(image.textureKey).toBe("ship_terran_javelin");
    expect(image.displayWidth).toBe(sizeBefore);
  });
});
