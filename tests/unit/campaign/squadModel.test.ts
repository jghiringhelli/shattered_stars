/**
 * Spec: the squad panel shows campaign totals and a roster on its overview,
 * and the selected pilot's ship numbers, loadout and progress on the other
 * tabs.
 */

import { describe, expect, it } from "vitest";
import { initializePilots } from "../../../src/systems/CampaignPilotManager";
import {
  pilotLoadout,
  pilotProgress,
  pilotStatRows,
  rosterRows,
  squadPanelHeight,
  squadTotals,
} from "../../../src/ui/campaign/squadModel";

const PILOTS = initializePilots("terran_hegemony");
const CHEN = PILOTS[0]!;

describe("squadTotals", () => {
  it("states xp, credits, research points and kills with their unit", () => {
    const totals = squadTotals({
      totalXp: 1150,
      credits: 300,
      researchPoints: 4,
      totalKills: 12,
    });
    expect(totals.map((t) => t.text)).toEqual([
      "1150 XP",
      "300 CR",
      "4 RESEARCH",
      "12 KILLS",
    ]);
    expect(totals.map((t) => t.term)).toEqual([
      "campaign.stat_xp",
      "campaign.stat_credits",
      "campaign.stat_research",
      "campaign.stat_kills",
    ]);
  });
});

describe("rosterRows", () => {
  it("lists callsign and skill of every pilot", () => {
    const rows = rosterRows("terran_hegemony", PILOTS);
    expect(rows).toHaveLength(PILOTS.length);
    expect(rows[0]?.text).toBe("IRON ACTUAL \u00b7 SKILL 1");
    expect(rows[0]?.pilotId).toBe(CHEN.pilotId);
  });
});

describe("pilotStatRows", () => {
  it("adds the evolution bonus in brackets", () => {
    const boosted = { ...CHEN, statBonuses: { ...CHEN.statBonuses, hull: 3 } };
    const hull = pilotStatRows(boosted).find((row) => row.label === "HULL")!;
    expect(hull.value).toMatch(/^\d+ \(\+3\)$/);
    expect(hull.term).toBe("stat.hull");
  });

  it("shows plain numbers without bonus", () => {
    const rows = pilotStatRows(CHEN);
    expect(rows.map((r) => r.label)).toEqual([
      "HULL",
      "SHIELDS",
      "ATTACK",
      "AGILITY",
    ]);
    expect(rows.every((r) => !r.value.includes("("))).toBe(true);
  });
});

describe("pilotLoadout", () => {
  it("shows equipped abilities and the slots they use", () => {
    const loadout = pilotLoadout("terran_hegemony", CHEN);
    expect(loadout.slotsText).toBe("ABILITY SLOTS 1 / 1");
    expect(loadout.abilities.map((a) => a.name)).toEqual(["Marksman"]);
  });
});

describe("pilotProgress", () => {
  it("shows skill, xp to the next level and the next unlock", () => {
    const progress = pilotProgress("terran_hegemony", { ...CHEN, xp: 40 });
    expect(progress.skillText).toBe("SKILL 1 / 6");
    expect(progress.xpText).toBe("40 XP \u00b7 60 TO NEXT");
    expect(progress.nextText).toContain("SKILL 2");
    expect(progress.roleText).toBe("PROTAGONIST");
  });

  it("shows the maximum skill without a next unlock", () => {
    const progress = pilotProgress("terran_hegemony", {
      ...CHEN,
      xp: 2000,
      pilotSkill: 6,
    });
    expect(progress.xpText).toBe("2000 XP \u00b7 MAX");
    expect(progress.nextText).toBe("NEXT UNLOCK \u2014");
  });
});

describe("squadPanelHeight", () => {
  it("keeps the base size for a normal squad and grows for a large one", () => {
    expect(squadPanelHeight(3)).toBe(328);
    expect(squadPanelHeight(5)).toBeGreaterThan(328);
    expect(squadPanelHeight(5) % 8).toBe(0);
  });
});
