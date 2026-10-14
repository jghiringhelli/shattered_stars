/**
 * Spec: the creature catalog is consistent — every power telegraphs for one
 * or two cycles, every referenced part and summoned creature exists, boss
 * creatures have parts and phases, and hit points come from the shared
 * durability path.
 */

import { describe, it, expect } from "vitest";
import { DURABILITY_SCALE } from "../../../src/config";
import {
  ALL_CREATURES,
  creatureDurability,
  creatureTextureKeys,
  findCreature,
  getCreature,
  survivalBossFor,
  SURVIVAL_SECTOR_BOSSES,
} from "../../../src/data/creatures/creatureCatalog";

describe("creature catalog", () => {
  it("has_at_least_six_creatures_with_unique_ids_and_sprite_stems", () => {
    expect(ALL_CREATURES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(ALL_CREATURES.map((c) => c.id)).size).toBe(
      ALL_CREATURES.length,
    );
    expect(new Set(ALL_CREATURES.map((c) => c.spriteStem)).size).toBe(
      ALL_CREATURES.length,
    );
  });

  it("uses_all_five_movement_styles", () => {
    const styles = new Set(ALL_CREATURES.map((c) => c.movement.style));
    expect(styles.size).toBeGreaterThanOrEqual(5);
  });

  it("telegraphs_every_power_for_one_or_two_cycles", () => {
    for (const creature of ALL_CREATURES)
      for (const power of creature.powers)
        expect([1, 2], `${creature.id}.${power.id}`).toContain(
          power.windupCycles,
        );
  });

  it("requires_only_parts_the_creature_has", () => {
    for (const creature of ALL_CREATURES) {
      const parts = new Set(creature.parts.map((p) => p.id));
      for (const power of creature.powers)
        if (power.requiresPart)
          expect(
            parts.has(power.requiresPart),
            `${creature.id}.${power.id}`,
          ).toBe(true);
    }
  });

  it("summons_only_creatures_that_exist", () => {
    for (const creature of ALL_CREATURES)
      for (const power of creature.powers)
        if (power.kind === "summon")
          expect(findCreature(power.spawnCreatureId ?? "")).toBeDefined();
  });

  it("gives_every_boss_parts_and_an_enrage_phase_and_standard_creatures_neither_is_required", () => {
    for (const boss of ALL_CREATURES.filter((c) => c.isBoss)) {
      expect(boss.parts.length).toBeGreaterThan(0);
      expect(boss.phases.length).toBeGreaterThanOrEqual(2);
    }
    expect(
      ALL_CREATURES.filter((c) => !c.isBoss).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("escalates_the_three_survival_sector_bosses_in_hit_points_then_in_powers", () => {
    const [s1, s2, s3] = SURVIVAL_SECTOR_BOSSES.map((id) => getCreature(id));
    expect(s1!.hullPoints + s1!.shieldPoints).toBeLessThan(
      s2!.hullPoints + s2!.shieldPoints,
    );
    expect(s3!.powers.length).toBeGreaterThan(s1!.powers.length);
    expect(survivalBossFor(9).id).toBe(SURVIVAL_SECTOR_BOSSES[2]);
  });

  it("converts_miniature_hit_points_with_the_shared_durability_scale", () => {
    const wyrm = getCreature("cinder_wyrm");
    expect(creatureDurability(wyrm).maxHull).toBe(
      wyrm.hullPoints * DURABILITY_SCALE,
    );
  });

  it("names_a_body_texture_for_each_and_segments_or_pods_only_where_drawn", () => {
    expect(creatureTextureKeys(getCreature("cinder_wyrm")).segment).toBe(
      "creature_cinder_wyrm_segment",
    );
    expect(creatureTextureKeys(getCreature("choir_hive")).pod).toBe(
      "creature_choir_hive_pod",
    );
    expect(creatureTextureKeys(getCreature("tidecell")).segment).toBeNull();
  });
});
