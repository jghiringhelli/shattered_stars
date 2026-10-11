/**
 * Menu kit pure helpers: legacy font shorthand → holo font, legacy button
 * colour → holo variant, and the main-menu entry order the e2e helpers rely on.
 */

import { describe, it, expect } from "vitest";
import {
  holoFont,
  holoFontFromCss,
  parseCssFont,
} from "../../../../src/ui/theme/holoFont";
import { variantForColor } from "../../../../src/ui/theme/buttonVariant";
import { HOLO_FONT_FAMILY } from "../../../../src/ui/theme/HoloTheme";
import { MAIN_MENU_ENTRIES } from "../../../../src/ui/menu/mainMenuEntries";

describe("parseCssFont", () => {
  it("reads size and bold weight from a legacy shorthand", () => {
    expect(parseCssFont("bold 18px Arial")).toEqual({
      size: 18,
      weight: "bold",
    });
  });

  it("defaults the weight to 400 when only a size is given", () => {
    expect(parseCssFont("13px Arial")).toEqual({ size: 13, weight: "400" });
  });

  it("keeps combined style keywords such as italic bold", () => {
    expect(parseCssFont("italic bold 11px Arial").weight).toBe("italic bold");
  });

  it("accepts numeric weights and family-less shorthands", () => {
    expect(parseCssFont("600 14px")).toEqual({ size: 14, weight: "600" });
  });

  it("falls back to 16px when no size token is present", () => {
    expect(parseCssFont("bold").size).toBe(16);
  });
});

describe("holoFont", () => {
  it("always uses the holo family stack, never the shorthand's family", () => {
    const style = holoFontFromCss("bold 24px Arial");
    expect(style.fontFamily).toBe(HOLO_FONT_FAMILY);
    expect(style.fontSize).toBe("24px");
    expect(style.fontStyle).toBe("bold");
  });

  it("defaults to the regular weight", () => {
    expect(holoFont(12).fontStyle).toBe("400");
  });
});

describe("variantForColor", () => {
  it("maps green confirm fills to primary", () => {
    expect(variantForColor(0x227722)).toBe("primary");
    expect(variantForColor(0x226644)).toBe("primary");
  });

  it("maps red destructive fills to danger", () => {
    expect(variantForColor(0x662222)).toBe("danger");
  });

  it("maps neutral, blue, purple and olive fills to secondary", () => {
    for (const color of [0x2a3a4a, 0x224466, 0x444444, 0x553377, 0x666622]) {
      expect(variantForColor(color)).toBe("secondary");
    }
  });

  it("treats near-black fills as neutral chrome", () => {
    expect(variantForColor(0x200000)).toBe("secondary");
  });
});

describe("MAIN_MENU_ENTRIES", () => {
  /** Mirrors tests/e2e/helpers/game.ts MENU_POSITIONS. */
  const E2E_ORDER = [
    "SKIRMISH",
    "SURVIVAL",
    "EPIC FORMAT",
    "BOSS RAID",
    "DOGFIGHT",
    "ACE DUEL",
    "CAMPAIGN",
    "ONLINE",
    "SETTINGS",
    "CONTROLS",
    "ENCYCLOPEDIA",
    "CREDITS",
  ];

  it("keeps the label order the e2e menu helper clicks by index", () => {
    expect(MAIN_MENU_ENTRIES.map((entry) => entry.label)).toEqual(E2E_ORDER);
  });

  it("gives every entry a description for the briefing panel", () => {
    expect(
      MAIN_MENU_ENTRIES.every((entry) => entry.description.length > 0),
    ).toBe(true);
  });

  it("keeps each group contiguous so captions and dividers line up", () => {
    const groups = MAIN_MENU_ENTRIES.map((entry) => entry.group);
    const runs = groups.filter((group, i) => group !== groups[i - 1]);
    expect(new Set(runs).size).toBe(runs.length);
  });
});
