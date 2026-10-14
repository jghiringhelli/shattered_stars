/**
 * Spec: the bestiary lists every creature with lore, movement, powers, body
 * parts and tactics; every texture a creature draws with ships in public/
 * and is registered in the asset manifest (loaded on demand, never at boot).
 */

import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  allManifestAssets,
  BOOT_ASSETS,
  creatureAssets,
} from "../../../src/assets/assetManifest";
import {
  ALL_CREATURES,
  creatureTextureKeys,
} from "../../../src/data/creatures/creatureCatalog";
import {
  CODEX_SECTIONS,
  codexEntries,
  filterCodex,
} from "../../../src/data/encyclopedia/codex";

const PUBLIC = join(process.cwd(), "public");

describe("bestiary", () => {
  it("is_a_codex_section_with_one_entry_per_creature", () => {
    expect(CODEX_SECTIONS.map((s) => s.id)).toContain("bestiary");
    expect(codexEntries("bestiary").map((e) => e.id)).toEqual(
      ALL_CREATURES.map((c) => c.id),
    );
  });

  it("gives_each_entry_lore_powers_tactics_and_where_it_appears", () => {
    for (const entry of codexEntries("bestiary")) {
      const headings = entry.paragraphs.map((p) => p.heading);
      for (const wanted of ["LORE", "POWERS", "TACTICS", "WHERE", "MOVEMENT"])
        expect(headings, entry.id).toContain(wanted);
    }
  });

  it("lists_what_each_destroyed_part_disables", () => {
    const wyrm = codexEntries("bestiary").find((e) => e.id === "cinder_wyrm")!;
    const parts = wyrm.paragraphs.find((p) => p.heading === "BODY PARTS")!;
    expect(parts.text).toContain("Ember gland (weak point");
    expect(parts.text).toContain("disables EMBER NOVA");
  });

  it("is_searchable_by_lore_words", () => {
    const hits = filterCodex(codexEntries("bestiary"), {
      faction: null,
      query: "warden gardener",
    });
    expect(hits.map((e) => e.id)).toContain("warden_avatar");
  });
});

describe("creature assets", () => {
  it("ships_every_texture_a_creature_draws_with", () => {
    const missing = ALL_CREATURES.flatMap((creature) => {
      const keys = creatureTextureKeys(creature);
      return [keys.body, keys.segment, keys.pod].filter(
        (key): key is string => key !== null,
      );
    }).filter(
      (key) => !existsSync(join(PUBLIC, "assets", "creatures", `${key}.png`)),
    );
    expect(missing).toEqual([]);
  });

  it("registers_them_in_the_manifest_but_not_in_the_boot_set", () => {
    const keys = creatureAssets().map((e) => e.key);
    expect(keys.length).toBeGreaterThanOrEqual(ALL_CREATURES.length);
    const manifest = new Set(allManifestAssets().map((e) => e.key));
    for (const key of keys) expect(manifest.has(key)).toBe(true);
    expect(BOOT_ASSETS.some((e) => e.key.startsWith("creature_"))).toBe(false);
  });
});
