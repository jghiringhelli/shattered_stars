/**
 * Ascendant lore (docs/lore/campaigns/ascendant.md): every mission carries
 * its day, place and crossover; the overlay's text swaps all match; every
 * flag the campaign reads is written by someone; Chronicle exclusivity and
 * the finale's premise hold.
 */

import { describe, expect, it } from "vitest";
import { compileMission } from "../../../src/campaign/mission/compileMission";
import type {
  ScriptAction,
  ScriptBeat,
} from "../../../src/campaign/scripting/scriptTypes";
import { FACTION_CAMPAIGNS } from "../../../src/data/CampaignData";
import type { CampaignMission } from "../../../src/data/campaign/campaignTypes";
import {
  CHRONICLE_FLAGS,
  crossoversOfMission,
  EXCLUSIVE_FLAG_GROUPS,
} from "../../../src/data/campaign/crossovers";
import { CAMPAIGN_EPILOGUES } from "../../../src/data/campaign/epilogues";
import { ASCENDANT_DESIGNS } from "../../../src/data/campaign/designs/ascendant";
import { ASCENDANT_LORE } from "../../../src/data/campaign/lore/ascendantLore";
import { staleLore } from "../../../src/data/campaign/loreOverlay";
import { ASCENDANT_EMPIRE_MISSIONS } from "../../../src/data/campaign/missions/ascendant";

const ORIGIN = { x: 3000, y: 3000 };
const MISSIONS = FACTION_CAMPAIGNS.ascendant_empire.missions;
const byId = (id: string): CampaignMission =>
  MISSIONS.find((m) => m.id === id)!;

/** Mission id → the crossover it must witness (campaign_arc §4). */
const EXPECTED_CROSSOVER: Readonly<Record<string, string>> = {
  asc_1_5: "X3",
  asc_2_1: "X7",
  asc_3_1: "X11",
  asc_3_2: "X13",
  asc_3_3: "X12",
  asc_3_5: "X15",
};

const beatsOf = (m: CampaignMission): ScriptBeat[] => [
  ...(m.script ?? []),
  ...(m.variants ?? []).flatMap((v) => v.script ?? []),
];
const actionsOf = (m: CampaignMission): ScriptAction[] =>
  beatsOf(m).flatMap((b) => b.actions);

/** Flags a mission persists on victory. */
function persisted(m: CampaignMission): string[] {
  const fromBeats = actionsOf(m).flatMap((a) =>
    a.do === "setFlag" && a.persist ? [a.flag] : [],
  );
  return [...Object.keys(m.victoryFlags ?? {}), ...fromBeats];
}

/** Whether the mission itself raises a (mission-local) flag. */
const setsLocally = (m: CampaignMission, flag: string): boolean =>
  actionsOf(m).some((a) => a.do === "setFlag" && a.flag === flag);

/** Flags a mission reads (variants, beat conditions, flag triggers, allies). */
function reads(m: CampaignMission): string[] {
  return [
    ...(m.variants ?? []).map((v) => v.when.flag),
    ...(m.allies ?? []).flatMap((a) => (a.unlessFlag ? [a.unlessFlag] : [])),
    ...beatsOf(m).flatMap((b) => [
      ...(b.if ?? []).map((c) => c.flag),
      ...(b.when.on === "flag" ? [b.when.flag] : []),
    ]),
  ];
}

/** Beats that persist `flag`. */
const settersOf = (m: CampaignMission, flag: string): ScriptBeat[] =>
  beatsOf(m).filter((b) =>
    b.actions.some((a) => a.do === "setFlag" && a.persist && a.flag === flag),
  );

describe("ascendant lore", () => {
  it("applies every text swap to something", () => {
    const designed = ASCENDANT_EMPIRE_MISSIONS.map((m) => {
      const design = ASCENDANT_DESIGNS[m.id];
      return design
        ? { ...m, ...design, objectives: design.objectives ?? m.objectives }
        : m;
    });
    expect(staleLore(designed, ASCENDANT_LORE)).toEqual([]);
  });

  it.each(MISSIONS.map((m) => [m.id, m] as const))(
    "%s has its day and place",
    (_id, mission) => {
      expect(mission.day).toBeGreaterThanOrEqual(0);
      expect(mission.location?.length ?? 0).toBeGreaterThan(0);
      expect(mission.crossover).toBe(EXPECTED_CROSSOVER[mission.id]);
    },
  );

  it("covers the crossover table's Ascendant missions", () => {
    for (const m of MISSIONS)
      if (crossoversOfMission(m.id).length > 0)
        expect(EXPECTED_CROSSOVER[m.id], m.id).toBeDefined();
  });

  it("titles the campaign The Prophecy and its hero the Templar Kaeth", () => {
    expect(ASCENDANT_LORE.name).toBe("The Prophecy");
    expect(ASCENDANT_LORE.protagonist).toContain("Kaeth");
    expect(ASCENDANT_LORE.protagonist).toContain("Dreamer");
  });

  it("writes every flag it reads from this campaign or the Chronicle", () => {
    const written = new Set(MISSIONS.flatMap(persisted));
    for (const m of MISSIONS)
      for (const flag of reads(m))
        expect(
          written.has(flag) ||
            CHRONICLE_FLAGS.has(flag) ||
            setsLocally(m, flag),
          `${m.id} reads ${flag}`,
        ).toBe(true);
  });

  it("persists the flags other campaigns read", () => {
    const written = new Set(MISSIONS.flatMap(persisted));
    for (const flag of [
      "x_zero_rechassised",
      "x7_shards_saved",
      "asc_heretics_spared",
      "key_asc_mercy",
      "asc_temple_intact",
      "asc_choir_silenced",
      "asc_halo_lost",
      "x11_betrayal_averted",
      "x12_sanctuary_reached",
      "x13_catalyst_destroyed",
      "x13_door_opened",
      "asc_ascension",
      "x15_breach_witnessed_ascendant",
    ])
      expect(written.has(flag), flag).toBe(true);
  });

  it("never reads a flag in the mission that persists it (but the exclusive guards)", () => {
    const exclusive = new Set(EXCLUSIVE_FLAG_GROUPS.flat());
    for (const m of MISSIONS) {
      const mine = new Set(persisted(m));
      for (const b of beatsOf(m))
        for (const c of b.if ?? [])
          if (!exclusive.has(c.flag))
            expect(mine.has(c.flag), `${m.id} ${b.id} ${c.flag}`).toBe(false);
    }
  });

  it("pairs mercy with the spared heretics and the relay", () => {
    const m = byId("asc_2_2");
    expect(settersOf(m, "asc_heretics_spared")).toHaveLength(1);
    expect(settersOf(m, "key_asc_mercy")).toHaveLength(1);
    expect(settersOf(m, "asc_heretics_spared")[0]!.if).toContainEqual({
      flag: "relay_burned",
    });
    const plan = compileMission(m, {}, ORIGIN);
    expect(plan.objectives.some((o) => o.id === "spare" && o.optional)).toBe(
      true,
    );
  });

  it("never writes a Catalyst flag excluded by the other canon", () => {
    const m = byId("asc_3_2");
    const group = EXCLUSIVE_FLAG_GROUPS.find((g) =>
      g.includes("x13_catalyst_destroyed"),
    )!;
    for (const flag of group) {
      const other = group.find((f) => f !== flag)!;
      expect(settersOf(m, flag), flag).not.toHaveLength(0);
      for (const b of settersOf(m, flag))
        expect(b.if ?? [], `${flag} ${b.id}`).toContainEqual({
          flag: other,
          is: false,
        });
    }
  });

  it("swaps the Crusade's opening for Chen's flank once the betrayal is averted", () => {
    const m = byId("asc_3_1");
    const stands = compileMission(m, {}, ORIGIN);
    const averted = compileMission(m, { x11_betrayal_averted: true }, ORIGIN);
    expect(stands.objectives.some((o) => o.id === "parley")).toBe(true);
    expect(averted.objectives.some((o) => o.id === "parley")).toBe(false);
    expect(averted.allies.map((a) => a.tag)).toContain("iron_fist");
    expect(averted.briefing).toContain("Vance's");
  });

  it("adds the purge's pickets once the rendezvous is denied", () => {
    const m = byId("asc_3_3");
    const count = (flags: Record<string, boolean>): number =>
      compileMission(m, flags, ORIGIN).enemies.length;
    expect(count({ x12_rendezvous_denied: true })).toBeGreaterThan(count({}));
  });

  it("flies the finale against the false Prophet with Zaelthar at the Dreamer's side", () => {
    const m = byId("asc_3_5");
    const plan = compileMission(m, {}, ORIGIN);
    const prophet = plan.objectives.find((o) => o.id === "prophet");
    expect(prophet?.type).toBe("assassinate");
    expect(prophet?.description).toContain("Ilsandre");
    expect(plan.allies.map((a) => a.tag)).toContain("zaelthar");
    expect(m.victoryFlags).toMatchObject({
      asc_ascension: true,
      x15_breach_witnessed_ascendant: true,
    });
  });

  it("swaps the epilogue's first line to the vision as it was", () => {
    const lines = CAMPAIGN_EPILOGUES.ascendant_empire;
    const swaps = ASCENDANT_LORE.epilogue?.swaps ?? [];
    for (const [from] of swaps)
      expect(
        lines.some((l) => l.text.includes(from)),
        from,
      ).toBe(true);
    expect(swaps[0]?.[1]).toBe(
      "The vision is fulfilled. Not as they preached it. As it was.",
    );
    expect(lines[0]?.text).toBe(swaps[0]?.[0]);
  });
});
