import { describe, it, expect } from "vitest";
import {
  activeArchetypeSets,
  ALL_RELICS,
  drawRelics,
  synergyMatches,
} from "../../../../src/data/survival/relicCatalog";
import { ARCHETYPE_SETS } from "../../../../src/data/survival/relics";
import {
  MUTATIONS,
  MUTATION_SLOT_BY_SECTOR,
  mutationsForSlot,
} from "../../../../src/data/survival/mutations";
import {
  activeAscensionModifiers,
  ascensionRules,
  ASCENSION_MODIFIERS,
  MAX_ASCENSION,
} from "../../../../src/data/survival/ascension";
import {
  affixLabel,
  ELITE_AFFIXES,
  rollAffixes,
} from "../../../../src/data/survival/affixes";
import {
  META_UNLOCKS,
  starterChoices,
  unlockedRelicPools,
} from "../../../../src/data/survival/metaUnlocks";
import { hostileFactions } from "../../../../src/data/survival/enemyFactions";
import { getShipDefinition } from "../../../../src/data/ShipDefinitions";
import { createSeededRng } from "../../../../src/utils/random";

describe("relic catalog", () => {
  it("has at least 24 uniquely named relics with tags and rule text", () => {
    expect(ALL_RELICS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(ALL_RELICS.map((r) => r.id)).size).toBe(ALL_RELICS.length);
    ALL_RELICS.forEach((r) => {
      expect(r.tags.length).toBeGreaterThan(0);
      expect(r.description.length).toBeGreaterThan(10);
      expect(r.effects.length).toBeGreaterThan(0);
    });
  });

  it("supports at least four archetypes with three or more base-pool relics each", () => {
    const base = ALL_RELICS.filter((r) => r.pool === "base");
    const viable = Object.keys(ARCHETYPE_SETS).filter(
      (a) => base.filter((r) => r.archetype === a).length >= 3,
    );
    expect(viable.length).toBeGreaterThanOrEqual(4);
  });

  it("has conditional (trigger / marked / escort / formation) relics, not only stat sticks", () => {
    const conditional = ALL_RELICS.filter((r) =>
      r.effects.some((e) =>
        ["trigger", "marked", "perEscort", "formation"].includes(e.kind),
      ),
    );
    expect(conditional.length).toBeGreaterThanOrEqual(8);
  });

  it("draws only from unlocked pools", () => {
    const drawn = drawRelics(createSeededRng(1), {
      owned: [],
      pools: ["base"],
      count: 99,
    });
    expect(drawn.every((r) => r.pool === "base")).toBe(true);
    expect(drawn.length).toBe(
      ALL_RELICS.filter((r) => r.pool === "base").length,
    );
  });

  it("counts synergy-tag matches and completes sets at three of an archetype", () => {
    const painter = ALL_RELICS.find((r) => r.id === "target_painter")!;
    expect(synergyMatches(painter, ["predator_optics", "wing_link"])).toBe(1);
    expect(activeArchetypeSets(["target_painter", "predator_optics"])).toEqual(
      [],
    );
    expect(
      activeArchetypeSets([
        "target_painter",
        "predator_optics",
        "ambush_doctrine",
      ]).map((s) => s.archetype),
    ).toEqual(["hunter"]);
  });
});

describe("mutations", () => {
  it("offers two slots with at least two mutually exclusive options each", () => {
    expect(Object.values(MUTATION_SLOT_BY_SECTOR).sort()).toEqual([
      "systems",
      "weapon",
    ]);
    expect(mutationsForSlot("weapon").length).toBeGreaterThanOrEqual(2);
    expect(mutationsForSlot("systems").length).toBeGreaterThanOrEqual(2);
    expect(new Set(MUTATIONS.map((m) => m.id)).size).toBe(MUTATIONS.length);
  });
});

describe("ascension", () => {
  it("has ten visible, cumulative modifiers", () => {
    expect(MAX_ASCENSION).toBe(10);
    expect(ASCENSION_MODIFIERS.map((m) => m.level)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(activeAscensionModifiers(0)).toEqual([]);
    expect(activeAscensionModifiers(3)).toHaveLength(3);
  });

  it("only ever makes the run harder as the level rises", () => {
    for (let level = 1; level <= MAX_ASCENSION; level++) {
      const prev = ascensionRules(level - 1);
      const cur = ascensionRules(level);
      expect(cur.threatMultiplier).toBeGreaterThanOrEqual(
        prev.threatMultiplier,
      );
      expect(cur.salvageMultiplier).toBeLessThanOrEqual(prev.salvageMultiplier);
      expect(cur.shopPriceMultiplier).toBeGreaterThanOrEqual(
        prev.shopPriceMultiplier,
      );
      expect(cur.extraBossPhases).toBeGreaterThanOrEqual(prev.extraBossPhases);
    }
  });
});

describe("elite affixes", () => {
  it("rolls distinct affixes and labels them for the HUD", () => {
    const rolled = rollAffixes(createSeededRng(3), 2);
    expect(new Set(rolled.map((a) => a.id)).size).toBe(2);
    expect(affixLabel(rolled)).toContain(" · ");
    expect(ELITE_AFFIXES.length).toBeGreaterThanOrEqual(5);
  });
});

describe("meta unlocks and enemies", () => {
  it("unlocks extra starting flagships that exist", () => {
    const choices = starterChoices("void_corsairs", [
      "heavy_flagships",
      "gunship_flagships",
    ]);
    expect(choices).toHaveLength(4);
    choices.forEach((id) => expect(getShipDefinition(id)).toBeDefined());
  });

  it("expands the relic pool", () => {
    expect(unlockedRelicPools(["fleet_pack", "war_chest"])).toEqual([
      "base",
      "fleet_pack",
    ]);
    expect(META_UNLOCKS.every((u) => u.cost > 0)).toBe(true);
  });

  it("includes the Free Confederation as an enemy unless the player flies it", () => {
    expect(hostileFactions("terran_hegemony")).toContain("free_confederation");
    expect(hostileFactions("free_confederation")).not.toContain(
      "free_confederation",
    );
  });
});
