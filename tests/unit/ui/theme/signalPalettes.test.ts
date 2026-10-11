/**
 * Spec: colourblind HUD palettes. For every colour-vision mode the signals a
 * player must tell apart at a glance — ally vs enemy, ally/player vs the
 * squad mark, the mark vs the locked target, healthy vs critical hull — stay
 * clearly distinct (CIE76 ΔE ≥ 25) when SIMULATED for that deficiency, and
 * every signal stays legible on the HUD panel (WCAG contrast ≥ 3).
 */

import { afterEach, describe, it, expect } from "vitest";
import {
  contrastRatio,
  deltaE,
  simulateColorVision,
  type Deficiency,
} from "../../../../src/ui/theme/colorVision";
import {
  SIGNAL_PALETTES,
  applyThemePreferences,
  type SignalPalette,
} from "../../../../src/ui/theme/signalPalettes";
import {
  HOLO_PALETTE,
  SIDE_COLORS,
  holoTextStyle,
  HOLO_TYPE_SCALE,
} from "../../../../src/ui/theme/HoloTheme";
import { COLOR_VISION_MODES } from "../../../../src/systems/settingsSchema";

/** ΔE above which two HUD signals read as different at a glance. */
const DISTINCT = 25;
/** Minimum WCAG contrast of a signal on the HUD panel fill. */
const LEGIBLE = 3;

const MUST_DIFFER: ReadonlyArray<[keyof SignalPalette, keyof SignalPalette]> = [
  ["ally", "enemy"],
  ["player", "enemy"],
  ["ally", "mark"],
  ["player", "mark"],
  ["mark", "target"],
  ["success", "danger"],
];

const NORMAL = {
  colorVision: "normal",
  highContrastHud: false,
  textScale: 1,
} as const;

afterEach(() => applyThemePreferences(NORMAL));

describe("simulateColorVision", () => {
  it("collapses red/green for a deuteranope (the classic failure)", () => {
    const red = simulateColorVision(0xd03030, "deuteranopia");
    const green = simulateColorVision(0x30a030, "deuteranopia");
    expect(deltaE(red, green)).toBeLessThan(deltaE(0xd03030, 0x30a030) / 2);
  });

  it("leaves greys unchanged", () => {
    expect(simulateColorVision(0x808080, "protanopia")).toBe(0x808080);
  });
});

describe.each(["protanopia", "deuteranopia", "tritanopia"] as Deficiency[])(
  "%s palette",
  (mode) => {
    const palette = SIGNAL_PALETTES[mode];
    const seen = (c: number): number => simulateColorVision(c, mode);
    for (const [a, b] of MUST_DIFFER) {
      it(`keeps ${a} and ${b} distinct as seen by the viewer`, () => {
        expect(
          deltaE(seen(palette[a]), seen(palette[b])),
        ).toBeGreaterThanOrEqual(DISTINCT);
      });
    }
    it("keeps every signal legible on the panel", () => {
      for (const color of Object.values(palette))
        expect(
          contrastRatio(color, HOLO_PALETTE.panelFill),
        ).toBeGreaterThanOrEqual(LEGIBLE);
    });
  },
);

describe("normal palette", () => {
  it("is exactly the established HUD colours", () => {
    expect(SIGNAL_PALETTES.normal.ally).toBe(0x3f9dff);
    expect(SIGNAL_PALETTES.normal.enemy).toBe(0xff4d4d);
    expect(SIGNAL_PALETTES.normal.mark).toBe(0xff4d5e);
    expect(SIGNAL_PALETTES.normal.target).toBe(0xffb347);
  });
});

describe("applyThemePreferences", () => {
  it("covers every stored colour-vision mode", () => {
    for (const mode of COLOR_VISION_MODES)
      expect(SIGNAL_PALETTES[mode]).toBeDefined();
  });

  it("swaps the live side and signal tokens the HUD reads", () => {
    applyThemePreferences({ ...NORMAL, colorVision: "deuteranopia" });
    expect(SIDE_COLORS.enemy).toBe(SIGNAL_PALETTES.deuteranopia.enemy);
    expect(HOLO_PALETTE.mark).toBe(SIGNAL_PALETTES.deuteranopia.mark);
    expect(HOLO_PALETTE.danger).toBe(SIGNAL_PALETTES.deuteranopia.danger);
  });

  it("restores the normal tokens", () => {
    applyThemePreferences({ ...NORMAL, colorVision: "tritanopia" });
    applyThemePreferences(NORMAL);
    expect(SIDE_COLORS.ally).toBe(0x3f9dff);
    expect(HOLO_PALETTE.success).toBe(0x4dffa0);
  });

  it("high contrast makes panels more opaque and muted text brighter", () => {
    const before = {
      alpha: HOLO_PALETTE.panelAlpha,
      muted: HOLO_PALETTE.textMuted,
    };
    applyThemePreferences({ ...NORMAL, highContrastHud: true });
    expect(HOLO_PALETTE.panelAlpha).toBeGreaterThan(before.alpha);
    expect(
      contrastRatio(HOLO_PALETTE.textMuted, HOLO_PALETTE.panelFill),
    ).toBeGreaterThan(contrastRatio(before.muted, HOLO_PALETTE.panelFill));
  });

  it("scales HUD text", () => {
    applyThemePreferences({ ...NORMAL, textScale: 1.3 });
    const size = Math.round(HOLO_TYPE_SCALE.body.size * 1.3);
    expect(holoTextStyle("body").fontSize).toBe(`${size}px`);
  });
});
