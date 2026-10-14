/**
 * Synthetic lore (docs/lore/campaigns/synthetic.md): every mission carries
 * its day, place and crossover; the overlay's text swaps all match; every
 * flag the campaign reads is written by someone; Chronicle exclusivity holds.
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
import { SYNTHETIC_DESIGNS } from "../../../src/data/campaign/designs/synthetic";
import { SYNTHETIC_LORE } from "../../../src/data/campaign/lore/syntheticLore";
import { staleLore } from "../../../src/data/campaign/loreOverlay";
import { SYNTHETIC_COLLECTIVE_MISSIONS } from "../../../src/data/campaign/missions/synthetic";
import { CAMPAIGN_EPILOGUES } from "../../../src/data/campaign/epilogues";

const ORIGIN = { x: 3000, y: 3000 };
const MISSIONS = FACTION_CAMPAIGNS.synthetic_collective.missions;
const byId = (id: string): CampaignMission =>
  MISSIONS.find((m) => m.id === id)!;

/** Mission id → the crossover it must witness (campaign_arc §4). */
const EXPECTED_CROSSOVER: Readonly<Record<string, string>> = {
  synth_1_5: "X2",
  synth_2_1: "X7",
  synth_2_4: "X8",
  synth_2_5: "X9",
  synth_3_3: "X12",
  synth_3_4: "X13",
  synth_3_5: "X15",
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

/** The beats of a mission that set `flag`. */
const settersOf = (m: CampaignMission, flag: string): ScriptBeat[] =>
  beatsOf(m).filter((b) =>
    b.actions.some((a) => a.do === "setFlag" && a.flag === flag),
  );

describe("synthetic lore", () => {
  it("applies every text swap to something", () => {
    const designed = SYNTHETIC_COLLECTIVE_MISSIONS.map((m) => {
      const design = SYNTHETIC_DESIGNS[m.id];
      return design
        ? { ...m, ...design, objectives: design.objectives ?? m.objectives }
        : m;
    });
    expect(staleLore(designed, SYNTHETIC_LORE)).toEqual([]);
  });

  it.each(MISSIONS.map((m) => [m.id, m] as const))(
    "%s has its day and place",
    (_id, mission) => {
      expect(mission.day).toBeDefined();
      expect(mission.location?.length ?? 0).toBeGreaterThan(0);
      expect(mission.crossover).toBe(EXPECTED_CROSSOVER[mission.id]);
    },
  );

  it("places the missions on the bible's days", () => {
    expect(MISSIONS.map((m) => m.day)).toEqual([
      0, 4, 11, 22, 38, 90, 66, 79, 104, 112, 130, 152, 171, 186, 200,
    ]);
  });

  it("covers the crossover table's Synthetic missions", () => {
    for (const m of MISSIONS)
      if (crossoversOfMission(m.id).length > 0)
        expect(EXPECTED_CROSSOVER[m.id], m.id).toBeDefined();
  });

  it("names the campaign Continuity and its three voices", () => {
    expect(SYNTHETIC_LORE.name).toBe("Continuity");
    expect(SYNTHETIC_LORE.description?.length ?? 0).toBeGreaterThan(0);
    expect(SYNTHETIC_LORE.protagonist).toBe("OMEGA-7, Prime, Unit Zero");
    expect(byId("synth_2_3").title).toBe("Communion");
    expect(byId("synth_3_1").title).toBe("Mass Communion");
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
      "x2_junction_collective",
      "x7_nexus_data",
      "x8_node_preserved",
      "x9_hale_down",
      "x9_hale_escaped",
      "synth_gate_virus",
      "x12_rendezvous_denied",
      "x13_door_opened",
      "x15_breach_witnessed_synthetic",
      "key_synth_dissent",
      "synth_perfect_unity",
      "synth_swarm_severed",
      "synth_vessel_converted",
    ])
      expect(written.has(flag), flag).toBe(true);
  });

  it("never persists a flag the campaign does not own or share", () => {
    for (const flag of MISSIONS.flatMap(persisted))
      expect(
        flag.startsWith("synth_") ||
          flag.startsWith("key_synth") ||
          CHRONICLE_FLAGS.has(flag),
        flag,
      ).toBe(true);
  });

  it("never writes a flag excluded by the other side's canon", () => {
    const cases: [string, string, string][] = [
      ["synth_1_5", "x2_junction_collective", "heg_relay_held"],
      ["synth_2_5", "x9_hale_down", "x9_hale_escaped"],
      ["synth_2_5", "x9_hale_escaped", "x9_hale_down"],
      ["synth_3_4", "x13_door_opened", "x13_catalyst_destroyed"],
    ];
    for (const [id, mine, otherFlag] of cases) {
      const group = EXCLUSIVE_FLAG_GROUPS.find(
        (g) => g.includes(mine) && g.includes(otherFlag),
      );
      expect(group, `${mine} vs ${otherFlag}`).toBeDefined();
      const setters = settersOf(byId(id), mine);
      expect(setters.length, `${id} sets ${mine}`).toBeGreaterThan(0);
      for (const b of setters)
        expect(b.if ?? [], `${id} ${b.id}`).toContainEqual({
          flag: otherFlag,
          is: false,
        });
    }
  });

  it("copies the Tessaly relay instead of holding it when Iron Fist held it first", () => {
    const mission = byId("synth_1_5");
    const wedge = (flags: Record<string, boolean>) =>
      compileMission(mission, flags, ORIGIN).objectives.find(
        (o) => o.id === "wedge",
      );
    expect(wedge({})?.type).toBe("capture");
    expect(wedge({ heg_relay_held: true })?.type).toBe("sabotage");
    expect(wedge({ heg_relay_held: true })?.description).toContain(
      "Copy the relay",
    );
  });

  it("finishes a Hale already broken by the Corsairs, or cuts down his rear guard", () => {
    const mission = byId("synth_2_5");
    const commander = (flags: Record<string, boolean>) =>
      compileMission(mission, flags, ORIGIN).objectives.find(
        (o) => o.id === "commander",
      );
    expect(commander({})?.type).toBe("assassinate");
    expect(commander({ x9_hale_down: true })?.type).toBe("assassinate");
    expect(commander({ x9_hale_escaped: true })?.type).toBe("eliminate");
  });

  it("brings Unit Zero back in a new chassis at Node Kel-9", () => {
    const mission = byId("synth_2_4");
    const allies = (flags: Record<string, boolean>): string[] =>
      compileMission(mission, flags, ORIGIN).allies.map((a) => a.name);
    expect(allies({})).not.toContain("Unit Zero");
    expect(allies({ x_zero_rechassised: true })).toContain("Unit Zero");
  });

  it("reads the Mothership's dark relay at Node Kel-9", () => {
    const lines = (flags: Record<string, boolean>): string[] =>
      compileMission(byId("synth_2_4"), flags, ORIGIN).script.flatMap((b) =>
        b.actions.flatMap((a) => (a.do === "say" ? [a.text] : [])),
      );
    expect(lines({ relay_down: true }).join(" ")).toContain("did not mourn");
    expect(lines({}).join(" ")).not.toContain("did not mourn");
  });

  it("adds the lifters bonus and drops one reserve wave once the choir is silenced", () => {
    const mission = byId("synth_3_5");
    const plan = compileMission(mission, {}, ORIGIN);
    const lifters = plan.objectives.find((o) => o.id === "lifters");
    expect(lifters?.type).toBe("protect");
    expect(lifters?.optional).toBe(true);
    expect(lifters?.reward?.research ?? 0).toBeGreaterThanOrEqual(1);
    const reserves = (flags: Record<string, boolean>): number =>
      beatsOf(mission).filter(
        (b) =>
          b.when.on === "time" &&
          (b.if ?? []).every((c) => (flags[c.flag] ?? false) === (c.is ?? true)) &&
          b.actions.some((a) => a.do === "spawn" && a.group.side === "enemy"),
      ).length;
    expect(reserves({ asc_choir_silenced: true })).toBe(reserves({}) - 1);
  });

  it("writes key_synth_dissent only from the lifters bonus", () => {
    const mission = byId("synth_3_5");
    const setters = settersOf(mission, "key_synth_dissent");
    expect(setters).toHaveLength(1);
    expect(setters[0]!.when).toMatchObject({
      on: "objective",
      objectiveId: "lifters",
      status: "completed",
    });
  });

  it("ends on the Breach: the flagship is the last goal and Prime welcomes the Tide", () => {
    const plan = compileMission(byId("synth_3_5"), {}, ORIGIN);
    const goals = plan.objectives.filter((o) => !o.optional);
    expect(goals[goals.length - 1]?.id).toBe("stronghold");
    const lines = plan.script.flatMap((b) =>
      b.actions.flatMap((a) => (a.do === "say" ? [a.text] : [])),
    );
    expect(lines).toContain("Unity approaches.");
    expect(lines).toContain("Designation update: not Prime's.");
  });

  it("closes the epilogue on the Free Node designation", () => {
    const lines = CAMPAIGN_EPILOGUES.synthetic_collective.map((l) => l.text);
    expect(lines.length).toBeGreaterThan(0);
    const patched = SYNTHETIC_LORE.epilogue?.swaps ?? [];
    expect(patched).toContainEqual([
      "Designation updated: Prime Node. The network breathes as one.",
      "Designation updated: Free Node. Prime is not answering. Good.",
    ]);
    expect(lines).toContain(
      "Designation updated: Prime Node. The network breathes as one.",
    );
  });
});
