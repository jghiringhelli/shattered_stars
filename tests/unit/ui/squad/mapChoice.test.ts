/**
 * Spec: the Skirmish "Map" option cycles Random → every theme → Random,
 * labels each choice and only accepts known choices from storage.
 */

import { describe, it, expect } from "vitest";
import {
  MAP_CHOICES,
  isMapChoice,
  mapChoiceLabel,
  nextMapChoice,
} from "../../../../src/ui/squad/mapChoice";
import { MAP_THEMES, RANDOM_MAP_THEME } from "../../../../src/rendering/spaceMap/mapThemes";

describe("map choice", () => {
  it("offers Random first, then every theme", () => {
    expect(MAP_CHOICES[0]).toBe(RANDOM_MAP_THEME);
    expect(MAP_CHOICES.slice(1)).toEqual(MAP_THEMES.map((t) => t.id));
  });

  it("cycles through every choice and back to Random", () => {
    let choice = RANDOM_MAP_THEME;
    const seen: string[] = [];
    for (let i = 0; i < MAP_CHOICES.length; i++) {
      seen.push(choice);
      choice = nextMapChoice(choice);
    }
    expect(seen).toEqual([...MAP_CHOICES]);
    expect(choice).toBe(RANDOM_MAP_THEME);
  });

  it("treats an unknown choice as Random when stepping", () => {
    expect(nextMapChoice("not_a_map")).toBe(MAP_CHOICES[1]);
  });

  it("labels Random and each theme by its name", () => {
    expect(mapChoiceLabel(RANDOM_MAP_THEME)).toBe("RANDOM");
    expect(mapChoiceLabel(MAP_THEMES[0]!.id)).toBe(MAP_THEMES[0]!.name.toUpperCase());
  });

  it("accepts only known choices", () => {
    expect(isMapChoice(RANDOM_MAP_THEME)).toBe(true);
    expect(isMapChoice(MAP_THEMES[0]!.id)).toBe(true);
    expect(isMapChoice("nope")).toBe(false);
    expect(isMapChoice(undefined)).toBe(false);
  });
});
