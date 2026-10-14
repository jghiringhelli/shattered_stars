import { describe, expect, it } from "vitest";
import {
  MAP_THEMES,
  MAP_THEME_IDS,
  findMapTheme,
  resolveMapTheme,
  themeForSeed,
  themeIdForSector,
} from "../../../../src/rendering/spaceMap/mapThemes";
import {
  DECOR_FACTOR_MAX,
  DECOR_FACTOR_MIN,
  DECOR_FIELD_PERIOD,
  DECOR_VARIANTS,
  generateDecorField,
  placeDecor,
  planetStart,
  tileOffset,
  wrapSymmetric,
} from "../../../../src/rendering/spaceMap/parallaxMath";
import { resolveMapRequest } from "../../../../src/rendering/spaceMap/mapRequest";
import { BACKGROUND_IDS } from "../../../../src/assets/assetManifest";

describe("map themes", () => {
  it("offers at least eight distinct themes", () => {
    expect(MAP_THEMES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(MAP_THEME_IDS).size).toBe(MAP_THEMES.length);
  });

  it("only references backdrops that exist", () => {
    for (const theme of MAP_THEMES) {
      if (theme.backdrop) expect(BACKGROUND_IDS).toContain(theme.backdrop);
    }
  });

  it("picks the same theme for the same seed", () => {
    for (const seed of [0, 1, 42, 123456789, 4294967295]) {
      expect(themeForSeed(seed).id).toBe(themeForSeed(seed).id);
    }
  });

  it("reaches every theme across seeds", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 400; seed++) seen.add(themeForSeed(seed).id);
    expect(seen.size).toBe(MAP_THEMES.length);
  });

  it("honours an explicit choice and falls back to the seed otherwise", () => {
    expect(resolveMapTheme("kessa_lane", 7).id).toBe("kessa_lane");
    expect(resolveMapTheme("random", 7).id).toBe(themeForSeed(7).id);
    expect(resolveMapTheme(undefined, 7).id).toBe(themeForSeed(7).id);
    expect(resolveMapTheme("no_such_theme", 7).id).toBe(themeForSeed(7).id);
    expect(findMapTheme("no_such_theme")).toBeUndefined();
  });
});

describe("survival sector themes", () => {
  it("gives every sector a real theme and wraps past the last", () => {
    for (let sector = 1; sector <= 20; sector++) {
      expect(findMapTheme(themeIdForSector(sector))).toBeDefined();
    }
    expect(themeIdForSector(9)).toBe(themeIdForSector(1));
  });

  it("changes the look from one sector to the next", () => {
    expect(themeIdForSector(1)).not.toBe(themeIdForSector(2));
  });
});

describe("generateDecorField", () => {
  const theme = findMapTheme("kessa_lane")!;

  it("is deterministic per seed and differs between seeds", () => {
    expect(generateDecorField(theme, 5)).toEqual(generateDecorField(theme, 5));
    expect(generateDecorField(theme, 5)).not.toEqual(
      generateDecorField(theme, 6),
    );
  });

  it("creates exactly the counts the theme asks for", () => {
    const items = generateDecorField(theme, 9);
    expect(items.filter((i) => i.kind === "rock")).toHaveLength(theme.rocks);
    expect(items.filter((i) => i.kind === "debris")).toHaveLength(theme.debris);
    expect(items.filter((i) => i.kind === "shard")).toHaveLength(theme.shards);
  });

  it("keeps every item within the field, factor range and texture variants", () => {
    for (const t of MAP_THEMES) {
      for (const item of generateDecorField(t, 77)) {
        expect(item.x).toBeGreaterThanOrEqual(0);
        expect(item.x).toBeLessThan(DECOR_FIELD_PERIOD);
        expect(item.y).toBeGreaterThanOrEqual(0);
        expect(item.y).toBeLessThan(DECOR_FIELD_PERIOD);
        expect(item.factor).toBeGreaterThanOrEqual(DECOR_FACTOR_MIN);
        expect(item.factor).toBeLessThanOrEqual(DECOR_FACTOR_MAX);
        expect(item.variant).toBeLessThan(DECOR_VARIANTS[item.kind]);
        expect(item.scale).toBeGreaterThan(0);
      }
    }
  });

  it("sorts far layers first so near ones draw on top", () => {
    const factors = generateDecorField(theme, 3).map((i) => i.factor);
    expect(factors).toEqual([...factors].sort((a, b) => a - b));
  });
});

describe("parallax tiling math", () => {
  it("wraps into a symmetric window", () => {
    expect(wrapSymmetric(0, 100)).toBe(0);
    expect(wrapSymmetric(50, 100)).toBe(-50);
    expect(wrapSymmetric(-51, 100)).toBe(49);
    expect(wrapSymmetric(1e6 + 20, 100)).toBeCloseTo(20);
  });

  it("scrolls a layer by travel × factor (÷ tile scale)", () => {
    expect(tileOffset(1000, 0.25, 1)).toBe(250);
    expect(tileOffset(1000, 0.25, 2)).toBe(125);
  });

  it("moves near items more than far ones and is periodic in the field", () => {
    const near = { x: 100, y: 100, factor: 0.9, driftX: 0, driftY: 0 };
    const far = { ...near, factor: 0.25 };
    const nearOut = { x: 0, y: 0 };
    const farOut = { x: 0, y: 0 };
    placeDecor(near, 0, 0, 0, nearOut);
    const nearStart = nearOut.x;
    placeDecor(near, 100, 0, 0, nearOut);
    placeDecor(far, 0, 0, 0, farOut);
    const farStart = farOut.x;
    placeDecor(far, 100, 0, 0, farOut);
    expect(nearStart - nearOut.x).toBeCloseTo(90);
    expect(farStart - farOut.x).toBeCloseTo(25);
    placeDecor(near, DECOR_FIELD_PERIOD / 0.9, 0, 0, nearOut);
    expect(nearOut.x).toBeCloseTo(nearStart);
  });

  it("drifts items over time", () => {
    const item = { x: 0, y: 0, factor: 0.5, driftX: 4, driftY: -2 };
    const out = { x: 0, y: 0 };
    placeDecor(item, 0, 0, 10, out);
    expect(out.x).toBeCloseTo(40);
    expect(out.y).toBeCloseTo(-20);
  });

  it("starts the planet near the first view, deterministically", () => {
    const a = planetStart(11, 3000, 3000);
    expect(planetStart(11, 3000, 3000)).toEqual(a);
    const distance = Math.hypot(a.x - 3000 * 0.07, (a.y - 3000 * 0.07) / 0.7);
    expect(distance).toBeGreaterThanOrEqual(380);
    expect(distance).toBeLessThanOrEqual(640);
  });
});

describe("resolveMapRequest", () => {
  const fixedRandom = (): number => 0.25;

  it("takes the shared match seed online, so both clients get the same map", () => {
    const a = resolveMapRequest([{ online: { seat: 0 }, seed: 99 }], () => 0.1);
    const b = resolveMapRequest([{ online: { seat: 1 }, seed: 99 }], () => 0.9);
    expect(a.seed).toBe(99);
    expect(a.theme.id).toBe(b.theme.id);
    expect(a.theme.id).toBe(themeForSeed(99).id);
  });

  it("ignores a local theme choice online", () => {
    const request = resolveMapRequest(
      [{ online: true, seed: 5, mapTheme: "kessa_lane" }],
      fixedRandom,
    );
    expect(request.theme.id).toBe(themeForSeed(5).id);
  });

  it("honours the chosen theme offline", () => {
    const request = resolveMapRequest([{ mapTheme: "hales_run" }], fixedRandom);
    expect(request.theme.id).toBe("hales_run");
  });

  it("picks by a random seed when the choice is random or absent", () => {
    const request = resolveMapRequest([{ mapTheme: "random" }, undefined, 3], fixedRandom);
    expect(request.seed).toBe(Math.floor(0.25 * 2 ** 32));
    expect(request.theme.id).toBe(themeForSeed(request.seed).id);
  });

  it("uses a fixed map seed (Survival sector) and is repeatable", () => {
    const a = resolveMapRequest([{ mapSeed: 1234 }], () => 0.5);
    const b = resolveMapRequest([{ mapSeed: 1234 }], () => 0.7);
    expect(a).toEqual(b);
  });
});

