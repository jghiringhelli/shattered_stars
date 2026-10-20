import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMPAIGN_PILOTS } from "../../../../src/data/PilotData";
import { SHIP_DEFINITIONS } from "../../../../src/data/ShipDefinitions";
import { PILOT_CARDS } from "../../../../src/systems/SquadBuilder";
import { MIN_TEXT_PX } from "../../../../src/ui/theme/holoFont";
import {
  MAX_NAME_LINES,
  estimateTextWidth,
  planNameFit,
} from "../../../../src/ui/theme/nameFit";

/** Narrowest name slot of any screen (catalog card: 204 − 44 − 8). */
const NARROWEST_SLOT = 150;
const NAME_SIZE = 13;

const shipNames = Object.values(SHIP_DEFINITIONS).map((def) => def.name);
const pilotNames = [
  ...Object.values(PILOT_CARDS).map((card) => card.name),
  ...Object.values(CAMPAIGN_PILOTS).flatMap((pilots) =>
    pilots.flatMap((pilot) => [pilot.displayName, pilot.callsign]),
  ),
];

describe("planNameFit", () => {
  it("keeps a short name on one line at the preferred size", () => {
    const plan = planNameFit("Viper", 150, NAME_SIZE);
    expect(plan).toEqual({ fontSize: NAME_SIZE, lines: ["Viper"], fits: true });
  });

  it("shrinks before wrapping and never goes below the minimum size", () => {
    const name = "Thunderbolt Assault Bomber";
    const plan = planNameFit(name, 200, 16);
    expect(plan.fontSize).toBeGreaterThanOrEqual(MIN_TEXT_PX);
    expect(plan.fontSize).toBeLessThan(16);
    expect(plan.lines).toEqual([name]);
  });

  it("wraps at the minimum size when shrinking is not enough", () => {
    const plan = planNameFit("Thunderbolt Assault Bomber", 150, NAME_SIZE);
    expect(plan.fontSize).toBe(MIN_TEXT_PX);
    expect(plan.lines.join(" ")).toBe("Thunderbolt Assault Bomber");
    expect(plan.lines.length).toBe(2);
    expect(plan.fits).toBe(true);
  });

  it("reports a name that cannot fit instead of cutting it", () => {
    const plan = planNameFit("Supercalifragilisticexpialidocious", 60, 13);
    expect(plan.lines.join("")).toBe("Supercalifragilisticexpialidocious");
    expect(plan.fits).toBe(false);
  });
});

describe("every ship and pilot name is shown in full", () => {
  it("covers ships and pilots", () => {
    expect(shipNames.length).toBeGreaterThan(90);
    expect(pilotNames.length).toBeGreaterThan(50);
  });

  it.each([
    ["ship", shipNames],
    ["pilot", pilotNames],
  ])("fits every %s name in the narrowest slot without an ellipsis", (_k, names) => {
    for (const name of names) {
      const plan = planNameFit(name, NARROWEST_SLOT, NAME_SIZE);
      expect(plan.fits, name).toBe(true);
      expect(plan.lines.length, name).toBeLessThanOrEqual(MAX_NAME_LINES);
      expect(plan.lines.join(" "), name).toBe(name);
      expect(plan.lines.join(""), name).not.toContain("\u2026");
    }
  });

  it("estimates wide enough for the longest ship name to need a wrap in that slot", () => {
    const longest = [...shipNames].sort((a, b) => b.length - a.length)[0] ?? "";
    expect(estimateTextWidth(longest, MIN_TEXT_PX)).toBeGreaterThan(NARROWEST_SLOT);
  });
});

describe("name sites never truncate with an ellipsis", () => {
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return sources(path);
      return path.endsWith(".ts") ? [path] : [];
    });
  const forbidden = [
    /truncateText\(\s*def\.name/,
    /fitOrEllipsize\(\s*name\b/,
    /name\.slice\(0, [^)]*\)\s*\+\s*"\u2026"/,
    /fitTextToWidth/,
  ];

  it("has no name truncation call left in src/ui or src/scenes", () => {
    const offenders = ["src/ui", "src/scenes"]
      .flatMap((dir) => sources(dir))
      .filter((file) => {
        const text = readFileSync(file, "utf8");
        return forbidden.some((pattern) => pattern.test(text));
      });
    expect(offenders).toEqual([]);
  });
});
