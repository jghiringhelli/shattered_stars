/**
 * Hegemony lore (docs/lore/campaigns/hegemony.md): every mission carries its
 * day, place and crossover; the overlay's text swaps all match; every flag
 * the campaign reads is written by someone; Chronicle exclusivity holds.
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
import { HEGEMONY_DESIGNS } from "../../../src/data/campaign/designs/hegemony";
import { HEGEMONY_LORE } from "../../../src/data/campaign/lore/hegemonyLore";
import { staleLore } from "../../../src/data/campaign/loreOverlay";
import { HEGEMONY_ACT1_MISSIONS } from "../../../src/data/campaign/missions/hegemonyAct1";
import { HEGEMONY_ACT2_MISSIONS } from "../../../src/data/campaign/missions/hegemonyAct2";
import { HEGEMONY_ACT3_MISSIONS } from "../../../src/data/campaign/missions/hegemonyAct3";

const ORIGIN = { x: 3000, y: 3000 };
const MISSIONS = FACTION_CAMPAIGNS.terran_hegemony.missions;
const BRANCH_PAIRS = ["heg_1_3b", "heg_2_3b", "heg_3_3b"];

/** Mission id → the crossover it must witness (campaign_arc §4). */
const EXPECTED_CROSSOVER: Readonly<Record<string, string>> = {
  heg_1_4: "X1",
  heg_1_5: "X2",
  heg_2_1: "X4",
  heg_2_3: "X6",
  heg_2_3b: "X6",
  heg_2_4: "X7",
  heg_2_5: "X8",
  heg_3_1: "X10",
  heg_3_3: "X11",
  heg_3_3b: "X11",
  heg_3_5: "X14",
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

describe("hegemony lore", () => {
  it("applies every text swap to something", () => {
    const designed = [
      ...HEGEMONY_ACT1_MISSIONS,
      ...HEGEMONY_ACT2_MISSIONS,
      ...HEGEMONY_ACT3_MISSIONS,
    ].map((m) => {
      const design = HEGEMONY_DESIGNS[m.id];
      return design
        ? { ...m, ...design, objectives: design.objectives ?? m.objectives }
        : m;
    });
    expect(staleLore(designed, HEGEMONY_LORE)).toEqual([]);
  });

  it.each(MISSIONS.map((m) => [m.id, m] as const))(
    "%s has its day and place",
    (_id, mission) => {
      expect(mission.day).toBeGreaterThan(0);
      expect(mission.location?.length ?? 0).toBeGreaterThan(0);
      expect(mission.crossover).toBe(EXPECTED_CROSSOVER[mission.id]);
    },
  );

  it("covers the crossover table's Hegemony missions", () => {
    for (const m of MISSIONS)
      if (crossoversOfMission(m.id).length > 0)
        expect(EXPECTED_CROSSOVER[m.id], m.id).toBeDefined();
  });

  it("writes every flag it reads from this campaign or the Chronicle", () => {
    const written = new Set(MISSIONS.flatMap(persisted));
    for (const m of MISSIONS)
      for (const flag of reads(m))
        expect(
          written.has(flag) || CHRONICLE_FLAGS.has(flag) || setsLocally(m, flag),
          `${m.id} reads ${flag}`,
        ).toBe(true);
  });

  it("persists the flags other campaigns read", () => {
    const written = new Set(MISSIONS.flatMap(persisted));
    for (const flag of [
      "heg_relay_held",
      "relay_down",
      "heg_convoy_intact",
      "x1_phoenix_wounded",
      "x7_omega_held",
      "x10_chen_held_fire",
      "x14_ceasefire_called",
      "x15_breach_witnessed_hegemony",
      "heg_vance_captured",
      "heg_phoenix_defected",
    ])
      expect(written.has(flag), flag).toBe(true);
    expect(written.has("x11_betrayal_averted")).toBe(true);
  });

  it("never writes a flag excluded by the other side's canon", () => {
    const cases: [string, string][] = [
      ["heg_1_5", "x2_junction_collective"],
      ["heg_2_1", "x4_convoy_gutted"],
    ];
    for (const [id, otherFlag] of cases) {
      const mission = MISSIONS.find((m) => m.id === id)!;
      const group = EXCLUSIVE_FLAG_GROUPS.find((g) => g.includes(otherFlag))!;
      const mine = group.find((f) => f !== otherFlag)!;
      for (const b of beatsOf(mission).filter((x) =>
        x.actions.some((a) => a.do === "setFlag" && a.flag === mine),
      ))
        expect(b.if ?? [], `${id} ${b.id}`).toContainEqual({
          flag: otherFlag,
          is: false,
        });
      const plan = compileMission(mission, { [otherFlag]: true }, ORIGIN);
      expect(plan.objectives.some((o) => o.type === "salvage")).toBe(true);
    }
  });

  it("shortens the Last Gate when the Collective's gate virus is set", () => {
    const finale = MISSIONS.find((m) => m.id === "heg_3_5")!;
    const hold = (flags: Record<string, boolean>): number => {
      const gate = compileMission(finale, flags, ORIGIN).objectives.find(
        (o) => o.id === "gate",
      );
      return gate?.type === "capture" ? gate.holdSeconds : 0;
    };
    expect(hold({ synth_gate_virus: true })).toBe(hold({}) - 30);
  });

  it("plays Cinder Gate without Ascendant attackers once the betrayal is averted", () => {
    const gate = MISSIONS.find((m) => m.id === "heg_3_3")!;
    const factions = (flags: Record<string, boolean>): string[] =>
      compileMission(gate, flags, ORIGIN).enemies.map((e) => e.faction);
    expect(factions({})).toContain("ascendant_empire");
    expect(factions({ x11_betrayal_averted: true })).not.toContain(
      "ascendant_empire",
    );
  });

  it("keeps the branch pairs and their slots", () => {
    for (const id of BRANCH_PAIRS)
      expect(MISSIONS.some((m) => m.id === id)).toBe(true);
    expect(MISSIONS).toHaveLength(18);
  });
});
