/**
 * Spec: every faction aura is explained in one read — who it covers, how far,
 * what it changes (with the real numbers), when it stops and a concrete
 * example. The numbers come from the aura constants (FactionAuras.ts), so a
 * retune re-words the text; these tests fail if the text and the constants
 * ever drift apart or the text goes back to abstract wording.
 */

import { describe, expect, it } from "vitest";
import type { FactionId } from "../../../src/config";
import { SHIP_SIZES } from "../../../src/config";
import {
  AURA_STACKING,
  FACTION_AURAS,
  MAX_STRESS_RELIEF_TIERS,
  MIN_DAMAGE_TAKEN_MULTIPLIER,
  SIZE_MAGNITUDE_MULTIPLIER,
  SIZE_RADIUS_MULTIPLIER,
  SWARM_EVADE_CAP,
} from "../../../src/systems/aura/FactionAuras";
import { MAX_AURA_HIT_CHANCE_BONUS } from "../../../src/core/CombatModifiers";
import {
  FACTION_AURA_TEXT,
  SHORT_AURA_LIMIT,
  shipLengths,
} from "../../../src/data/factionAuraText";
import { FACTION_IDENTITIES } from "../../../src/data/factionIdentity";
import { PILOT_ABILITY_REALTIME } from "../../../src/data/pilotAbilityEffects";
import { UPGRADE_CATALOG } from "../../../src/data/upgrades";
import { termEntry, TERM_CATALOG } from "../../../src/data/tooltips";
import { firstSentence } from "../../../src/ui/menu/tooltipContent";
import { factionCodexEntries } from "../../../src/data/encyclopedia/factionCodex";
import { factionAuraTag } from "../../../src/ui/picker/overviewModel";

const FACTIONS = Object.keys(FACTION_AURAS) as FactionId[];
const pct = (fraction: number): string => `${Math.round(fraction * 100)}%`;
const longText = (faction: FactionId): string => {
  const text = FACTION_AURA_TEXT[faction];
  return [text.who, text.range, text.effect, text.ends, text.example].join(" ");
};

/** The numeric effect each aura's text must state, from the real constants. */
const EFFECT_NUMBERS: Readonly<Record<FactionId, readonly string[]>> = {
  terran_hegemony: [`+${FACTION_AURAS.terran_hegemony.magnitude} damage`],
  free_confederation: [pct(FACTION_AURAS.free_confederation.magnitude)],
  synthetic_collective: [
    pct(FACTION_AURAS.synthetic_collective.magnitude),
    pct(SWARM_EVADE_CAP),
  ],
  void_corsairs: [
    "one stress tier",
    `+${pct(FACTION_AURAS.void_corsairs.hitChanceBonus ?? 0)} to hit`,
  ],
  ascendant_empire: [`${FACTION_AURAS.ascendant_empire.magnitude} shield`],
};

describe("faction aura text", () => {
  it("covers every faction with an aura", () => {
    expect(Object.keys(FACTION_AURA_TEXT).sort()).toEqual([...FACTIONS].sort());
  });

  it.each(FACTIONS)("%s: short form fits the tooltip line and is one sentence", (faction) => {
    const { short } = FACTION_AURA_TEXT[faction];
    expect(short.length).toBeLessThanOrEqual(SHORT_AURA_LIMIT);
    expect(SHORT_AURA_LIMIT).toBeLessThanOrEqual(120);
    expect(firstSentence(short)).toBe(short);
  });

  it.each(FACTIONS)("%s: short form says who, how far and what it changes", (faction) => {
    const { short } = FACTION_AURA_TEXT[faction];
    const lengths = shipLengths(FACTION_AURAS[faction].radius);
    expect(short).toContain("Wingmen");
    expect(short).toContain(`${lengths} ship-lengths`);
    for (const fragment of EFFECT_NUMBERS[faction]) expect(short).toContain(fragment);
  });

  it.each(FACTIONS)("%s: long form gives the exact radius in px and the ship-length size", (faction) => {
    const text = longText(faction);
    expect(text).toContain(`${FACTION_AURAS[faction].radius} px`);
    expect(text).toContain(`${SHIP_SIZES.small} px`);
  });

  it.each(FACTIONS)("%s: long form says who projects it and that the projector is not covered", (faction) => {
    const { who } = FACTION_AURA_TEXT[faction];
    expect(who).toMatch(/support ships/);
    expect(who).toMatch(/capital ships/);
    expect(who).toMatch(/named aces/);
    expect(who).toMatch(/never the aura ship itself/);
  });

  it.each(FACTIONS)("%s: long form gives the size scaling from the constants", (faction) => {
    const { range } = FACTION_AURA_TEXT[faction];
    expect(range).toContain(`×${SIZE_RADIUS_MULTIPLIER.large}`);
    expect(range).toContain(`×${SIZE_RADIUS_MULTIPLIER.huge}`);
    expect(range).toContain(pct(SIZE_MAGNITUDE_MULTIPLIER.huge));
  });

  it.each(FACTIONS)("%s: long form says when the aura stops", (faction) => {
    const { ends } = FACTION_AURA_TEXT[faction];
    expect(ends).toMatch(/destroyed|offline/);
    expect(ends).toMatch(/radius/);
  });

  it.each(FACTIONS)("%s: has a concrete example with a number", (faction) => {
    const { example } = FACTION_AURA_TEXT[faction];
    expect(example).toMatch(/\d/);
    expect(example).toMatch(/ship-lengths|support ship/);
  });

  it("states the stacking falloff and the cross-faction share in the long forms", () => {
    expect(FACTION_AURA_TEXT.terran_hegemony.ends).toContain(
      pct(AURA_STACKING.falloff),
    );
    expect(FACTION_AURA_TEXT.terran_hegemony.ends).toContain(
      pct(AURA_STACKING.mixedTeamShare),
    );
  });

  it("states each aura's cap", () => {
    expect(FACTION_AURA_TEXT.free_confederation.ends).toContain(
      pct(1 - MIN_DAMAGE_TAKEN_MULTIPLIER),
    );
    expect(FACTION_AURA_TEXT.synthetic_collective.effect).toContain(
      pct(SWARM_EVADE_CAP),
    );
    expect(FACTION_AURA_TEXT.void_corsairs.ends).toContain(
      `${MAX_STRESS_RELIEF_TIERS} tiers`,
    );
    expect(FACTION_AURA_TEXT.void_corsairs.ends).toContain(
      `+${pct(MAX_AURA_HIT_CHANCE_BONUS)}`,
    );
  });

  it("converts pixels to ship-lengths of the small base size", () => {
    expect(shipLengths(SHIP_SIZES.small)).toBe(1);
    expect(shipLengths(380)).toBe(12);
    expect(shipLengths(800)).toBe(25);
  });

  it.each(FACTIONS)("%s: avoids the abstract wording the owner flagged", (faction) => {
    const text = `${FACTION_AURA_TEXT[faction].short} ${longText(faction)}`;
    expect(text).not.toMatch(/\bnearby allies\b|\bin reach\b|\bless damage, scaling\b/i);
    expect(text).not.toMatch(/\bForce\b|astromech|droid/);
  });
});

describe("faction aura text reaches the player", () => {
  it.each(FACTIONS)("%s: the identity's first lever is the aura's short form", (faction) => {
    const { name, short } = FACTION_AURA_TEXT[faction];
    expect(FACTION_IDENTITIES[faction].levers[0]).toBe(`${name} aura: ${short}`);
    expect(factionAuraTag(faction)).toEqual({ name, text: short });
    expect(name).toBe(FACTION_AURAS[faction].name);
  });

  it.each(FACTIONS)("%s: the faction tooltip opens with the aura and carries the long form", (faction) => {
    const entry = termEntry(`faction.${faction}`);
    const text = FACTION_AURA_TEXT[faction];
    expect(firstSentence(entry.definition)).toBe(`${text.name}: ${text.short}`);
    expect(entry.definition).toContain(text.who);
    expect(entry.definition).toContain(text.range);
    expect(entry.howItPlays).toContain(text.ends);
    expect(entry.example).toBe(text.example);
  });

  it.each(FACTIONS)("%s: the codex entry spells the aura out", (faction) => {
    const entry = factionCodexEntries().find((e) => e.id === faction)!;
    const text = FACTION_AURA_TEXT[faction];
    const byHeading = new Map(entry.paragraphs.map((p) => [p.heading, p.text]));
    expect(byHeading.get("AURA")).toBe(`${text.name}: ${text.short}`);
    expect(byHeading.get("WHO IT COVERS")).toBe(text.who);
    expect(byHeading.get("RANGE")).toBe(text.range);
    expect(byHeading.get("EFFECT")).toBe(text.effect);
    expect(byHeading.get("WHEN IT STOPS")).toBe(text.ends);
    expect(byHeading.get("EXAMPLE")).toBe(text.example);
  });

  it("the generic aura tag tooltip says an aura ship covers other ships", () => {
    const entry = TERM_CATALOG["ui.aura_tag"];
    expect(entry.definition).toMatch(/aura ship/);
    expect(entry.definition).not.toMatch(/every ship of the faction/);
  });
});

describe("identity card and ace lines state the real numbers", () => {
  const levers = (faction: FactionId): string =>
    FACTION_IDENTITIES[faction].levers.join(" | ");
  const realtime = (id: string) => UPGRADE_CATALOG[id]!.realtime!;

  it("Hegemony: Squadron Leader, Coordinated Assault and Hold the Line", () => {
    const text = levers("terran_hegemony");
    expect(realtime("squadron_leader").stressReliefTiers).toBe(1);
    expect(text).toContain("one stress tier easier");
    expect(realtime("coordinated_assault").auraRadiusBonus).toBe(0.25);
    expect(text).toContain("25% wider");
    const hold = PILOT_ABILITY_REALTIME.hold_the_line!;
    expect(text).toContain(`+${hold.wingmanLaserBonus} damage`);
    expect(text).toContain(`${pct(1 - hold.wingmanDamageTakenMultiplier!)} less damage`);
  });

  it("Collective: Swarm Uplink and Pattern Analyzer", () => {
    const text = levers("synthetic_collective");
    expect(text).toContain(
      `${pct(1 - realtime("swarm_uplink").wingmanDamageTakenMultiplier!)} less damage`,
    );
    expect(text).toContain(
      `stress builds ${pct(1 - realtime("pattern_analyzer").stressRateMultiplier!)} slower`,
    );
    expect(text).toContain(`+${realtime("pattern_analyzer").bullseyeLaserBonus} laser damage`);
  });

  it("Corsairs: the three trick talents", () => {
    const text = levers("void_corsairs");
    expect(text).toContain(
      `${pct(1 - realtime("expert_handling").barrelRollCooldownMultiplier!)} faster`,
    );
    expect(text).toContain(
      `${pct(1 - realtime("daredevil").kturnCooldownMultiplier!)} faster`,
    );
    expect(text).toContain(`+${realtime("phantom_strike").rearArcLaserBonus} laser damage`);
  });

  it("Ascendants: Foresight, Psi-Sensitive, Precognition and Mending Light", () => {
    const text = levers("ascendant_empire");
    expect(text).toContain(`${pct(1 - realtime("foresight").damageTakenMultiplier!)} less damage`);
    expect(text).toContain(`${pct(1 - realtime("force_sensitive").damageTakenMultiplier!)} less damage`);
    expect(text).toContain(`${pct(1 - realtime("precognition").stressRateMultiplier!)} slower`);
    expect(text).toContain(`${realtime("mending_light").auraShieldRegenPerSecond}`);
  });

  it("no lever line is made of the old abstract phrases", () => {
    for (const faction of FACTIONS) {
      expect(levers(faction)).not.toMatch(/and other black-market gear|Disciplined talents/);
    }
  });
});
