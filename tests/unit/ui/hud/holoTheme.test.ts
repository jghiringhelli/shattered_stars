/**
 * Spec: holo theme colour helpers and token invariants.
 */

import { describe, it, expect } from "vitest";
import {
  clamp01,
  mixColor,
  mixColorStops,
  liftColor,
  toCssColor,
} from "../../../../src/ui/theme/colorMath";
import {
  FACTION_ACCENTS,
  SIDE_COLORS,
  HOLO_DEPTH,
  holoTextStyle,
  factionAccent,
  HOLO_FONT_FAMILY,
  HOLO_PALETTE,
} from "../../../../src/ui/theme/HoloTheme";
import { FACTION_COLORS, type FactionId } from "../../../../src/config";

const luminance = (c: number): number =>
  0.2126 * ((c >> 16) & 0xff) +
  0.7152 * ((c >> 8) & 0xff) +
  0.0722 * (c & 0xff);

describe("colorMath", () => {
  it("clamps into [0, 1] and maps NaN to 0", () => {
    expect([
      clamp01(-1),
      clamp01(0.4),
      clamp01(9),
      clamp01(Number.NaN),
    ]).toEqual([0, 0.4, 1, 0]);
  });

  it("returns the endpoints at t = 0 and t = 1", () => {
    expect(mixColor(0x102030, 0xa0b0c0, 0)).toBe(0x102030);
    expect(mixColor(0x102030, 0xa0b0c0, 1)).toBe(0xa0b0c0);
  });

  it("blends each channel independently at the midpoint", () => {
    expect(mixColor(0x000000, 0xff8040, 0.5)).toBe(0x804020);
  });

  it("clamps out-of-range blend factors", () => {
    expect(mixColor(0x000000, 0xffffff, 2)).toBe(0xffffff);
    expect(mixColor(0x000000, 0xffffff, -1)).toBe(0x000000);
  });

  it("walks evenly spaced colour stops", () => {
    const stops = [0x000000, 0x0000ff, 0xffffff];
    expect(mixColorStops(stops, 0)).toBe(0x000000);
    expect(mixColorStops(stops, 0.25)).toBe(0x000080);
    expect(mixColorStops(stops, 0.5)).toBe(0x0000ff);
    expect(mixColorStops(stops, 1)).toBe(0xffffff);
    expect(mixColorStops(stops, 5)).toBe(0xffffff);
  });

  it("returns a single stop unchanged and rejects an empty ramp", () => {
    expect(mixColorStops([0x123456], 0.7)).toBe(0x123456);
    expect(() => mixColorStops([], 0.5)).toThrow(RangeError);
  });

  it("lifts toward white", () => {
    expect(liftColor(0x000000, 1)).toBe(0xffffff);
    expect(liftColor(0x336699, 0)).toBe(0x336699);
  });

  it("formats CSS hex with zero padding", () => {
    expect(toCssColor(0x00000f)).toBe("#00000f");
    expect(toCssColor(0x4fd8ff)).toBe("#4fd8ff");
  });
});

describe("HoloTheme tokens", () => {
  it("lifts every faction colour so it is brighter than the raw faction colour", () => {
    for (const id of Object.keys(FACTION_COLORS) as FactionId[]) {
      expect(luminance(FACTION_ACCENTS[id])).toBeGreaterThan(
        luminance(FACTION_COLORS[id]),
      );
    }
  });

  it("gives every side a distinct colour", () => {
    expect(new Set(Object.values(SIDE_COLORS)).size).toBe(
      Object.keys(SIDE_COLORS).length,
    );
  });

  it("layers indicators above the HUD and menus above both", () => {
    expect(HOLO_DEPTH.worldOverlay).toBeLessThan(HOLO_DEPTH.hud);
    expect(HOLO_DEPTH.hudIndicators).toBeGreaterThan(HOLO_DEPTH.hud);
    expect(HOLO_DEPTH.menuPanel).toBeGreaterThan(HOLO_DEPTH.hudIndicators);
    expect(HOLO_DEPTH.menuControl).toBeGreaterThan(HOLO_DEPTH.menuPanel);
    expect(HOLO_DEPTH.modal).toBeGreaterThan(HOLO_DEPTH.menuControl);
  });

  it("builds text styles from the single font stack", () => {
    const style = holoTextStyle("caption", 0x112233);
    expect(style.fontFamily).toBe(HOLO_FONT_FAMILY);
    expect(style.color).toBe("#112233");
    expect(style.fontSize).toBe("12px");
  });

  it("falls back to the neutral accent without a faction", () => {
    expect(factionAccent(undefined)).toBe(HOLO_PALETTE.accent);
    expect(factionAccent("void_corsairs")).toBe(FACTION_ACCENTS.void_corsairs);
  });
});
