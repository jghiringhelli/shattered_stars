/**
 * Boss Raid HUD rules — specification tests for the boss status panel's
 * pure presentation rules, the raid's HUD contacts and the boss catalogue's
 * real-time numbers.
 */

import { describe, it, expect } from "vitest";
import { BOSS_HP_SCALE } from "../../../../src/arcade/systems/EpicRaidCombat";
import {
  bossHullColor,
  bossPhaseColor,
  bossPhaseLabel,
  sectionSegments,
} from "../../../../src/scenes/epicRaid/bossStatus";
import {
  BOSS_CONTACT_ID,
  raidContacts,
} from "../../../../src/scenes/epicRaid/raidHudSnapshot";
import {
  BOSS_DEFINITIONS,
  raidDifficultyMultiplier,
  raidIntelLines,
} from "../../../../src/scenes/epicRaid/bossDefinitions";
import { HOLO_PALETTE } from "../../../../src/ui/theme/HoloTheme";

describe("boss status panel rules", () => {
  it("labels and colours each phase", () => {
    expect(bossPhaseLabel(1)).toBe("PHASE 1");
    expect(bossPhaseLabel(3)).toContain("CRITICAL");
    expect(bossPhaseColor(2)).toBe(HOLO_PALETTE.warning);
  });

  it("colours the hull gauge at the phase thresholds", () => {
    expect(bossHullColor(0.9)).toBe(HOLO_PALETTE.success);
    expect(bossHullColor(0.6)).toBe(HOLO_PALETTE.warning);
    expect(bossHullColor(0.3)).toBe(HOLO_PALETTE.danger);
  });

  it("splits the hull gauge by section max hull and fills by remaining hull", () => {
    const segments = sectionSegments(
      [
        { hull: 30, maxHull: 60, disabled: false },
        { hull: 0, maxHull: 20, disabled: true },
      ],
      400,
    );
    expect(segments).toEqual([
      { x: 0, width: 300, fill: 0.5, disabled: false },
      { x: 300, width: 100, fill: 0, disabled: true },
    ]);
  });

  it("has no segments for a boss without hull", () => {
    expect(sectionSegments([], 400)).toEqual([]);
  });
});

describe("raidContacts", () => {
  const ship = (id: string, owner: "player" | "ai", hull = 4) => ({
    id,
    owner,
    definitionId: "terran_viper",
    x: 0,
    y: 0,
    angle: 0,
    hull,
  });
  const boss = { id: "boss", x: 3000, y: 200, angle: 180, hull: 100 };

  it("adds the boss as a huge enemy contact", () => {
    const contacts = raidContacts({
      flagshipId: "p0",
      ships: [ship("p0", "player")],
      boss,
      targetId: BOSS_CONTACT_ID,
    });
    expect(contacts).toEqual([
      expect.objectContaining({
        id: BOSS_CONTACT_ID,
        side: "enemy",
        sizeClass: "huge",
        isTarget: true,
      }),
    ]);
  });

  it("leaves out the flagship, dead ships and a destroyed boss", () => {
    const contacts = raidContacts({
      flagshipId: "p0",
      ships: [ship("p0", "player"), ship("p1", "player"), ship("e0", "ai", 0)],
      boss: { ...boss, hull: 0 },
      targetId: null,
    });
    expect(contacts.map((c) => [c.id, c.side])).toEqual([["p1", "ally"]]);
  });
});

describe("boss catalogue in real-time points", () => {
  it("knows each difficulty's multiplier", () => {
    expect(raidDifficultyMultiplier("easy")).toBe(0.75);
    expect(raidDifficultyMultiplier("mythic")).toBe(2);
  });

  it("briefs the boss's hull and shields at BOSS_HP_SCALE", () => {
    const boss = BOSS_DEFINITIONS.terran_hegemony;
    const [stats] = raidIntelLines("terran_hegemony", "medium");
    expect(stats).toContain(`Hull ${boss.totalHull * BOSS_HP_SCALE}`);
    expect(stats).toContain(`Shields ${boss.shields * BOSS_HP_SCALE}`);
  });

  it("keeps every boss's total hull equal to the sum of its sections", () => {
    for (const boss of Object.values(BOSS_DEFINITIONS)) {
      expect(boss.sections.reduce((sum, s) => sum + s.hull, 0)).toBe(
        boss.totalHull,
      );
    }
  });
});
