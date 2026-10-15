import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../../../src/systems/settingsSchema";
import {
  ACCESSIBILITY_PRESET,
  applyAccessibilityPreset,
  isAccessibilityPreset,
} from "../../../../src/ui/settings/accessibilityPreset";
import {
  effectiveComfort,
  osPrefersReducedMotion,
} from "../../../../src/ui/settings/motionComfort";

const DEFAULTS = DEFAULT_SETTINGS.accessibility;

describe("motionComfort", () => {
  it("leaves the user's shake and flash settings alone by default", () => {
    expect(effectiveComfort(DEFAULTS, false)).toEqual({
      shakeScale: 1,
      reduceFlashes: false,
      reduceMotion: false,
    });
  });

  it("turns shake off and flashes down when the OS asks for reduced motion", () => {
    expect(effectiveComfort(DEFAULTS, true)).toEqual({
      shakeScale: 0,
      reduceFlashes: true,
      reduceMotion: true,
    });
  });

  it("honours the Settings switch without the OS flag", () => {
    const comfort = effectiveComfort({ ...DEFAULTS, reduceMotion: true }, false);
    expect(comfort.shakeScale).toBe(0);
    expect(comfort.reduceMotion).toBe(true);
  });

  it("reads prefers-reduced-motion from matchMedia, false when unavailable", () => {
    expect(osPrefersReducedMotion({ matchMedia: () => ({ matches: true }) })).toBe(true);
    expect(osPrefersReducedMotion({ matchMedia: () => ({ matches: false }) })).toBe(false);
    expect(osPrefersReducedMotion({})).toBe(false);
    expect(
      osPrefersReducedMotion({
        matchMedia: () => {
          throw new Error("blocked");
        },
      }),
    ).toBe(false);
  });
});

describe("accessibilityPreset", () => {
  it("switches on palette, contrast, no flashes/motion, 115% text and low shake", () => {
    expect(ACCESSIBILITY_PRESET).toMatchObject({
      colorVision: "deuteranopia",
      highContrastHud: true,
      reduceFlashes: true,
      reduceMotion: true,
      textScale: 1.15,
    });
    expect(ACCESSIBILITY_PRESET.screenShake).toBeGreaterThan(0);
    expect(ACCESSIBILITY_PRESET.screenShake).toBeLessThanOrEqual(0.3);
  });

  it("changes only the accessibility section", () => {
    const next = applyAccessibilityPreset(DEFAULT_SETTINGS);
    expect(next.audio).toBe(DEFAULT_SETTINGS.audio);
    expect(next.gameplay).toBe(DEFAULT_SETTINGS.gameplay);
    expect(isAccessibilityPreset(next.accessibility)).toBe(true);
    expect(isAccessibilityPreset(DEFAULTS)).toBe(false);
  });
});
