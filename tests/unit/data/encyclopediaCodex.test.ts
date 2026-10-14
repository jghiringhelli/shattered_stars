/**
 * Encyclopedia codex — specification tests: beyond ships, the codex lists
 * every pilot (with its ability and its real-time reading), every upgrade
 * card (by slot, with its role hint) and every faction; entries can be
 * filtered by faction and searched by text.
 */

import { describe, it, expect } from "vitest";
import {
  CODEX_SECTIONS,
  codexEntries,
  filterCodex,
} from "../../../src/data/encyclopedia/codex";
import { PILOT_CARDS } from "../../../src/systems/SquadBuilder";
import { UPGRADE_DEFINITIONS } from "../../../src/systems/UpgradeSystem";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";
import { FACTION_AURAS } from "../../../src/systems/SupportAura";

describe("codex sections", () => {
  it("offers ships, pilots, upgrades, factions and the bestiary", () => {
    expect(CODEX_SECTIONS.map((s) => s.id)).toEqual([
      "ships",
      "pilots",
      "upgrades",
      "factions",
      "bestiary",
    ]);
  });

  it("lists every ship, pilot card, upgrade card and faction once", () => {
    expect(codexEntries("ships").length).toBe(
      Object.keys(SHIP_DEFINITIONS).length,
    );
    expect(codexEntries("pilots").length).toBe(Object.keys(PILOT_CARDS).length);
    expect(codexEntries("upgrades").length).toBe(
      Object.keys(UPGRADE_DEFINITIONS).length,
    );
    expect(codexEntries("factions").length).toBe(
      Object.keys(FACTION_AURAS).length,
    );
  });

  it("gives every entry a name, a caption and at least one detail paragraph", () => {
    const thin = CODEX_SECTIONS.flatMap((s) => codexEntries(s.id))
      .filter((e) => e.section !== "ships")
      .filter((e) => !e.name || !e.tag || e.paragraphs.length === 0)
      .map((e) => e.id);
    expect(thin).toEqual([]);
  });
});

describe("pilot entries", () => {
  const pilot = codexEntries("pilots").find((e) => e.id === "whisper_null")!;

  it("shows the ability's card text and its real-time reading", () => {
    const text = pilot.paragraphs.map((p) => p.text).join(" ");
    expect(text).toContain(PILOT_CARDS.whisper_null!.abilityText);
    expect(text).toMatch(/wingman/);
  });

  it("names the quick builds that fly the pilot", () => {
    expect(pilot.paragraphs.some((p) => p.heading === "FLY IT IN")).toBe(true);
  });
});

describe("upgrade entries", () => {
  const entries = codexEntries("upgrades");

  it("are grouped by slot", () => {
    const slots = entries.map((e) => e.tag);
    const firstSeen = slots.filter((slot, i) => slots.indexOf(slot) === i);
    const regrouped = firstSeen.flatMap((slot) =>
      slots.filter((s) => s === slot),
    );
    expect(slots).toEqual(regrouped);
  });

  it("carry a role hint and the real-time summary", () => {
    const predator = entries.find((e) => e.id === "predator")!;
    const headings = predator.paragraphs.map((p) => p.heading);
    expect(headings).toEqual(
      expect.arrayContaining(["IN BATTLE", "ROLE", "BEST WITH"]),
    );
  });
});

describe("faction entries", () => {
  it("describe the faction's aura and fleet", () => {
    const corsairs = codexEntries("factions").find(
      (e) => e.id === "void_corsairs",
    )!;
    const text = corsairs.paragraphs.map((p) => p.text).join(" ");
    expect(text).toContain(FACTION_AURAS.void_corsairs.name);
    expect(text).toMatch(/20 ships/);
  });
});

describe("filterCodex", () => {
  it("filters by faction, keeping cards every faction may use", () => {
    const cards = filterCodex(codexEntries("upgrades"), {
      faction: "void_corsairs",
      query: "",
    });
    expect(cards.some((e) => e.id === "heavy_laser_cannon")).toBe(true);
    expect(cards.some((e) => e.id === "battle_meditation")).toBe(false);
  });

  it("matches every search word, case-insensitively, in name or text", () => {
    const hits = filterCodex(codexEntries("pilots"), {
      faction: null,
      query: "WHISPER null",
    });
    expect(hits.map((e) => e.id)).toEqual(["whisper_null"]);
  });

  it("searches the effect text too", () => {
    const hits = filterCodex(codexEntries("upgrades"), {
      faction: null,
      query: "torpedo",
    });
    expect(hits.map((e) => e.id)).toEqual(
      expect.arrayContaining(["proton_torpedo", "ion_torpedo"]),
    );
  });

  it("an empty query and no faction keep everything", () => {
    const all = codexEntries("pilots");
    expect(filterCodex(all, { faction: null, query: "  " })).toHaveLength(
      all.length,
    );
  });
});
