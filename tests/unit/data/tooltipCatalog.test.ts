/**
 * Spec: the tooltip catalog explains every term the setup screens show —
 * each entry has a title, a plain-language definition and an example, every
 * domain value (slots, roles, actions, play styles, factions, difficulties,
 * scenarios) has an entry and every term id the UI source references exists.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  actionTermId,
  allTermIds,
  difficultyTermId,
  factionTermId,
  roleTermId,
  setTermLocale,
  sizeTermId,
  slotTermId,
  styleTermId,
  termEntry,
  TERM_CATALOG,
} from "../../../src/data/tooltips";
import { PLAYSTYLES } from "../../../src/data/roleHints/playstyleCatalog";
import { ROLE_SECTION_ORDER } from "../../../src/data/roleHints/roleSections";
import { DIFFICULTY_NAMES } from "../../../src/ai/AIDifficulty";
import { SCENARIO_IDS } from "../../../src/arcade/scenarios";
import { UPGRADE_DEFINITIONS } from "../../../src/systems/UpgradeSystem";
import { FACTION_COLORS } from "../../../src/config";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : path.endsWith(".ts")
        ? [path]
        : [];
  });
}

describe("tooltip catalog", () => {
  it("gives every term a title, a definition and an example", () => {
    for (const id of allTermIds()) {
      const entry = TERM_CATALOG[id];
      expect(entry.title.trim(), id).not.toBe("");
      expect(entry.definition.trim().length, id).toBeGreaterThan(20);
      expect(entry.example.trim().length, id).toBeGreaterThan(10);
    }
  });

  it("has well over a hundred terms", () => {
    expect(allTermIds().length).toBeGreaterThanOrEqual(120);
  });

  it("covers every upgrade slot, role, action, style, faction and difficulty", () => {
    for (const slot of new Set(Object.values(UPGRADE_DEFINITIONS).map((c) => c.slotType)))
      expect(TERM_CATALOG[slotTermId(slot as never)], slot).toBeDefined();
    for (const role of ROLE_SECTION_ORDER)
      expect(TERM_CATALOG[roleTermId(role)], role).toBeDefined();
    for (const style of Object.keys(PLAYSTYLES))
      expect(TERM_CATALOG[styleTermId(style as never)], style).toBeDefined();
    for (const faction of Object.keys(FACTION_COLORS))
      expect(TERM_CATALOG[factionTermId(faction as never)], faction).toBeDefined();
    for (const level of Object.keys(DIFFICULTY_NAMES))
      expect(TERM_CATALOG[difficultyTermId(level as never)], level).toBeDefined();
    for (const size of ["small", "medium", "large", "huge"])
      expect(TERM_CATALOG[sizeTermId(size)], size).toBeDefined();
  });

  it("covers every action on every ship's action bar", () => {
    const used = new Set(
      Object.values(SHIP_DEFINITIONS).flatMap((s) => s.baseStats.actions),
    );
    for (const action of used)
      expect(actionTermId(action), action).not.toBeNull();
  });

  it("covers every scenario by id", () => {
    for (const id of SCENARIO_IDS)
      expect(TERM_CATALOG[`scenario.${id}` as never], id).toBeDefined();
  });

  it("returns null for an action with no entry", () => {
    expect(actionTermId("warp_drive")).toBeNull();
  });

  it("falls back to English for a locale without a translation", () => {
    setTermLocale("es");
    try {
      expect(termEntry("stat.hull").title).toBe("Hull");
    } finally {
      setTermLocale("en");
    }
  });

  it("uses the new maneuver and slot names, never the old ones", () => {
    const text = Object.values(TERM_CATALOG)
      .map((e) => `${e.title} ${e.definition} ${e.example} ${e.howItPlays ?? ""}`)
      .join("\n");
    expect(text).toContain("Snap Turn");
    expect(text).toContain("Hook Loop");
    expect(text).toContain("Knife Roll");
    expect(text).toContain("Rigger");
    expect(text).not.toMatch(/K-turn|Koiogran|Segnor|Tallon|astromech|the Force/i);
  });

  it("only references term ids that exist in the UI source", () => {
    const pattern =
      /["'`]((?:stat|size|dial|maneuver|tag|ui|battle|team|mode|scenario)\.[a-z_0-9]+)["'`]/g;
    const missing: string[] = [];
    for (const file of sourceFiles(join(process.cwd(), "src", "ui"))
      .concat(sourceFiles(join(process.cwd(), "src", "scenes")))) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(pattern)) {
        const id = match[1]!;
        if (!(id in TERM_CATALOG)) missing.push(`${file}: ${id}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
